import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Policy {
  slug: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: Array<{ heading: string; body: React.ReactNode }>;
}

// Keep slug list narrow so prerender + sitemap stay deterministic.
export const dynamicParams = false;

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) return { title: 'Not found — Vivasvana' };
  return {
    title: `${policy.title} — Vivasvana`,
    description: policy.intro,
    robots: { index: true, follow: true },
  };
}

export default async function PolicyPage({ params }: PageProps) {
  const { slug } = await params;
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) notFound();

  return (
    <section className="container py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
          Policies
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight md:text-5xl">
          {policy.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated: {policy.lastUpdated}
        </p>
        <p className="mt-6 text-lg text-muted-foreground">{policy.intro}</p>

        <div className="mt-10 space-y-8 text-base leading-relaxed text-foreground/85">
          {policy.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="mb-3 font-serif text-2xl font-semibold">{s.heading}</h2>
              {s.body}
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg border bg-muted/30 p-5 text-sm">
          Questions about this policy? Email us at{' '}
          <a href="mailto:hello@vivasvana.com" className="text-primary underline">
            hello@vivasvana.com
          </a>{' '}
          or use the{' '}
          <Link href="/contact" className="text-primary underline">
            contact form
          </Link>
          .
        </div>
      </div>
    </section>
  );
}

const LAST_UPDATED = '2026-06-15';

const POLICIES: Policy[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy policy',
    lastUpdated: LAST_UPDATED,
    intro:
      'How Vivasvana collects, uses, and protects your personal information when you visit our website or place an order.',
    sections: [
      {
        heading: 'What we collect',
        body: (
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account details</strong> — name, email, phone, password (stored hashed).
            </li>
            <li>
              <strong>Order details</strong> — shipping address, items ordered, payment metadata
              (we never see your card / UPI credentials; those go directly to our payment partner).
            </li>
            <li>
              <strong>Usage data</strong> — pages visited, device type, approximate location
              derived from IP — used to improve the site and detect abuse.
            </li>
          </ul>
        ),
      },
      {
        heading: 'How we use it',
        body: (
          <ul className="list-disc space-y-2 pl-5">
            <li>To fulfil your orders and provide customer support.</li>
            <li>To send transactional messages (order confirmations, shipping updates, OTPs).</li>
            <li>
              To send marketing emails — only if you opted in, and you can unsubscribe at any time.
            </li>
            <li>To meet legal obligations (tax records, fraud prevention).</li>
          </ul>
        ),
      },
      {
        heading: 'Who we share it with',
        body: (
          <p>
            We share only what is necessary — your address with the courier, payment details with
            our payment gateway (Razorpay), and email/SMS content with our delivery providers. We
            never sell your data. Service providers we work with are bound by confidentiality and
            data-protection agreements.
          </p>
        ),
      },
      {
        heading: 'Cookies',
        body: (
          <p>
            We use cookies to keep you logged in, remember your cart, and measure site
            performance. You can clear cookies through your browser at any time; doing so will
            sign you out and empty your cart.
          </p>
        ),
      },
      {
        heading: 'Your rights',
        body: (
          <p>
            Under the Digital Personal Data Protection Act, 2023, you have the right to access,
            correct, or delete the personal data we hold about you. Email{' '}
            <a href="mailto:hello@vivasvana.com" className="text-primary underline">
              hello@vivasvana.com
            </a>{' '}
            and we will respond within 30 days.
          </p>
        ),
      },
      {
        heading: 'Children',
        body: (
          <p>
            Vivasvana does not knowingly collect data from anyone under 18. If you believe a
            minor has provided us data, contact us and we will delete it.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'terms-of-service',
    title: 'Terms of service',
    lastUpdated: LAST_UPDATED,
    intro:
      'The terms that apply when you use the Vivasvana website or buy from us. By placing an order, you accept these terms.',
    sections: [
      {
        heading: 'Eligibility',
        body: (
          <p>
            You must be at least 18 years old to place an order. By creating an account, you
            confirm that the details you provide are accurate and that you are authorised to use
            the payment method.
          </p>
        ),
      },
      {
        heading: 'Pricing and availability',
        body: (
          <p>
            Prices on the website are in INR and include applicable GST unless stated otherwise.
            We try to keep prices and stock accurate, but errors happen — if a price or stock
            level is wrong on your order, we will contact you before charging and let you cancel
            for a full refund.
          </p>
        ),
      },
      {
        heading: 'Orders and acceptance',
        body: (
          <p>
            Placing an order is an offer to buy. We confirm acceptance when we ship the order. We
            may decline or cancel an order at our discretion — for example, if we suspect fraud,
            if we cannot deliver to your address, or if a price was wrong.
          </p>
        ),
      },
      {
        heading: 'Intellectual property',
        body: (
          <p>
            All content on this site — product photos, recipes, copy, the Vivasvana name and logo
            — is owned by us or our licensors. Personal, non-commercial use is fine. Anything else
            requires our written permission.
          </p>
        ),
      },
      {
        heading: 'Limitation of liability',
        body: (
          <p>
            We are not liable for indirect, incidental, or consequential losses arising from your
            use of the site or our products beyond what is required by Indian law. Our total
            liability for any claim is limited to the amount you paid for the order in question.
          </p>
        ),
      },
      {
        heading: 'Governing law',
        body: (
          <p>
            These terms are governed by the laws of India. Disputes are subject to the exclusive
            jurisdiction of the courts at Chennai, Tamil Nadu.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund and return policy',
    lastUpdated: LAST_UPDATED,
    intro:
      'We want you to enjoy what you buy. If something goes wrong, here is how we make it right.',
    sections: [
      {
        heading: '7-day window',
        body: (
          <p>
            You can request a refund or replacement within <strong>7 days of delivery</strong>.
            For damaged, defective, or wrong items, reach out within 48 hours of delivery with a
            photo so we can resolve quickly.
          </p>
        ),
      },
      {
        heading: 'What is eligible',
        body: (
          <ul className="list-disc space-y-2 pl-5">
            <li>Unopened, sealed packs in original packaging.</li>
            <li>Damaged or defective products, opened or unopened.</li>
            <li>Wrong product shipped (we will arrange pickup and replacement at no cost).</li>
          </ul>
        ),
      },
      {
        heading: 'What is not eligible',
        body: (
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Opened packs that are not damaged or defective — for food-safety reasons we cannot
              accept these.
            </li>
            <li>Items requested after the 7-day window.</li>
            <li>Combo or bundle items returned partially.</li>
          </ul>
        ),
      },
      {
        heading: 'How to request a refund',
        body: (
          <p>
            Email{' '}
            <a href="mailto:hello@vivasvana.com" className="text-primary underline">
              hello@vivasvana.com
            </a>{' '}
            with your order number and reason, or fill in the{' '}
            <Link href="/contact" className="text-primary underline">
              contact form
            </Link>
            . We will reply within one business day with next steps.
          </p>
        ),
      },
      {
        heading: 'Refund timeline',
        body: (
          <p>
            Once we receive the returned item (or confirm a damaged-item claim), we process the
            refund within 3 business days. The amount lands back in your original payment method
            within 5–10 business days, depending on your bank or wallet.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'shipping-policy',
    title: 'Shipping policy',
    lastUpdated: LAST_UPDATED,
    intro:
      'Where, how fast, and how much it costs to get Vivasvana to your door.',
    sections: [
      {
        heading: 'Where we ship',
        body: (
          <p>
            We currently ship across India. International shipping is not available yet — sign up
            for our newsletter to know when it is.
          </p>
        ),
      },
      {
        heading: 'Delivery time',
        body: (
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Metros</strong> (Chennai, Bengaluru, Mumbai, Delhi, Hyderabad, Pune,
              Kolkata): 2–4 business days.
            </li>
            <li>
              <strong>Tier 2 / 3 cities</strong>: 4–7 business days.
            </li>
            <li>
              <strong>Remote pincodes</strong>: 7–10 business days. We will warn you at checkout
              if your pincode falls in this range.
            </li>
          </ul>
        ),
      },
      {
        heading: 'Shipping cost',
        body: (
          <p>
            Standard shipping is <strong>free on orders ₹699 and above</strong>. Below that, we
            charge a flat ₹49 to cover packaging and last-mile delivery.
          </p>
        ),
      },
      {
        heading: 'Order tracking',
        body: (
          <p>
            Once your order ships, you will receive an email and SMS with a tracking link. You
            can also see live status from your{' '}
            <Link href="/account/orders" className="text-primary underline">
              account → orders
            </Link>{' '}
            page.
          </p>
        ),
      },
      {
        heading: 'Undelivered orders',
        body: (
          <p>
            If a courier cannot deliver after three attempts and the package returns to us, we
            will reach out to confirm your address before re-shipping. If we cannot reach you
            within 7 days, we refund the order minus the original shipping cost.
          </p>
        ),
      },
    ],
  },
];
