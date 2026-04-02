// Central API client for TempWorks backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

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
  permissions?: string[];
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

  return response.json();
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    setTokens(data.accessToken, data.refreshToken);
    // Fetch full profile including permissions
    try {
      const fullUser = await apiFetch<AuthUser>('/auth/me');
      setCurrentUser(fullUser);
      return { ...data, user: fullUser };
    } catch {
      setCurrentUser(data.user);
      return data;
    }
  },

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

  forgotPassword: (email: string) =>
    apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
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

  exportCsv: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return `${(import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1'}/applicants/export/csv${qs}`;
  },

  convertToEmployee: (id: string, data: any) =>
    apiFetch<any>(`/applicants/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Public Application API ───────────────────────────────────────────────────
// No auth required - used by the public-facing driver application form
export const publicApplicationApi = {
  getFormSettings: () => apiFetch<Record<string, any>>('/settings/public/form'),

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
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
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
    apiFetch<any>(`/documents/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getByEntity: (entityType: string, entityId: string) =>
    apiFetch<any[]>(`/documents/entity/${entityType}/${entityId}?limit=500`),

  getDashboard: () => apiFetch<any>('/documents/dashboard'),

  /** Download multiple documents as a structured ZIP file. Returns a Blob. */
  bulkDownload: async (ids: string[]): Promise<Blob> => {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/documents/bulk-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message || 'Bulk download failed');
    }
    return res.blob();
  },
};

// ─── Workflow API ─────────────────────────────────────────────────────────────

export const workflowApi = {
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
    apiFetch<any>('/users/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
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

  // Totals for a specific person
  getTotals: (entityType: string, entityId: string) =>
    apiFetch<any>(`/finance/totals/${entityType}/${entityId}`),

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
