import type { Metadata } from 'next';
import { Mail, MapPin, Phone, MessageCircle } from 'lucide-react';
import { ContactForm } from './_components/ContactForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Questions about Vivasvana millet superfoods, orders or partnerships? Send us a message — we read every one.',
};

export default async function ContactPage() {
  // Pull the signed-in user's email so the form can pre-fill + lock it.
  // No auth requirement — guests can submit too.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialEmail = user?.email ?? '';
  const emailLocked = Boolean(user?.email);

  return (
    <div className="container py-12 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
          We&rsquo;d love to hear from you
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight md:text-5xl">
          Contact us
        </h1>
        <p className="mt-3 text-muted-foreground">
          Drop us a message about your order, our blends, or anything millet-related. We reply
          within one business day.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-10 md:grid-cols-[1fr_2fr]">
        {/* Contact details */}
        <aside className="space-y-5">
          <ContactDetail icon={Mail} label="Email" value="hello@vivasvana.com" href="mailto:hello@vivasvana.com" />
          <ContactDetail
            icon={MessageCircle}
            label="WhatsApp"
            value="Chat with us"
            href="https://wa.me/919999999999"
          />
          <ContactDetail icon={Phone} label="Phone" value="+91 99999 99999" href="tel:+919999999999" />
          <ContactDetail
            icon={MapPin}
            label="Address"
            value="Vivasvana Foods Pvt Ltd, Tamil Nadu, India"
          />
        </aside>

        <ContactForm initialEmail={initialEmail} emailLocked={emailLocked} />
      </div>
    </div>
  );
}

interface DetailProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}

function ContactDetail({ icon: Icon, label, value, href }: DetailProps) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block truncate font-medium">{value}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-3 transition hover:text-brand-700">
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-3">{inner}</div>
  );
}
