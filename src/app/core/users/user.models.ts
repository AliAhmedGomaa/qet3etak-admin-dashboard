export type AdminUserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'BRANCH_MANAGER';

export type AdminUserStatus = 'APPROVED' | 'SUSPENDED';

export interface AdminUser {
  id: string;
  fullName: string;
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  isActive: boolean;
  branchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRoleDefinition {
  role: AdminUserRole;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  canAccessAdmin: boolean;
}

/** Roles creatable from the Users page (BRANCH_MANAGER is assigned via Branches). */
export type AssignableAdminUserRole = Exclude<AdminUserRole, 'BRANCH_MANAGER'>;

export interface CreateAdminUserPayload {
  fullName: string;
  phone: string;
  password: string;
  role: AssignableAdminUserRole;
  status?: AdminUserStatus;
}

export interface UpdateAdminUserPayload {
  fullName?: string;
  phone?: string;
  password?: string;
  role?: AssignableAdminUserRole;
  status?: AdminUserStatus;
  isActive?: boolean;
}
