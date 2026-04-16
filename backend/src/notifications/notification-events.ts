/**
 * Notification Event Type constants.
 *
 * Each value is stored as a plain string in `Notification.eventType`.
 * The NotificationType enum (Prisma) maps events to display categories.
 */

// ── Event type keys ──────────────────────────────────────────────────────────

export const NOTIF_EVENTS = {
  // Documents
  DOCUMENT_UPLOADED:       'DOCUMENT_UPLOADED',
  DOCUMENT_EXPIRING_SOON:  'DOCUMENT_EXPIRING_SOON',
  DOCUMENT_EXPIRED:        'DOCUMENT_EXPIRED',

  // Financial
  FINANCIAL_RECORD_CREATED:  'FINANCIAL_RECORD_CREATED',
  FINANCIAL_RECORD_UPDATED:  'FINANCIAL_RECORD_UPDATED',
  FINANCIAL_RECORD_DELETED:  'FINANCIAL_RECORD_DELETED',
  FINANCIAL_RECORD_DEDUCTED: 'FINANCIAL_RECORD_DEDUCTED',
  FINANCIAL_HIGH_BALANCE:    'FINANCIAL_HIGH_BALANCE',
} as const;

export type NotifEventKey = typeof NOTIF_EVENTS[keyof typeof NOTIF_EVENTS];

// ── Prisma NotificationType per event ────────────────────────────────────────

export const EVENT_TO_TYPE: Record<NotifEventKey, string> = {
  DOCUMENT_UPLOADED:        'DOCUMENT_EXPIRY',   // re-use closest category
  DOCUMENT_EXPIRING_SOON:   'DOCUMENT_EXPIRY',
  DOCUMENT_EXPIRED:         'DOCUMENT_EXPIRY',
  FINANCIAL_RECORD_CREATED: 'FINANCIAL',
  FINANCIAL_RECORD_UPDATED: 'FINANCIAL',
  FINANCIAL_RECORD_DELETED: 'FINANCIAL',
  FINANCIAL_RECORD_DEDUCTED:'FINANCIAL',
  FINANCIAL_HIGH_BALANCE:   'WARNING',
};

// ── Human-readable labels for the settings matrix ───────────────────────────

export interface NotifEventMeta {
  key:         NotifEventKey;
  label:       string;
  description: string;
  category:    'Documents' | 'Financial';
  defaultInApp:  boolean;
  defaultEmail:  boolean;
}

export const NOTIF_EVENT_META: NotifEventMeta[] = [
  {
    key:         NOTIF_EVENTS.DOCUMENT_UPLOADED,
    label:       'New Document Uploaded',
    description: 'When a document is uploaded to any profile',
    category:    'Documents',
    defaultInApp:  true,
    defaultEmail:  false,
  },
  {
    key:         NOTIF_EVENTS.DOCUMENT_EXPIRING_SOON,
    label:       'Document Expiring Soon',
    description: 'When a document will expire within 30 days',
    category:    'Documents',
    defaultInApp:  true,
    defaultEmail:  true,
  },
  {
    key:         NOTIF_EVENTS.DOCUMENT_EXPIRED,
    label:       'Document Expired',
    description: 'When a document has passed its expiry date',
    category:    'Documents',
    defaultInApp:  true,
    defaultEmail:  true,
  },
  {
    key:         NOTIF_EVENTS.FINANCIAL_RECORD_CREATED,
    label:       'Financial Record Added',
    description: 'When a new financial record is created for any profile',
    category:    'Financial',
    defaultInApp:  true,
    defaultEmail:  false,
  },
  {
    key:         NOTIF_EVENTS.FINANCIAL_RECORD_UPDATED,
    label:       'Financial Record Edited',
    description: 'When an existing financial record is modified',
    category:    'Financial',
    defaultInApp:  true,
    defaultEmail:  false,
  },
  {
    key:         NOTIF_EVENTS.FINANCIAL_RECORD_DELETED,
    label:       'Financial Record Deleted',
    description: 'When a financial record is removed',
    category:    'Financial',
    defaultInApp:  true,
    defaultEmail:  false,
  },
  {
    key:         NOTIF_EVENTS.FINANCIAL_RECORD_DEDUCTED,
    label:       'Record Marked for Deduction',
    description: 'When a financial record status is changed to Deducted',
    category:    'Financial',
    defaultInApp:  true,
    defaultEmail:  true,
  },
  {
    key:         NOTIF_EVENTS.FINANCIAL_HIGH_BALANCE,
    label:       'High Balance Alert',
    description: 'When a profile\'s outstanding balance exceeds the threshold (default 500)',
    category:    'Financial',
    defaultInApp:  true,
    defaultEmail:  true,
  },
];

// ── Default preferences (used when user has no saved prefs) ─────────────────

export type ChannelPrefs = { in_app: boolean; email: boolean; sms: boolean };
export type UserNotifPrefs = Record<NotifEventKey, ChannelPrefs>;

export function getDefaultPrefs(): UserNotifPrefs {
  const prefs = {} as UserNotifPrefs;
  for (const meta of NOTIF_EVENT_META) {
    prefs[meta.key] = {
      in_app: meta.defaultInApp,
      email:  meta.defaultEmail,
      sms:    false,  // Future feature — always disabled
    };
  }
  return prefs;
}

/**
 * Merge saved user prefs with defaults so new event types have sensible values.
 */
export function mergeWithDefaults(saved: Partial<UserNotifPrefs> | null): UserNotifPrefs {
  const defaults = getDefaultPrefs();
  if (!saved) return defaults;
  const result = { ...defaults } as UserNotifPrefs;
  for (const key of Object.keys(saved) as NotifEventKey[]) {
    if (result[key] !== undefined && saved[key] !== undefined) {
      result[key] = { ...result[key], ...saved[key], sms: false };
    }
  }
  return result;
}
