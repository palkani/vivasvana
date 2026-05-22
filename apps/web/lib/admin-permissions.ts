/**
 * Client-side mirror of the API permission set. The API is the source of
 * truth — this is just used to gate UI affordances (sidebar nav, action
 * buttons). Any actual write attempt still goes through the API which
 * enforces permissions server-side.
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

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export type StaffRole =
  | 'MANAGER'
  | 'ORDER_MANAGER'
  | 'SUPPORT'
  | 'CONTENT_EDITOR'
  | 'INVENTORY';

export interface AdminMe {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  staffRole: StaffRole | null;
  roleLabel: string;
  permissions: Permission[];
}

export function can(me: AdminMe | null, perm: Permission): boolean {
  if (!me) return false;
  return me.permissions.includes(perm);
}

export function canAny(me: AdminMe | null, perms: Permission[]): boolean {
  if (!me) return false;
  return perms.some((p) => me.permissions.includes(p));
}
