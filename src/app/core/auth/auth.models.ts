export type UserStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';

export interface ShopUser {
  id: string;
  fullName: string;
  shopName: string;
  phone: string;
  city: string;
  address: string;
  commercialRegPhotoUrl: string;
  status: UserStatus;
  role: 'SHOP_OWNER' | 'ADMIN';
  rejectionReason?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: ShopUser;
}
