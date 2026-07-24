export interface TieredPrice {
  minQty: number;
  price: number;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  model: string;
  category: string;
  part?: string;
  qualityId?: string;
  qualityGrade: string;
  stockQuantity: number;
  basePrice: number;
  costPrice?: number;
  tieredPricing: TieredPrice[];
  imageUrl: string;
  sku?: string;
  isActive?: boolean;
}
