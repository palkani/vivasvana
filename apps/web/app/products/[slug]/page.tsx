import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Leaf, Sprout, Truck, MapPin } from 'lucide-react';
import { api, type ApiError } from '@/lib/api';
import type { ProductDetail } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductGallery } from './_components/ProductGallery';
import { AddToCartForm } from './_components/AddToCartForm';
import { ProductTabs } from './_components/ProductTabs';
import { env } from '@/lib/env';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await api.get<ProductDetail>(`/api/products/${slug}`, { next: { revalidate: 60 } });
  } catch (err) {
    if ((err as ApiError).status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) return { title: 'Product not found' };

  return {
    title: product.metaTitle ?? product.title,
    description: product.metaDescription ?? product.shortDescription ?? undefined,
    openGraph: {
      title: product.metaTitle ?? product.title,
      description: product.metaDescription ?? product.shortDescription ?? undefined,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) notFound();

  const displayPrice = product.salePrice ?? product.price;
  const onSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);
  const inStock = product.stock > 0;

  // Product schema.org JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription ?? product.description,
    image: product.images.map((img) => img.url),
    sku: product.id,
    brand: { '@type': 'Brand', name: 'Vivasvana' },
    offers: {
      '@type': 'Offer',
      url: `${env.siteUrl}/products/${product.slug}`,
      priceCurrency: 'INR',
      price: displayPrice,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container py-8 md:py-12">
        <nav className="mb-6 text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">Home</a> /{' '}
          <a href="/products" className="hover:text-foreground">Shop</a> /{' '}
          <span className="text-foreground">{product.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductGallery images={product.images} title={product.title} />

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {product.isVegan && <Badge variant="success">Vegan</Badge>}
              {product.isGlutenFree && <Badge variant="success">Gluten-free</Badge>}
              <Badge variant="outline">FSSAI {product.fssaiLicense}</Badge>
            </div>

            <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              {product.title}
            </h1>

            {product.shortDescription && (
              <p className="text-muted-foreground">{product.shortDescription}</p>
            )}

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{formatINR(displayPrice)}</span>
              {onSale && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatINR(product.price)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">incl. all taxes</span>
            </div>

            <div className="text-sm">
              {inStock ? (
                <span className="text-leaf-600">
                  In stock {product.stock < 20 && `· only ${product.stock} left`}
                </span>
              ) : (
                <span className="text-destructive">Sold out</span>
              )}
            </div>

            <AddToCartForm productId={product.id} maxQuantity={Math.min(product.stock, 10)} />

            <ul className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <Leaf className="h-3.5 w-3.5 text-leaf-600" aria-hidden /> 100% plant-based
              </li>
              <li className="flex items-center gap-2">
                <Sprout className="h-3.5 w-3.5 text-leaf-600" aria-hidden /> No refined sugar
              </li>
              <li className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-brand-600" aria-hidden /> Free shipping over ₹400
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden /> Made in {product.countryOfOrigin}
              </li>
            </ul>

            <Button variant="outline" asChild>
              <a
                href={`https://wa.me/919999999999?text=I%20have%20a%20question%20about%20${encodeURIComponent(product.title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ask us on WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <ProductTabs product={product} />
      </div>
    </>
  );
}
