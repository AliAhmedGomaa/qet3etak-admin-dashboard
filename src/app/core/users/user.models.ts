export type AdminUserRole = string;

export type AdminUserStatus = 'APPROVED' | 'SUSPENDED';

export interface AdminUser {
  id: string;
  fullName: string;
  phone: string;
  role: AdminUserRole;
  /** Present when Roles entity is wired. */
  roleId?: string | null;
  status: AdminUserStatus;
  isActive: boolean;
  branchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRoleDefinition {
  /** Role document id when loaded from Role collection. */
  id?: string;
  role: AdminUserRole;
  code?: string;
  name?: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  canAccessAdmin: boolean;
  adminPanel?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
}

export interface CreateAdminUserPayload {
  fullName: string;
  phone: string;
  password: string;
  /** Preferred when Role entities exist. */
  roleId: string;
  /** Fallback role code when roleId is unavailable. */
  role?: string;
  status?: AdminUserStatus;
}

export interface UpdateAdminUserPayload {
  fullName?: string;
  phone?: string;
  password?: string;
  roleId?: string;
  role?: string;
  status?: AdminUserStatus;
  isActive?: boolean;
}
