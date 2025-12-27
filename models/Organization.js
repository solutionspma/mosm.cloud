/**
 * Organization Model
 * Represents a company/business entity in mOSm.Cloud
 * 
 * An organization owns:
 * - Users
 * - Locations
 * - Menus
 * - Devices
 */

export const OrganizationSchema = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
  ownerId: 'uuid',
  logoUrl: 'string | null',
  timezone: 'string',
  settings: 'object',
  plan: 'free | starter | pro | enterprise',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const OrganizationPlans = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
};

export const PlanLimits = {
  free: {
    maxMenus: 3,
    maxDevices: 2,
    maxLocations: 1,
    maxUsers: 2,
    maxScreensPerDevice: 1
  },
  starter: {
    maxMenus: 10,
    maxDevices: 5,
    maxLocations: 3,
    maxUsers: 5,
    maxScreensPerDevice: 2
  },
  pro: {
    maxMenus: 50,
    maxDevices: 25,
    maxLocations: 10,
    maxUsers: 20,
    maxScreensPerDevice: 4
  },
  enterprise: {
    maxMenus: -1, // unlimited
    maxDevices: -1,
    maxLocations: -1,
    maxUsers: -1,
    maxScreensPerDevice: -1
  }
};

/**
 * Create a new Organization object
 */
export function createOrganization(data) {
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name,
    slug: slug,
    ownerId: data.ownerId,
    logoUrl: data.logoUrl || null,
    timezone: data.timezone || 'America/New_York',
    settings: data.settings || {
      defaultResolution: '1920x1080',
      brandColors: {
        primary: '#000000',
        secondary: '#ffffff'
      }
    },
    plan: data.plan || OrganizationPlans.FREE,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Check if organization can add more of a resource
 */
export function canAdd(organization, resourceType, currentCount) {
  const limits = PlanLimits[organization.plan];
  if (!limits) return false;
  
  const limit = limits[resourceType];
  if (limit === -1) return true; // unlimited
  
  return currentCount < limit;
}

export default {
  Schema: OrganizationSchema,
  Plans: OrganizationPlans,
  Limits: PlanLimits,
  create: createOrganization,
  canAdd
};
