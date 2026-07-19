import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Image
              src="/brand/logo.png"
              alt="Vivasvana — Mindful nourishment made pure"
              width={1363}
              height={855}
              className="h-14 w-auto"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Plant-based millet superfoods for everyday Indian nutrition.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">FSSAI Certified · Made in India</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Shop</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/products/nutri-millet" className="hover:text-foreground">Nutri Millet</Link></li>
              <li><Link href="/products/millet-mojo" className="hover:text-foreground">Millet Mojo</Link></li>
              <li><Link href="/products/combo-pack" className="hover:text-foreground">Combo Pack</Link></li>
              <li><Link href="/products" className="hover:text-foreground">All products</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground">About us</Link></li>
              <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Policies</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/policies/privacy-policy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/policies/terms-of-service" className="hover:text-foreground">Terms</Link></li>
              <li><Link href="/policies/refund-policy" className="hover:text-foreground">Refunds</Link></li>
              <li><Link href="/policies/shipping-policy" className="hover:text-foreground">Shipping</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Vivasvana. All rights reserved.</p>
          <p>Made in India · GST included</p>
        </div>
      </div>
    </footer>
  );
}
