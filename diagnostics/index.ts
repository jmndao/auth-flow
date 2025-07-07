/**
 * Diagnostics module exports
 * Provides troubleshooting and health monitoring utilities
 */

import { HealthChecker } from './health-check';
import { Troubleshooter } from './troubleshooter';
import { ConfigValidator } from './validator';

export { HealthChecker } from './health-check';
export { ConfigValidator } from './validator';
export { Troubleshooter } from './troubleshooter';

/**
 * Convenience function to run complete diagnostics
 */
export async function diagnose(config: any) {
  return Troubleshooter.diagnose(config);
}

/**
 * Quick health check function
 */
export async function healthCheck(config: any) {
  const checker = new HealthChecker(config);
  return checker.performHealthCheck();
}

/**
 * Configuration validation function
 */
export function validateConfig(config: any) {
  return ConfigValidator.validate(config);
}
