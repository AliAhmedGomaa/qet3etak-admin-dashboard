export type UserStatus =
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export type AdminPanelRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'STAFF'
  | 'BRANCH_MANAGER';

export type UserRole = 'SHOP_OWNER' | AdminPanelRole | string;

export interface ShopUser {
  id: string;
  fullName: string;
  shopName: string;
  phone: string;
  city: string;
  address: string;
  commercialRegPhotoUrl: string;
  status: UserStatus;
  role: UserRole;
  roleId?: string | null;
  /** From Role.adminPanel — custom roles may access admin when true. */
  adminPanel?: boolean;
  roleName?: string;
  rejectionReason?: string;
  branchId?: string | null;
  /** Shop-specific catalog discount percent (0–100). */
  shopDiscountPercent?: number;
  /** Fine-grained permissions from the assigned Role. */
  permissions?: string[];
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: ShopUser;
}

export const ADMIN_PANEL_ROLES: AdminPanelRole[] = [
  'ADMIN',
  'MANAGER',
  'STAFF',
  'BRANCH_MANAGER',
];

export function isAdminPanelRole(role: string | undefined | null): boolean {
  return !!role && (ADMIN_PANEL_ROLES as string[]).includes(role);
}

/** True if the user may use the admin dashboard (system panel role or custom adminPanel). */
export function canAccessAdminPanel(
  user: Pick<ShopUser, 'role' | 'adminPanel'> | null | undefined,
): boolean {
  if (!user?.role) return false;
  if (user.role === 'SHOP_OWNER') return false;
  if (user.adminPanel === true) return true;
  return isAdminPanelRole(user.role);
}

/** Custom panel roles are treated like STAFF for nav gating. */
export function effectiveNavRole(
  user: Pick<ShopUser, 'role' | 'adminPanel'> | null | undefined,
): AdminPanelRole | string | null {
  if (!user?.role) return null;
  if (isAdminPanelRole(user.role)) return user.role as AdminPanelRole;
  if (user.adminPanel) return 'STAFF';
  return user.role;
}
