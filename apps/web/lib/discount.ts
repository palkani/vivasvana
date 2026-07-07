/** Client-side discount validation result mirror. */
export interface DiscountInfo {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: string;
  appliedAmount: string;
  freeShipping: boolean;
}

export interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
  discount?: DiscountInfo;
}
