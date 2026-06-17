import { UserRole } from '../models/index.js';
import { ServiceUnavailableError } from '../utils/errors.js';

export interface FeatureFlags {
  ENABLE_PIX: boolean;
  ENABLE_CONSUME: boolean;
  ENABLE_ADJUST_BALANCE: boolean;
}

/**
 * Feature flags read from environment variables.
 * Default: all features enabled.
 * Set to "false" to disable: ENABLE_PIX=false
 */
export const featureFlags: FeatureFlags = {
  ENABLE_PIX: process.env.ENABLE_PIX !== 'false',
  ENABLE_CONSUME: process.env.ENABLE_CONSUME !== 'false',
  ENABLE_ADJUST_BALANCE: process.env.ENABLE_ADJUST_BALANCE !== 'false',
};

/**
 * Assert a feature flag is enabled.
 * SUPER_ADMIN users bypass all feature flag restrictions.
 *
 * @throws ServiceUnavailableError when the feature is disabled and the user is not SUPER_ADMIN
 */
export function assertFeatureEnabled(
  flag: keyof FeatureFlags,
  role?: UserRole
): void {
  if (role === UserRole.SUPER_ADMIN) return;
  if (!featureFlags[flag]) {
    throw new ServiceUnavailableError(
      `A funcionalidade "${flag}" está temporariamente desativada`
    );
  }
}
