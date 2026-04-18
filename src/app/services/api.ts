// Central API client for TempWorks backend

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
// When API_URL is a relative path (Vite proxy mode) BACKEND_URL is empty so
// image/file URLs resolve against the current origin (also proxied).
export const BACKEND_URL = API_URL.startsWith('http') ? API_URL.replace('/api/v1', '') : '';

// ─── Token Management ────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('current_user');
}

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem('current_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setCurrentUser(user: AuthUser): void {
  localStorage.setItem('current_user', JSON.stringify(user));
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  agencyId?: string;
  /** True when the user's agency is the Tempworks root/owner and they
   *  therefore see global (non-tenant-scoped) data. False/undefined
   *  means every backend query is filtered to their own agency. */
  agencyIsSystem?: boolean;
  permissions?: string[];
  photoUrl?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/** Decode the JWT `exp` claim (seconds since epoch). Returns 0 if unknown. */
function getTokenExpiryMs(token: string | null): number {
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Pre-emptively refresh if the access token expires within 30 seconds.
 *  This stops every authenticated poll (e.g. /notifications/unread-count)
 *  from first hitting the server with an expired token, getting logged as
 *  a 401, refreshing, and retrying.
 */
async function ensureFreshAccessToken(): Promise<void> {
  const token = getAccessToken();
  if (!token) return;
  const expMs = getTokenExpiryMs(token);
  if (!expMs) return;                       // Opaque token; skip
  if (expMs - Date.now() > 30_000) return;  // Still has > 30s of life

  if (!localStorage.getItem('refresh_token')) return; // No refresh token available
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken()
      .catch(() => { /* 401-on-refresh already redirects to /login */ })
      .finally(() => { isRefreshing = false; refreshPromise = null; });
  }
  await refreshPromise;
}

async function refreshAccessToken(): Promise<void> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const { accessToken, refreshToken: newRefreshToken } = await res.json();
  setTokens(accessToken, newRefreshToken);
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  // Skip preemptive refresh for auth routes (login/refresh) so we don't
  // spin on endpoints that don't need the access token.
  if (!path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    await ensureFreshAccessToken();
  }

  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 with token refresh (skip for auth endpoints to surface real errors)
  if (response.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }
    await refreshPromise;
    return apiFetch<T>(path, options, true);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const rawMessage = errorData.message || 'An error occurred';
    const error: ApiError = {
      message: Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage),
      statusCode: response.status,
      error: errorData.error,
    };
    throw error;
  }

  // Handle no-content responses
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export type LoginResult =
  | { twoFactorRequired: true; challengeId: string; expiresAt: string; emailHint?: string }
  | { accessToken: string; refreshToken: string; user: AuthUser; passwordExpired?: boolean };

export const authApi = {
  login: async (email: string, password: string, agencyId?: string): Promise<LoginResult> => {
    const data = await apiFetch<any>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password, ...(agencyId && { agencyId }) }) },
    );
    // 2FA-enabled account: server did not issue tokens yet.
    if (data?.twoFactorRequired) {
      return data as LoginResult;
    }
    setTokens(data.accessToken, data.refreshToken);
    try {
      const fullUser = await apiFetch<AuthUser>('/auth/me');
      setCurrentUser(fullUser);
      return { ...data, user: fullUser };
    } catch {
      setCurrentUser(data.user);
      return data;
    }
  },

  verifyTwoFactor: async (challengeId: string, code: string) => {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser; passwordExpired?: boolean }>(
      '/auth/2fa/verify',
      { method: 'POST', body: JSON.stringify({ challengeId, code }) },
    );
    setTokens(data.accessToken, data.refreshToken);
    try {
      const fullUser = await apiFetch<AuthUser>('/auth/me');
      setCurrentUser(fullUser);
      return { ...data, user: fullUser };
    } catch {
      setCurrentUser(data.user);
      return data;
    }
  },

  resendTwoFactor: (challengeId: string) =>
    apiFetch<{ challengeId: string; expiresAt: string }>(
      '/auth/2fa/resend',
      { method: 'POST', body: JSON.stringify({ challengeId }) },
    ),

  enableTwoFactor: () =>
    apiFetch<{ twoFactorEnabled: boolean }>('/auth/2fa/enable', { method: 'POST' }),

  disableTwoFactor: () =>
    apiFetch<{ twoFactorEnabled: boolean }>('/auth/2fa/disable', { method: 'POST' }),

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  refresh: async () => {
    await refreshAccessToken();
  },

  me: () => apiFetch<AuthUser>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  forgotPassword: (email: string, recaptchaToken?: string) =>
    apiFetch<void>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, recaptchaToken }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),

  activateAccount: (token: string, password: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: any }>(
      '/auth/activate',
      { method: 'POST', body: JSON.stringify({ token, password }) }
    ),

  adminResetPassword: (userId: string) =>
    apiFetch<void>(`/auth/admin/reset-password/${userId}`, { method: 'POST' }),

  resendActivation: (userId: string) =>
    apiFetch<void>(`/auth/resend-activation/${userId}`, { method: 'POST' }),
};

// ─── Employees API ───────────────────────────────────────────────────────────

export const employeesApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/employees${qs}`);
  },

  get: (id: string) => apiFetch<any>(`/employees/${id}`),

  create: (data: any) =>
    apiFetch<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    apiFetch<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  uploadPhoto: (id: string, file: File): Promise<any> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append('photo', file);
    return fetch(`${API_URL}/employees/${id}/photo`, {
      method: 'PATCH',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || 'Photo upload failed');
      }
      return res.json();
    });
  },

  delete: (id: string) =>
    apiFetch(`/employees/${id}`, { method: 'DELETE' }),

  updateStatus: (id: string, status: string) =>
    apiFetch<any>(`/employees/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getDocuments: (id: string) => apiFetch<any[]>(`/employees/${id}/documents`),

  getWorkflow: (id: string) => apiFetch<any>(`/employees/${id}/workflow`),

  getCompliance: (id: string) => apiFetch<any>(`/employees/${id}/compliance`),

  getCertifications: (id: string) => apiFetch<any[]>(`/employees/${id}/certifications`),

  getTraining: (id: string) => apiFetch<any[]>(`/employees/${id}/training`),

  getPerformance: (id: string) => apiFetch<any>(`/employees/${id}/performance`),

  // Banking/salary profile inherited from candidate stage (ApplicantFinancialProfile)
  getFinancialProfile: (id: string) => apiFetch<any>(`/employees/${id}/financial-profile`),

  // Per-employee agency-access grants (admin-only)
  listAgencyAccess: (id: string) =>
    apiFetch<any[]>(`/employees/${id}/agency-access`),
  grantAgencyAccess: (
    id: string,
    agencyId: string,
    opts: { notes?: string; canView?: boolean; canEdit?: boolean } = {},
  ) =>
    apiFetch<any>(`/employees/${id}/agency-access`, {
      method: 'POST',
      body: JSON.stringify({ agencyId, ...opts }),
    }),
  updateAgencyAccess: (
    id: string,
    agencyId: string,
    patch: { canView?: boolean; canEdit?: boolean; notes?: string },
  ) =>
    apiFetch<any>(`/employees/${id}/agency-access/${agencyId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  revokeAgencyAccess: (id: string, agencyId: string) =>
    apiFetch<any>(`/employees/${id}/agency-access/${agencyId}`, { method: 'DELETE' }),
};

// ─── Applicants API (includes merged Application methods) ────────────────────

export const applicantsApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/applicants${qs}`);
  },

  get: (id: string) => apiFetch<any>(`/applicants/${id}`),

  create: (data: any) =>
    apiFetch<any>('/applicants', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    apiFetch<any>(`/applicants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/applicants/${id}`, { method: 'DELETE' }),

  updateStatus: (id: string, status: string) =>
    apiFetch<any>(`/applicants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  setCurrentStage: (id: string, stageId: string | null) =>
    apiFetch<any>(`/applicants/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stageId }),
    }),

  convertLeadToCandidate: (id: string, data?: { agencyId?: string; notes?: string }) =>
    apiFetch<any>(`/applicants/${id}/convert-to-candidate`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  reassignAgency: (id: string, data: { agencyId: string; reason?: string; notes?: string }) =>
    apiFetch<any>(`/applicants/${id}/agency`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getFinancialProfile: (id: string) =>
    apiFetch<any>(`/applicants/${id}/financial`),

  upsertFinancialProfile: (id: string, data: any) =>
    apiFetch<any>(`/applicants/${id}/financial`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAgencyHistory: (id: string) =>
    apiFetch<any[]>(`/applicants/${id}/agency-history`),

  bulkAction: (data: { ids: string[]; action: string; value?: string }) =>
    apiFetch<any>('/applicants/bulk-action', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approve: (id: string) =>
    apiFetch<any>(`/applicants/${id}/approve`, { method: 'POST' }),

  reject: (id: string, reason?: string) =>
    apiFetch<any>(`/applicants/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  exportCsv: (params?: Record<string, any> & { ids?: string[] }) => {
    const search = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v == null || v === '') continue;
        if (k === 'ids' && Array.isArray(v)) {
          if (v.length > 0) search.set('ids', v.join(','));
          continue;
        }
        search.set(k, String(v));
      }
    }
    const qs = search.toString();
    return `${(import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1'}/applicants/export/csv${qs ? '?' + qs : ''}`;
  },

  convertToEmployee: (id: string, data: any) =>
    apiFetch<any>(`/applicants/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),

  uploadPhoto: (id: string, file: File): Promise<any> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append('photo', file);
    return fetch(`${API_URL}/applicants/${id}/photo`, {
      method: 'PATCH',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || 'Photo upload failed');
      }
      return res.json();
    });
  },

  requestDelete: (id: string, reason: string) =>
    apiFetch<any>(`/applicants/${id}/delete-request`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getDeleteRequests: (params?: any) =>
    apiFetch<any>(`/applicants/delete-requests?${new URLSearchParams(params || {})}`),

  reviewDeleteRequest: (requestId: string, status: 'APPROVED' | 'REJECTED', reviewNotes?: string) =>
    apiFetch<any>(`/applicants/delete-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status, reviewNotes }) }),
};

// ─── Public Application API ───────────────────────────────────────────────────
// No auth required - used by the public-facing driver application form
export const publicApplicationApi = {
  getFormSettings: () => apiFetch<Record<string, any>>('/settings/public/form'),

  /** Fetches active job categories without requiring auth (public endpoint). */
  getJobCategories: () =>
    fetch(`${API_URL}/settings/job-types`)
      .then(res => res.ok ? res.json() : [])
      .catch(() => []) as Promise<{ id: string; name: string }[]>,

  submit: (data: any) =>
    apiFetch<any>('/applicants/public/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadDocument: (applicantId: string, file: File, name: string, documentTypeName: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entityId', applicantId);
    form.append('name', name);
    form.append('documentTypeName', documentTypeName);
    return apiFetch<any>('/documents/public/upload', { method: 'POST', body: form });
  },
};

// ─── Documents API ───────────────────────────────────────────────────────────

export const documentsApi = {
  /**
   * List documents with full filter/sort support.
   * Supported params: page, limit, search, sortBy, sortOrder,
   *   status, documentTypeId, entityType, entityId,
   *   docId, documentNumber, issueDateFrom, issueDateTo,
   *   expiryDateFrom, expiryDateTo, uploadedById, verifiedById
   */
  list: (params?: Record<string, any>) => {
    const clean = params
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
      : {};
    const qs = Object.keys(clean).length ? '?' + new URLSearchParams(clean).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/documents${qs}`);
  },

  get: (id: string) => apiFetch<any>(`/documents/${id}`),

  upload: (formData: FormData) =>
    apiFetch<any>('/documents/upload', { method: 'POST', body: formData }),

  update: (id: string, data: any) =>
    apiFetch<any>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/documents/${id}`, { method: 'DELETE' }),

  verify: (id: string, data: any) =>
    apiFetch<any>(`/documents/${id}/verify`, { method: 'POST', body: JSON.stringify(data) }),

  /**
   * Renew a document — creates a new PENDING document linked to the original.
   * Pass a FormData if you want to upload a new file at the same time.
   * Pass a plain object (will be JSON-encoded) if no new file.
   */
  renew: (id: string, data: FormData | Record<string, any>) => {
    const isForm = data instanceof FormData;
    return apiFetch<any>(`/documents/${id}/renew`, {
      method: 'POST',
      body: isForm ? data : JSON.stringify(data),
      ...(isForm ? {} : {}),
    });
  },

  getByEntity: (entityType: string, entityId: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/documents/entity/${entityType}/${entityId}${qs}`);
  },

  getDashboard: () => apiFetch<any>('/documents/dashboard'),

  getDocTypePermissions: (documentTypeId: string) =>
    apiFetch<any[]>(`/documents/type-permissions/${documentTypeId}`),

  upsertDocTypePermission: (documentTypeId: string, roleId: string, perms: Record<string, boolean>) =>
    apiFetch<any>(`/documents/type-permissions/${documentTypeId}/${roleId}`, {
      method: 'POST', body: JSON.stringify(perms),
    }),

  /** Download multiple documents as a structured ZIP file. Returns a Blob. */
  bulkDownload: async (ids: string[]): Promise<Blob> => {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/documents/bulk-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message || 'Bulk download failed');
    }
    return res.blob();
  },
};

// ─── Employee Workflow API ────────────────────────────────────────────────────

export const employeeWorkflowApi = {
  getStages: () => apiFetch<any[]>('/workflow/stages'),

  getStageDetails: (stageId: string) => apiFetch<any>(`/workflow/stages/${stageId}/people`),

  getOverview: () => apiFetch<any>('/workflow/overview'),

  getAnalytics: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/workflow/analytics${qs}`);
  },

  updateEmployeeStage: (employeeId: string, data: any) =>
    apiFetch<any>(`/workflow/employees/${employeeId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  setEmployeeCurrentStage: (employeeId: string, stageId: string) =>
    apiFetch<any>(`/workflow/employees/${employeeId}/current-stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stageId }),
    }),

  getTimeline: (employeeId: string) =>
    apiFetch<any[]>(`/workflow/timeline/${employeeId}`),

  // Work Permits
  listWorkPermits: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/workflow/work-permits${qs}`);
  },

  createWorkPermit: (data: any) =>
    apiFetch<any>('/workflow/work-permits', { method: 'POST', body: JSON.stringify(data) }),

  updateWorkPermit: (id: string, data: any) =>
    apiFetch<any>(`/workflow/work-permits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Visas
  listVisas: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/workflow/visas${qs}`);
  },

  createVisa: (data: any) =>
    apiFetch<any>('/workflow/visas', { method: 'POST', body: JSON.stringify(data) }),

  updateVisa: (id: string, data: any) =>
    apiFetch<any>(`/workflow/visas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Agencies API ─────────────────────────────────────────────────────────────

export const agenciesApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/agencies${qs}`);
  },

  get: (id: string) => apiFetch<any>(`/agencies/${id}`),

  create: (data: any) =>
    apiFetch<any>('/agencies', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    apiFetch<any>(`/agencies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/agencies/${id}`, { method: 'DELETE' }),

  getUsers: (id: string) => apiFetch<any[]>(`/agencies/${id}/users`),

  getEmployees: (id: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/agencies/${id}/employees${qs}`);
  },

  getStats: (id: string) => apiFetch<any>(`/agencies/${id}/stats`),

  listPublic: () => apiFetch<{ id: string; name: string }[]>('/agencies/public'),

  // Agency-wide permission overrides (admin-only)
  listPermissionOverrides: (id: string) =>
    apiFetch<any[]>(`/agencies/${id}/permission-overrides`),
  setPermissionOverride: (id: string, permission: string, allow: boolean) =>
    apiFetch<any>(`/agencies/${id}/permission-overrides`, { method: 'POST', body: JSON.stringify({ permission, allow }) }),
  removePermissionOverride: (id: string, permission: string) =>
    apiFetch<any>(`/agencies/${id}/permission-overrides/${encodeURIComponent(permission)}`, { method: 'DELETE' }),

  setManager: (agencyId: string, userId: string) =>
    apiFetch<any>(`/agencies/${agencyId}/manager`, { method: 'PATCH', body: JSON.stringify({ userId }) }),

  uploadLogo: (id: string, file: File): Promise<any> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append('logo', file);
    return fetch(`${API_URL}/agencies/${id}/logo`, {
      method: 'PATCH',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || 'Logo upload failed');
      }
      return res.json();
    });
  },
};

// ─── Compliance API ───────────────────────────────────────────────────────────

export const complianceApi = {
  getDashboard: () => apiFetch<any>('/compliance/dashboard'),

  getAlerts: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/compliance/alerts${qs}`);
  },

  updateAlert: (id: string, data: any) =>
    apiFetch<any>(`/compliance/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getEmployeeCompliance: (id: string) =>
    apiFetch<any>(`/compliance/employees/${id}`),

  getExpiringDocuments: (days?: number) => {
    const qs = days ? `?days=${days}` : '';
    return apiFetch<any[]>(`/compliance/expiring-documents${qs}`);
  },
};

// ─── Reports API ──────────────────────────────────────────────────────────────

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/notifications${qs}`);
  },

  getUnreadCount: () => apiFetch<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch('/notifications/mark-all-read', { method: 'POST' }),

  delete: (id: string) =>
    apiFetch(`/notifications/${id}`, { method: 'DELETE' }),

  getPreferences: () => apiFetch<any>('/notifications/preferences'),

  updatePreferences: (preferences: Record<string, { in_app: boolean; email: boolean; sms: boolean }>) =>
    apiFetch<any>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),

  getEventTypes: () => apiFetch<any[]>('/notifications/event-types'),
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/users${qs}`);
  },

  get: (id: string) => apiFetch<any>(`/users/${id}`),

  me: () => apiFetch<any>('/users/me'),

  create: (data: any) =>
    apiFetch<any>('/users', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    apiFetch<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/users/${id}`, { method: 'DELETE' }),

  updateProfile: (data: any) =>
    apiFetch<any>('/users/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  updatePreferences: (data: any) =>
    apiFetch<any>('/users/preferences', { method: 'PATCH', body: JSON.stringify(data) }),

  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const token = localStorage.getItem('access_token');
    return fetch(`${API_URL}/users/${id}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || 'Upload failed');
      return data;
    });
  },

  uploadOwnPhoto: (file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const token = localStorage.getItem('access_token');
    return fetch(`${API_URL}/users/me/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || 'Upload failed');
      return data;
    });
  },

  unlockUser: (id: string) =>
    apiFetch<any>(`/users/${id}/unlock`, { method: 'POST' }),

  setPermissionOverride: (id: string, permission: string, granted: boolean) =>
    apiFetch<any>(`/users/${id}/permissions`, { method: 'POST', body: JSON.stringify({ permission, granted }) }),

  getUserPermissions: (id: string) =>
    apiFetch<any>(`/users/${id}/permissions`),

  bulkImport: (records: any[]) =>
    apiFetch<any>('/users/bulk-import', { method: 'POST', body: JSON.stringify({ records }) }),

  bulkExport: (params?: any) =>
    apiFetch<any[]>(`/users/bulk-export?${new URLSearchParams(params || {})}`),

  getActivationLink: (id: string) =>
    apiFetch<{ url: string }>(`/users/${id}/activation-link`),

  approveAgencyUser: (id: string) =>
    apiFetch<any>(`/users/${id}/approve`, { method: 'POST' }),

  setManagerOverride: (
    id: string,
    flags: { allowManagerView?: boolean; allowManagerEdit?: boolean; allowManagerDelete?: boolean },
  ) =>
    apiFetch<any>(`/users/${id}/manager-override`, { method: 'POST', body: JSON.stringify(flags) }),
};

// ─── Roles API ────────────────────────────────────────────────────────────────

export const rolesApi = {
  list: () => apiFetch<any[]>('/roles'),

  get: (id: string) => apiFetch<any>(`/roles/${id}`),

  create: (data: any) =>
    apiFetch<any>('/roles', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    apiFetch<any>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/roles/${id}`, { method: 'DELETE' }),

  getPermissions: () => apiFetch<any[]>('/roles/permissions'),

  getPermissionsMatrix: () => apiFetch<any>('/roles/permissions-matrix'),
};

// ─── Settings API ─────────────────────────────────────────────────────────────

export const settingsApi = {
  getAll: (includePrivate = false) => apiFetch<any>(`/settings${includePrivate ? '?includePrivate=true' : ''}`),

  update: (data: Record<string, any>) =>
    apiFetch<any>('/settings', { method: 'PATCH', body: JSON.stringify({ settings: data }) }),

  // Job Types
  getJobTypes: () => apiFetch<any[]>('/settings/job-types'),
  createJobType: (data: any) =>
    apiFetch<any>('/settings/job-types', { method: 'POST', body: JSON.stringify(data) }),
  updateJobType: (id: string, data: any) =>
    apiFetch<any>(`/settings/job-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJobType: (id: string) =>
    apiFetch(`/settings/job-types/${id}`, { method: 'DELETE' }),

  // Document Types
  getDocumentTypes: () => apiFetch<any[]>('/settings/document-types'),
  getDocumentType: (id: string) => apiFetch<any>(`/settings/document-types/${id}`),
  createDocumentType: (data: any) =>
    apiFetch<any>('/settings/document-types', { method: 'POST', body: JSON.stringify(data) }),
  updateDocumentType: (id: string, data: any) =>
    apiFetch<any>(`/settings/document-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDocumentType: (id: string) =>
    apiFetch(`/settings/document-types/${id}`, { method: 'DELETE' }),

  // Workflow Stages
  getWorkflowStages: () => apiFetch<any[]>('/settings/workflow-stages'),
  createWorkflowStage: (data: any) =>
    apiFetch<any>('/settings/workflow-stages', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflowStage: (id: string, data: any) =>
    apiFetch<any>(`/settings/workflow-stages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWorkflowStage: (id: string) =>
    apiFetch(`/settings/workflow-stages/${id}`, { method: 'DELETE' }),
  reorderWorkflowStages: (orders: { id: string; order: number }[]) =>
    apiFetch<any>('/settings/workflow-stages/reorder', { method: 'PATCH', body: JSON.stringify({ orders }) }),

  // Branding
  getBranding: () => apiFetch<{ companyName?: string; logoUrl?: string }>('/settings/branding'),
  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    const token = localStorage.getItem('access_token') ?? '';
    const res = await fetch(`${API_URL}/settings/branding/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || 'Upload failed');
    }
    return res.json() as Promise<{ logoUrl: string }>;
  },

  // Notification Rules
  getNotificationRules: () => apiFetch<any[]>('/settings/notification-rules'),
  createNotificationRule: (data: any) =>
    apiFetch<any>('/settings/notification-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateNotificationRule: (id: string, data: any) =>
    apiFetch<any>(`/settings/notification-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteNotificationRule: (id: string) =>
    apiFetch(`/settings/notification-rules/${id}`, { method: 'DELETE' }),
};

// ─── Logs API ─────────────────────────────────────────────────────────────────

export const logsApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/logs${qs}`);
  },

  getStats: () => apiFetch<any>('/logs/stats'),

  clearLogs: (filters?: { fromDate?: string; toDate?: string; entity?: string }) => {
    const qs = filters ? '?' + new URLSearchParams(Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v != null),
    )).toString() : '';
    return apiFetch<{ deleted: number; message: string }>(`/logs${qs}`, { method: 'DELETE' });
  },

  deleteOne: (id: string) =>
    apiFetch<{ message: string }>(`/logs/${id}`, { method: 'DELETE' }),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardApi = {
  /** Returns fully-enriched dashboard payload (employees, applicants, documents, pipeline, recent lists) */
  getOverview: () => apiFetch<any>('/reports/dashboard'),
  // Legacy alias kept for backward compatibility
  getStats: () => apiFetch<any>('/reports/dashboard'),
};

// ─── Dynamic Reports API ──────────────────────────────────────────────────────

export const reportsApi = {
  // Schema
  getDataSources: () => apiFetch<any[]>('/reports/data-sources'),
  getDashboard: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/reports/dashboard${qs}`);
  },

  getEmployees: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/reports/employees${qs}`);
  },

  getApplications: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/reports/applications${qs}`);
  },

  getDocuments: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/reports/documents${qs}`);
  },

  getCompliance: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/reports/compliance${qs}`);
  },

  // CRUD
  list:   ()                          => apiFetch<any[]>('/reports'),
  get:    (id: string)                => apiFetch<any>(`/reports/${id}`),
  create: (data: any)                 => apiFetch<any>('/reports',      { method: 'POST',   body: JSON.stringify(data) }),
  update: (id: string, data: any)     => apiFetch<any>(`/reports/${id}`,{ method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id: string)                => apiFetch<any>(`/reports/${id}`,{ method: 'DELETE' }),

  // Run
  run: (id: string, opts?: { page?: number; limit?: number }) =>
    apiFetch<any>(`/reports/${id}/run`, { method: 'POST', body: JSON.stringify(opts ?? {}) }),

  // Export — returns a Blob
  export: async (id: string, format: 'excel' | 'pdf' | 'word'): Promise<Blob> => {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/reports/${id}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ format }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message || 'Export failed');
    }
    return res.blob();
  },
};

// ─── Finance API ──────────────────────────────────────────────────────────────

export const financeApi = {
  // Constants (transaction types, payment methods, currencies, statuses)
  getConstants: () => apiFetch<any>('/finance/constants'),

  // List / filter records (global or per-entity)
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/finance${qs}`);
  },

  // Totals for a specific entity (current stage only)
  getTotals: (entityType: string, entityId: string) =>
    apiFetch<any>(`/finance/totals/${entityType}/${entityId}`),

  // All financial records + totals for a person across ALL lifecycle stages
  // Uses stable applicantId — works whether person is Lead/Candidate or Employee
  getPersonRecords: (applicantId: string) =>
    apiFetch<any>(`/finance/person/${applicantId}`),

  // Single record
  get: (id: string) => apiFetch<any>(`/finance/${id}`),

  // Create a new financial record
  create: (data: Record<string, any>) =>
    apiFetch<any>('/finance', { method: 'POST', body: JSON.stringify(data) }),

  // Update a record
  update: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/finance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Update status (mark as DEDUCTED + deduction details)
  updateStatus: (id: string, data: { status: string; deductionAmount?: number; deductionDate?: string; payrollReference?: string }) =>
    apiFetch<any>(`/finance/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Soft-delete a record
  delete: (id: string) =>
    apiFetch<any>(`/finance/${id}`, { method: 'DELETE' }),

  // Upload attachment to a record
  addAttachment: (recordId: string, formData: FormData) => {
    const token = getAccessToken();
    return fetch(`${API_URL}/finance/${recordId}/attachments`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || 'Upload failed');
      }
      return res.json();
    });
  },

  // Remove an attachment
  removeAttachment: (recordId: string, attachmentId: string) =>
    apiFetch<any>(`/finance/${recordId}/attachments/${attachmentId}`, { method: 'DELETE' }),

  // Export to Excel — returns Blob
  exportExcel: async (params?: Record<string, any>): Promise<Blob> => {
    const token = getAccessToken();
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString() : '';
    const res = await fetch(`${API_URL}/finance/export${qs}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message || 'Export failed');
    }
    return res.blob();
  },
};

// ─── Job Ads API (Dashboard — authenticated) ──────────────────────────────────

export const jobAdsApi = {
  // Constants (statuses, categories, contract types, currencies)
  getConstants: () => apiFetch<any>('/job-ads/constants'),

  // List / filter (paginated)
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/job-ads${qs}`);
  },

  // Single by ID
  get: (id: string) => apiFetch<any>(`/job-ads/${id}`),

  // Create
  create: (data: Record<string, any>) =>
    apiFetch<any>('/job-ads', { method: 'POST', body: JSON.stringify(data) }),

  // Update (partial)
  update: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/job-ads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Soft-delete
  delete: (id: string) =>
    apiFetch<any>(`/job-ads/${id}`, { method: 'DELETE' }),
};

// ─── Public Job Ads API (no auth required) ────────────────────────────────────

export const publicJobAdsApi = {
  // List published listings
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString() : '';
    return fetch(`${API_URL}/public/jobs${qs}`).then(async res => {
      if (!res.ok) throw new Error('Failed to load job listings');
      return res.json() as Promise<PaginatedResponse<any>>;
    });
  },

  // Single by slug
  getBySlug: (slug: string) =>
    fetch(`${API_URL}/public/jobs/${slug}`).then(async res => {
      if (!res.ok) throw new Error('Job listing not found');
      return res.json() as Promise<any>;
    }),
};

// ─── Recycle Bin API ──────────────────────────────────────────────────────────

export const recycleBinApi = {
  // List deleted records (paginated, filterable)
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString() : '';
    return apiFetch<PaginatedResponse<any>>(`/recycle-bin${qs}`);
  },

  // Count per entity type
  getCounts: () => apiFetch<Record<string, number>>('/recycle-bin/counts'),

  // Related deleted records for a specific entity
  getRelated: (entityType: string, id: string) =>
    apiFetch<any>(`/recycle-bin/${entityType}/${id}/related`),

  // Preview what hard-delete will remove
  previewHardDelete: (entityType: string, id: string) =>
    apiFetch<any>(`/recycle-bin/${entityType}/${id}/preview-hard-delete`),

  // Restore a record (optionally with related)
  restore: (entityType: string, id: string, data: { withRelated?: boolean; reason?: string }) =>
    apiFetch<any>(`/recycle-bin/${entityType}/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Permanently hard-delete a record
  hardDelete: (entityType: string, id: string, data: { reason?: string }) =>
    apiFetch<any>(`/recycle-bin/${entityType}/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  // Database cleanup
  cleanupPreview: () => apiFetch<any>('/recycle-bin/cleanup/preview'),

  cleanupExecute: (data: { confirmPhrase: string; reason?: string; clearAuditLogs?: boolean }) =>
    apiFetch<any>('/recycle-bin/cleanup/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Workflow API ──────────────────────────────────────────────────────────────

export const workflowApi = {
  // Workflows
  list: (includeArchived = false) =>
    apiFetch<any[]>(`/workflows${includeArchived ? '?includeArchived=true' : ''}`),

  get: (id: string) => apiFetch<any>(`/workflows/${id}`),

  board: (id: string) => apiFetch<any>(`/workflows/${id}/board`),

  candidates: (id: string) => apiFetch<any[]>(`/workflows/${id}/candidates`),

  stats: (id: string) => apiFetch<any>(`/workflows/${id}/stats`),

  create: (data: { name: string; description?: string; isDefault?: boolean; isPublic?: boolean; color?: string }) =>
    apiFetch<any>('/workflows', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{ name: string; description: string; isDefault: boolean; isPublic: boolean; color: string }>) =>
    apiFetch<any>(`/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  archive: (id: string) =>
    apiFetch<any>(`/workflows/${id}/archive`, { method: 'PATCH' }),

  delete: (id: string) =>
    apiFetch<any>(`/workflows/${id}`, { method: 'DELETE' }),

  // Stages
  addStage: (workflowId: string, data: any) =>
    apiFetch<any>(`/workflows/${workflowId}/stages`, { method: 'POST', body: JSON.stringify(data) }),

  getWorkflowStageDetails: (stageId: string) =>
    apiFetch<any>(`/workflows/stages/${stageId}/details`),

  updateStage: (stageId: string, data: any) =>
    apiFetch<any>(`/workflows/stages/${stageId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteStage: (stageId: string) =>
    apiFetch<any>(`/workflows/stages/${stageId}`, { method: 'DELETE' }),

  reorderStages: (workflowId: string, orderedIds: string[]) =>
    apiFetch<any>(`/workflows/${workflowId}/stages/reorder`, { method: 'PATCH', body: JSON.stringify({ orderedIds }) }),

  // Assignments
  assignCandidate: (data: { candidateId: string; workflowId: string; notes?: string }) =>
    apiFetch<any>('/workflows/assign', { method: 'POST', body: JSON.stringify(data) }),

  getCandidateAssignments: (candidateId: string) =>
    apiFetch<any[]>(`/workflows/candidate/${candidateId}/assignments`),

  removeCandidateAssignment: (candidateId: string, assignmentId: string) =>
    apiFetch<any>(`/workflows/candidate/${candidateId}/assignments/${assignmentId}`, { method: 'DELETE' }),

  // Employee assignments
  assignEmployee: (data: { employeeId: string; workflowId: string; notes?: string }) =>
    apiFetch<any>('/workflows/assign-employee', { method: 'POST', body: JSON.stringify(data) }),

  getEmployeeAssignment: (employeeId: string) =>
    apiFetch<any>(`/workflows/employee/${employeeId}/assignments`),

  setEmployeeCurrentStage: (employeeId: string, stageId: string) =>
    apiFetch<any>(`/workflows/employee/${employeeId}/current-stage`, { method: 'PATCH', body: JSON.stringify({ stageId }) }),

  approveEmployeeStage: (employeeId: string, stageId: string, notes?: string) =>
    apiFetch<any>(`/workflows/employee/${employeeId}/stages/${stageId}/approve`, { method: 'POST', body: JSON.stringify({ notes }) }),

  removeEmployeeAssignment: (employeeId: string, workflowId: string) =>
    apiFetch<any>(`/workflows/employee/${employeeId}/assignments/${workflowId}`, { method: 'DELETE' }),

  // Progress
  advanceToStage: (assignmentId: string, stageId: string) =>
    apiFetch<any>(`/workflows/assignments/${assignmentId}/advance`, { method: 'POST', body: JSON.stringify({ stageId }) }),

  updateProgress: (progressId: string, data: { status: string; flagged?: boolean; flagReason?: string }) =>
    apiFetch<any>(`/workflows/progress/${progressId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Notes
  addNote: (progressId: string, data: { content: string; isPrivate?: boolean }) =>
    apiFetch<any>(`/workflows/progress/${progressId}/notes`, { method: 'POST', body: JSON.stringify(data) }),

  deleteNote: (noteId: string) =>
    apiFetch<any>(`/workflows/notes/${noteId}`, { method: 'DELETE' }),

  // Approvals
  submitApproval: (progressId: string, data: { decision: 'APPROVED' | 'REJECTED'; notes?: string }) =>
    apiFetch<any>(`/workflows/progress/${progressId}/approve`, { method: 'POST', body: JSON.stringify(data) }),
};

// ── Attendance API ─────────────────────────────────────────────────────────────

export const attendanceApi = {
  /**
   * List employees with their aggregated attendance stats for the given month/year.
   * Returns paginated { data: [...], meta: { total, page, limit, totalPages } }
   */
  listEmployees: (params: {
    page?: number;
    limit?: number;
    search?: string;
    month?: number;
    year?: number;
    status?: string;
    driversOnly?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page != null) qs.set('page', String(params.page));
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.month != null) qs.set('month', String(params.month));
    if (params.year != null) qs.set('year', String(params.year));
    if (params.status) qs.set('status', params.status);
    if (params.driversOnly != null) qs.set('driversOnly', String(params.driversOnly));
    return apiFetch<any>(`/attendance/employees?${qs.toString()}`);
  },

  /**
   * Get a single employee's attendance records + summary for the given month/year.
   */
  getEmployeeAttendance: (employeeId: string | undefined, params: { month: number; year: number }) => {
    const qs = new URLSearchParams({
      month: String(params.month),
      year: String(params.year),
    });
    return apiFetch<any>(`/attendance/employees/${employeeId}?${qs.toString()}`);
  },

  /**
   * Create a new attendance record (upsert by employeeId + date).
   */
  upsert: (data: {
    employeeId: string | undefined;
    date: string;
    status: string;
    checkIn?: string;
    checkOut?: string;
    workingHours?: number | string;
    notes?: string;
  }) => apiFetch<any>('/attendance', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * Update an existing attendance record by id.
   */
  update: (recordId: string, data: {
    status?: string;
    checkIn?: string;
    checkOut?: string;
    workingHours?: number | string;
    notes?: string;
  }) => apiFetch<any>(`/attendance/${recordId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  /**
   * Delete an attendance record by id.
   */
  delete: (recordId: string) =>
    apiFetch<any>(`/attendance/${recordId}`, { method: 'DELETE' }),

  /**
   * Export the attendance sheet as an Excel file.
   * Returns a Blob suitable for createObjectURL.
   */
  exportExcel: async (params: { month: number; year: number; driversOnly?: boolean }): Promise<Blob> => {
    const token = getAccessToken();
    const qs = new URLSearchParams({
      month: String(params.month),
      year: String(params.year),
      driversOnly: String(params.driversOnly ?? false),
    });
    const res = await fetch(`${API_URL}/attendance/export/excel?${qs.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};

// ─── Vehicles API ─────────────────────────────────────────────────────────────

export const vehiclesApi = {
  // Vehicles
  list: (params: {
    page?: number; limit?: number; search?: string; type?: string;
    status?: string; agencyId?: string; expiringInDays?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    return apiFetch<any>(`/vehicles?${qs.toString()}`);
  },

  getOne: (id: string) => apiFetch<any>(`/vehicles/${id}`),

  create: (data: {
    type: string; registrationNumber: string; make: string; model: string;
    status?: string; year?: number; color?: string; vin?: string; fuelType?: string;
    currentMileage?: number; notes?: string; motExpiryDate?: string; taxExpiryDate?: string;
    insuranceExpiryDate?: string; grossWeight?: number; payloadCapacity?: number;
    numberOfAxles?: number; tankerCapacity?: number; refrigerationUnit?: string;
    trailerLength?: number; agencyId?: string;
  }) => apiFetch<any>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch<any>(`/vehicles/${id}`, { method: 'DELETE' }),

  getStats: () => apiFetch<any>('/vehicles/stats'),

  // Driver assignments
  getDriverHistory: (vehicleId: string) => apiFetch<any>(`/vehicles/${vehicleId}/drivers`),

  assignDriver: (vehicleId: string, data: { employeeId: string; startDate: string; notes?: string }) =>
    apiFetch<any>(`/vehicles/${vehicleId}/drivers`, { method: 'POST', body: JSON.stringify(data) }),

  unassignDriver: (vehicleId: string, assignmentId: string) =>
    apiFetch<any>(`/vehicles/${vehicleId}/drivers/${assignmentId}`, { method: 'DELETE' }),

  // Documents
  addDocument: (vehicleId: string, data: {
    name: string; documentType: string; expiryDate?: string; issuedDate?: string; issuer?: string; notes?: string;
  }, file?: File) => {
    const form = new FormData();
    form.append('name', data.name);
    form.append('documentType', data.documentType);
    if (data.expiryDate) form.append('expiryDate', data.expiryDate);
    if (data.issuedDate) form.append('issuedDate', data.issuedDate);
    if (data.issuer)     form.append('issuer', data.issuer);
    if (data.notes)      form.append('notes', data.notes);
    if (file)            form.append('file', file);
    return apiFetch<any>(`/vehicles/${vehicleId}/documents`, { method: 'POST', body: form });
  },

  updateDocument: (vehicleId: string, docId: string, data: Record<string, any>) =>
    apiFetch<any>(`/vehicles/${vehicleId}/documents/${docId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDocument: (vehicleId: string, docId: string) =>
    apiFetch<any>(`/vehicles/${vehicleId}/documents/${docId}`, { method: 'DELETE' }),

  // Maintenance types
  listMaintenanceTypes: () => apiFetch<any>('/vehicles/maintenance/types'),

  createMaintenanceType: (data: { name: string; description?: string; defaultIntervalDays?: number; defaultIntervalKm?: number }) =>
    apiFetch<any>('/vehicles/maintenance/types', { method: 'POST', body: JSON.stringify(data) }),

  updateMaintenanceType: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/vehicles/maintenance/types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMaintenanceType: (id: string) =>
    apiFetch<any>(`/vehicles/maintenance/types/${id}`, { method: 'DELETE' }),

  // Workshops
  listWorkshops: () => apiFetch<any>('/vehicles/workshops'),

  getWorkshop: (id: string) => apiFetch<any>(`/vehicles/workshops/${id}`),

  createWorkshop: (data: {
    name: string; contactName?: string; phone?: string; email?: string;
    address?: string; city?: string; country?: string; notes?: string;
  }) => apiFetch<any>('/vehicles/workshops', { method: 'POST', body: JSON.stringify(data) }),

  updateWorkshop: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/vehicles/workshops/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteWorkshop: (id: string) =>
    apiFetch<any>(`/vehicles/workshops/${id}`, { method: 'DELETE' }),

  // Maintenance records
  listMaintenance: (params: {
    page?: number; limit?: number; vehicleId?: string; status?: string; dateFrom?: string; dateTo?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    return apiFetch<any>(`/vehicles/maintenance/records?${qs.toString()}`);
  },

  getMaintenance: (id: string) => apiFetch<any>(`/vehicles/maintenance/records/${id}`),

  createMaintenance: (data: Record<string, any>) =>
    apiFetch<any>('/vehicles/maintenance/records', { method: 'POST', body: JSON.stringify(data) }),

  updateMaintenance: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/vehicles/maintenance/records/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMaintenance: (id: string) =>
    apiFetch<any>(`/vehicles/maintenance/records/${id}`, { method: 'DELETE' }),

  // Export
  exportExcel: async (params: { type?: string; status?: string } = {}): Promise<Blob> => {
    const token = getAccessToken();
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    const res = await fetch(`${API_URL}/vehicles/export/excel?${qs.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};

// ── Backup & Restore API ───────────────────────────────────────────────────────

export const backupApi = {
  /** List all backups (paginated) */
  list: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page   != null) qs.set('page',   String(params.page));
    if (params.limit  != null) qs.set('limit',  String(params.limit));
    if (params.search)         qs.set('search', params.search);
    if (params.status)         qs.set('status', params.status);
    return apiFetch<any>(`/backup?${qs.toString()}`);
  },

  /** Get single backup */
  get: (id: string) => apiFetch<any>(`/backup/${id}`),

  /** Check if a backup/restore operation is running */
  status: () => apiFetch<{ locked: boolean }>('/backup/status'),

  /** Preview/validate before restore */
  preview: (id: string) => apiFetch<any>(`/backup/${id}/preview`),

  /** Create a new backup */
  create: (data: { notes?: string }) =>
    apiFetch<any>('/backup', { method: 'POST', body: JSON.stringify(data) }),

  /** Download backup file as Blob */
  download: async (id: string, fileName: string): Promise<void> => {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/backup/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Restore from a backup */
  restore: (
    id: string,
    data: {
      restoreMode: string;
      confirmPhrase: string;
      notes?: string;
      skipSafetyBackup?: boolean;
    },
  ) => apiFetch<any>(`/backup/${id}/restore`, { method: 'POST', body: JSON.stringify(data) }),

  /** Delete a backup */
  delete: (id: string) => apiFetch<any>(`/backup/${id}`, { method: 'DELETE' }),
};
