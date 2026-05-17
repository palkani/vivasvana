import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-serif text-lg">
                V
              </div>
              <span className="font-serif text-xl font-semibold">Vivasvana</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Plant-based millet superfoods for everyday Indian nutrition.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">FSSAI No. 11225303000627</p>
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
