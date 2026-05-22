/** API response shapes mirrored client-side. Money fields arrive as strings. */

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  price: string;
  salePrice: string | null;
  stock: number;
  isVegan: boolean;
  isGlutenFree: boolean;
  status: ProductStatus;
  images: ProductImage[];
  createdAt: string;
}

export interface ProductDetail extends ProductCardData {
  description: string;
  ingredients: string | null;
  howToUse: string | null;
  allergens: string | null;
  nutritionFacts: Record<string, unknown> | null;
  weight: string | null;
  hsnCode: string;
  taxRate: string;
  fssaiLicense: string | null;
  countryOfOrigin: string;
  metaTitle: string | null;
  metaDescription: string | null;
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    price: string;
    salePrice: string | null;
    stock: number;
  }>;
  categories: Array<{ category: { id: string; slug: string; name: string } }>;
  reviews: Array<{
    id: string;
    authorName: string;
    rating: number;
    title: string | null;
    content: string;
    createdAt: string;
    isVerifiedPurchase: boolean;
  }>;
}

export interface ProductListResponse {
  items: ProductCardData[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  price: string;
  product: {
    id: string;
    slug: string;
    title: string;
    price: string;
    salePrice: string | null;
    stock: number;
    images: ProductImage[];
  };
  variant: {
    id: string;
    title: string;
    price: string;
    salePrice: string | null;
    stock: number;
  } | null;
}

export interface Cart {
  id: string;
  userId: string | null;
  sessionId: string | null;
  currency: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  userId: string;
  name: string;
  phone: string;
  addressLine: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PinLookupResult {
  pincode: string;
  city: string;
  state: string;
  stateCode: string;
  serviceable: boolean;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL_REFUNDED';

export type PaymentMethod = 'RAZORPAY' | 'COD' | 'STRIPE';

export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  sku: string;
  hsnCode: string;
  quantity: number;
  price: string;
  taxRate: string;
  total: string;
}

export interface OrderShipping {
  id: string;
  name: string;
  phone: string;
  addressLine: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  email: string;
  phone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  shipping: string;
  discount: string;
  tax: string;
  codFee: string;
  total: string;
  currency: string;
  discountCode: string | null;
  gstin: string | null;
  companyName: string | null;
  notes: string | null;
  placedAt: string;
  confirmedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
  shippingAddress: OrderShipping | null;
}

export interface Payment {
  id: string;
  orderId: string;
  gateway: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
  createdAt: string;
}
