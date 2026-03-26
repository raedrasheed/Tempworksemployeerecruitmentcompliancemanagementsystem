import { defineConfig } from 'prisma/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

function resolvePoolSsl(
  databaseUrl: string | undefined,
): false | { rejectUnauthorized: boolean } | undefined {
  if (!databaseUrl) return undefined;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return undefined;
  }
  const sslmode = url.searchParams.get('sslmode');
  switch (sslmode) {
    case 'disable':
      return false;
    case 'require':
    case 'prefer':
    case 'verify-ca':
      return { rejectUnauthorized: false };
    case 'verify-full':
      return { rejectUnauthorized: true };
    default:
      return false;
  }
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter(env) {
      const pool = new Pool({
        connectionString: env.DATABASE_URL,
        ssl: resolvePoolSsl(env.DATABASE_URL),
      });
      return new PrismaPg(pool);
    },
  },
});
