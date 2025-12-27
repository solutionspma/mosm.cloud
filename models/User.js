/**
 * User Model
 * Represents a user in the mOSm.Cloud system
 * 
 * Roles: owner | manager | designer | viewer
 */

export const UserSchema = {
  id: 'uuid',
  email: 'string',
  name: 'string',
  role: 'owner | manager | designer | viewer',
  organizationId: 'uuid',
  avatarUrl: 'string | null',
  lastLogin: 'timestamp',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const UserRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  DESIGNER: 'designer',
  VIEWER: 'viewer'
};

export const UserPermissions = {
  owner: {
    canManageUsers: true,
    canManageOrganization: true,
    canManageDevices: true,
    canCreateMenus: true,
    canEditMenus: true,
    canPublishMenus: true,
    canViewAnalytics: true
  },
  manager: {
    canManageUsers: false,
    canManageOrganization: false,
    canManageDevices: true,
    canCreateMenus: true,
    canEditMenus: true,
    canPublishMenus: true,
    canViewAnalytics: true
  },
  designer: {
    canManageUsers: false,
    canManageOrganization: false,
    canManageDevices: false,
    canCreateMenus: true,
    canEditMenus: true,
    canPublishMenus: false,
    canViewAnalytics: false
  },
  viewer: {
    canManageUsers: false,
    canManageOrganization: false,
    canManageDevices: false,
    canCreateMenus: false,
    canEditMenus: false,
    canPublishMenus: false,
    canViewAnalytics: true
  }
};

/**
 * Create a new User object
 */
export function createUser(data) {
  return {
    id: data.id || crypto.randomUUID(),
    email: data.email,
    name: data.name || '',
    role: data.role || UserRoles.VIEWER,
    organizationId: data.organizationId,
    avatarUrl: data.avatarUrl || null,
    lastLogin: data.lastLogin || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Check if user has permission
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const rolePerms = UserPermissions[user.role];
  return rolePerms ? rolePerms[permission] === true : false;
}

export default {
  Schema: UserSchema,
  Roles: UserRoles,
  Permissions: UserPermissions,
  create: createUser,
  hasPermission
};
