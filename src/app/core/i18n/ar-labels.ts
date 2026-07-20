export const qualityGradeAr: Record<string, string> = {
  Original: 'أصلي',
  HighCopy: 'هاي كوبي',
  Copy: 'كوبي',
  Used: 'مستعمل',
};

export const orderStatusAr: Record<string, string> = {
  RECEIVED: 'مستلم',
  PREPARING: 'قيد التجهيز',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التسليم',
};

export const specialStatusAr: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  QUOTED: 'تم التسعير',
  FULFILLED: 'تم التوفير',
};

export const paymentMethodAr: Record<string, string> = {
  CREDIT: 'آجل',
  CASH_ON_DELIVERY: 'عند الاستلام',
};

export const walletTxAr: Record<string, string> = {
  CREDIT_PURCHASE: 'شراء بالآجل',
  PAYMENT: 'سداد نقدي',
  ADJUSTMENT: 'تعديل',
  CREDIT_LIMIT_CHANGE: 'تعديل الحد الائتماني',
};
