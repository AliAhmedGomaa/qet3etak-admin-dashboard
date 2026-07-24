export interface AdminRole {
  id: string;
  name: string;
  code: string;
  description?: string;
  permissions: string[];
  adminPanel: boolean;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Back-compat aliases from API */
  role?: string;
  labelAr?: string;
  labelEn?: string;
  descriptionAr?: string;
  canAccessAdmin?: boolean;
}

export interface CreateAdminRolePayload {
  name: string;
  code: string;
  description?: string;
  permissions?: string[];
  adminPanel?: boolean;
  isActive?: boolean;
}

export interface UpdateAdminRolePayload {
  name?: string;
  code?: string;
  description?: string;
  permissions?: string[];
  adminPanel?: boolean;
  isActive?: boolean;
}
