import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils';
import type { ProductCardData } from '@/lib/types';

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images[0];
  const isOnSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);
  const displayPrice = product.salePrice ?? product.price;
  const outOfStock = product.stock <= 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square bg-muted">
          {image ? (
            <Image
              src={image.url}
              alt={image.altText ?? product.title}
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">🌾</div>
          )}
          {isOnSale && (
            <Badge variant="default" className="absolute left-3 top-3">
              Sale
            </Badge>
          )}
          {outOfStock && (
            <Badge variant="outline" className="absolute right-3 top-3 bg-background">
              Sold out
            </Badge>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {product.isVegan && <span>Vegan</span>}
          {product.isGlutenFree && <span>· Gluten-free</span>}
        </div>
        <h3 className="font-medium leading-tight">
          <Link href={`/products/${product.slug}`} className="hover:text-primary">
            {product.title}
          </Link>
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.shortDescription}</p>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-lg font-semibold">{formatINR(displayPrice)}</span>
          {isOnSale && (
            <span className="text-sm text-muted-foreground line-through">
              {formatINR(product.price)}
            </span>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="mt-1" disabled={outOfStock}>
          <Link href={`/products/${product.slug}`}>
            {outOfStock ? 'Sold out' : 'View product'}
          </Link>
        </Button>
      </div>
    </article>
  );
}
