/**
 * Services Index
 * Export all services from a single entry point
 * 
 * MOSM Cloud is a CONTROL PLANE.
 * See GPT-CONTEXT.md for architecture details.
 */

// Core infrastructure
export { default as supabase, supabaseAdmin, getAuthenticatedClient } from './supabase.js';

// Existing services
export { default as authService } from './authService.js';
export { default as menuService } from './menuService.js';
export { default as layoutService } from './layoutService.js';
export { default as deviceService } from './deviceService.js';
export { default as publishService } from './publishService.js';

// ============================================================
// MOSM Control Plane Services
// ============================================================

// Service Registry - heartbeats and health monitoring
export { registryService } from './registry/index.js';
export * from './registry/index.js';

// Config Service - location/screen configuration (read-only for MOD OS)
export { configService } from './config/index.js';
export * from './config/index.js';

// Audit Service - event mirroring and audit logging
export { auditService } from './audit/index.js';
export * from './audit/index.js';

// Rollouts Service - multi-location deployment orchestration
export { rolloutsService } from './rollouts/index.js';
export * from './rollouts/index.js';
