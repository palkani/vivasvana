import type { StaffRole, UserRole } from '@vivasvana/db';

/**
 * Granular permission tokens. Each admin route declares the permission it
 * needs (e.g. 'manage_orders'); the auth layer maps the user's role/staffRole
 * to a permission set and rejects unauthorized actions.
 */
export type Permission =
  | 'view_dashboard'
  | 'view_reports'
  | 'view_products'
  | 'manage_products'
  | 'view_orders'
  | 'manage_orders'
  | 'view_customers'
  | 'manage_customers'
  | 'view_discounts'
  | 'manage_discounts'
  | 'view_blog'
  | 'manage_blog'
  | 'manage_settings'
  | 'manage_staff';

export const ALL_PERMISSIONS: ReadonlyArray<Permission> = [
  'view_dashboard',
  'view_reports',
  'view_products',
  'manage_products',
  'view_orders',
  'manage_orders',
  'view_customers',
  'manage_customers',
  'view_discounts',
  'manage_discounts',
  'view_blog',
  'manage_blog',
  'manage_settings',
  'manage_staff',
];

/** ADMIN always has every permission — used for the dev bypass + real owners. */
const ADMIN_SET = new Set<Permission>(ALL_PERMISSIONS);

/** Preset permissions for each non-admin staff role. */
const STAFF_PRESETS: Record<StaffRole, ReadonlyArray<Permission>> = {
  // Day-to-day store manager — can do everything operational, can't touch
  // global settings or add other staff.
  MANAGER: [
    'view_dashboard',
    'view_reports',
    'view_products',
    'manage_products',
    'view_orders',
    'manage_orders',
    'view_customers',
    'manage_customers',
    'view_discounts',
    'manage_discounts',
    'view_blog',
    'manage_blog',
  ],
  // Fulfilment desk — confirms, packs, ships, refunds orders. Reads customers
  // + discounts but can't edit them.
  ORDER_MANAGER: [
    'view_dashboard',
    'view_reports',
    'view_products',
    'view_orders',
    'manage_orders',
    'view_customers',
    'view_discounts',
  ],
  // Customer success — read-only across the panel.
  SUPPORT: [
    'view_dashboard',
    'view_products',
    'view_orders',
    'view_customers',
    'view_discounts',
    'view_blog',
  ],
  // Content / marketing team — owns the blog, can read products.
  CONTENT_EDITOR: ['view_dashboard', 'view_products', 'view_blog', 'manage_blog'],
  // Warehouse — manages product catalog + stock; no order or customer view.
  INVENTORY: ['view_dashboard', 'view_products', 'manage_products'],
};

export interface ResolvedPermissions {
  role: UserRole;
  staffRole: StaffRole | null;
  permissions: ReadonlyArray<Permission>;
}

export function permissionsFor(
  role: UserRole,
  staffRole: StaffRole | null,
): ResolvedPermissions {
  if (role === 'ADMIN') {
    return { role, staffRole, permissions: ALL_PERMISSIONS };
  }
  if (role === 'STAFF' && staffRole) {
    return { role, staffRole, permissions: STAFF_PRESETS[staffRole] };
  }
  return { role, staffRole, permissions: [] };
}

export function hasPermission(
  permissions: ReadonlyArray<Permission>,
  needed: Permission,
): boolean {
  return permissions.includes(needed);
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN';
}

export function hasAnyAdminPermission(perms: ReadonlyArray<Permission>): boolean {
  return perms.length > 0;
}

/** Stable list of staff role descriptions for admin UI dropdowns. */
export const STAFF_ROLE_DESCRIPTIONS: Record<
  StaffRole,
  { label: string; summary: string }
> = {
  MANAGER: {
    label: 'Store Manager',
    summary: 'Everything except global settings and staff management.',
  },
  ORDER_MANAGER: {
    label: 'Order Manager',
    summary: 'Process orders end-to-end (confirm, pack, ship, refund). Read customers + discounts.',
  },
  SUPPORT: {
    label: 'Customer Support',
    summary: 'Read-only access to orders and customers. Cannot edit anything.',
  },
  CONTENT_EDITOR: {
    label: 'Content Editor',
    summary: 'Blog only. Read-only product access for cross-linking.',
  },
  INVENTORY: {
    label: 'Inventory',
    summary: 'Manage products and stock. No order or customer access.',
  },
};

export { ADMIN_SET };
