import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { tenantALS, newRequestId } from './als';

/**
 * Phase 0 stub middleware.
 *
 * Behaviour:
 *  - When `MULTI_TENANT_ENABLED` is OFF (Phase 0 default): wraps every
 *    request in an empty ALS frame (no tenant resolution, no DB hit).
 *    Existing controllers continue to read `req.user` exactly as today.
 *  - When ON: delegates tenant resolution to a yet-to-be-implemented
 *    `TenantResolver` (Phase 1). Today: throws `Not Implemented` to
 *    fail loudly if anyone enables the flag prematurely.
 *
 * NOT REGISTERED in `AppModule` in Phase 0. Wiring happens in TKT-06
 * (Phase 1).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('TenantContextMiddleware');

  constructor(private readonly flags: FeatureFlagsService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || newRequestId();
    if (!this.flags.multiTenantEnabled()) {
      // Phase 0: ALS frame with no tenant. ALS is otherwise inert.
      tenantALS.run({ requestId }, () => next());
      return;
    }
    // Defensive: prevent half-built behaviour from sneaking into prod.
    this.logger.error(
      'MULTI_TENANT_ENABLED=true but tenant resolution is not implemented in Phase 0',
    );
    next(new Error('Tenant resolution not implemented (Phase 1 deliverable)'));
  }
}

/**
 * Routes that must NEVER require tenant resolution. Health/ready/login.
 *
 * Used by the Phase 1 middleware. Listed here so it can be unit-tested
 * already in Phase 0.
 */
export const PUBLIC_NO_TENANT_PATHS: ReadonlyArray<string | RegExp> = [
  '/healthz',
  '/readyz',
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  /^\/_platform\/auth\//,  // platform-admin login on its own surface
];
