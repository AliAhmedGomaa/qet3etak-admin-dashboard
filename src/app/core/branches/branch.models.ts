export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface BranchManagerRef {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  notes: string;
  status: BranchStatus;
  geofenceLat?: number | null;
  geofenceLng?: number | null;
  geofenceRadiusMeters?: number | null;
  managerUserId?: string | null;
  manager?: BranchManagerRef | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface CreateBranchPayload {
  name: string;
  code: string;
  city: string;
  address: string;
  phone?: string;
  notes?: string;
  status?: BranchStatus;
  geofenceLat?: number;
  geofenceLng?: number;
  geofenceRadiusMeters?: number;
}

export type UpdateBranchPayload = Partial<CreateBranchPayload>;
