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

export type UserRole = 'SHOP_OWNER' | AdminPanelRole;

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
  rejectionReason?: string;
  branchId?: string | null;
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
