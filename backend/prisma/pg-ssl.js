'use strict';
// CommonJS twin of pg-ssl.ts so plain-JavaScript files (seed.js and any
// other scripts that cannot go through ts-node) can share the same logic.
// Keep the switch in sync with pg-ssl.ts.

/**
 * Parse the `sslmode` query parameter from a PostgreSQL connection URL and
 * return the corresponding node-pg SSL config. See pg-ssl.ts for the full
 * documentation of the supported modes.
 */
function resolvePoolSsl(databaseUrl) {
  if (!databaseUrl) return false;

  let url;
  try {
    url = new URL(databaseUrl);
  } catch (_err) {
    return false;
  }

  switch (url.searchParams.get('sslmode')) {
    case 'disable':
    case 'allow':
      return false;
    case 'prefer':
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-ca':
      return { rejectUnauthorized: true, checkServerIdentity: () => undefined };
    case 'verify-full':
      return { rejectUnauthorized: true };
    default:
      return false;
  }
}

/** Return the raw libpq sslmode value, or `undefined` when not set. */
function readSslMode(databaseUrl) {
  if (!databaseUrl) return undefined;
  try {
    const mode = new URL(databaseUrl).searchParams.get('sslmode');
    return mode == null ? undefined : mode;
  } catch (_err) {
    return undefined;
  }
}

module.exports = { resolvePoolSsl, readSslMode };
