export type QualityGrade = 'Original' | 'HighCopy' | 'Copy' | 'Used';

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
  qualityGrade: QualityGrade;
  stockQuantity: number;
  basePrice: number;
  costPrice?: number;
  tieredPricing: TieredPrice[];
  imageUrl: string;
  sku?: string;
  isActive?: boolean;
}

export const QUALITY_GRADES: QualityGrade[] = [
  'Original',
  'HighCopy',
  'Copy',
  'Used',
];
