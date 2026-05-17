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
  fssaiLicense: string;
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
