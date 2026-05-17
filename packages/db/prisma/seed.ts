/**
 * Seed: 3 SKUs that mirror the live Shopify catalog, a published blog post,
 * testimonials, a welcome discount, and one admin User row.
 *
 * Note: this seed does NOT create Supabase auth.users rows — auth users are
 * created via Supabase Studio or the auth API. The admin User row uses a
 * fixed UUID that you should match when creating the auth user manually
 * (see README "Seeding the admin user").
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'admin@vivasvana.local';

async function main() {
  console.info('Seeding…');

  // --- Admin user (mirrors Supabase auth user) ---
  await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: {},
    create: {
      id: ADMIN_USER_ID,
      email: ADMIN_EMAIL,
      name: 'Vivasvana Admin',
      role: 'ADMIN',
    },
  });

  // --- Categories ---
  const millets = await prisma.category.upsert({
    where: { slug: 'millet-foods' },
    update: {},
    create: {
      slug: 'millet-foods',
      name: 'Millet Foods',
      description: 'Plant-based millet superfoods for everyday nutrition.',
    },
  });

  // --- Products (mirrors live Shopify SKUs) ---
  const products: Array<{
    slug: string;
    title: string;
    sku: string;
    price: Prisma.Decimal | string;
    description: string;
    shortDescription: string;
    ingredients: string;
    howToUse: string;
    weight: number;
    stock: number;
    images: string[];
  }> = [
    {
      slug: 'nutri-millet',
      title: 'Nutri Millet',
      sku: 'VV-NUTRI-MILLET-500G',
      price: '299.00',
      description:
        'Nutri Millet is a wholesome, plant-based superfood blend of finger millet (ragi), foxtail, kodo, and little millet with almonds, cashews, and natural jaggery. Powered with iron, calcium, and dietary fiber. Perfect for kids, adults, and seniors looking for energy without crashes.',
      shortDescription:
        'Wholesome plant-based superfood blend of 7 millets, nuts, and jaggery.',
      ingredients:
        'Finger millet (ragi), foxtail millet, kodo millet, little millet, almonds, cashews, jaggery, cardamom.',
      howToUse:
        'Mix 2-3 tbsp with hot milk or water. Stir until smooth. Sweetness can be adjusted. Great as a breakfast porridge or evening snack.',
      weight: 500,
      stock: 120,
      images: [
        'https://placehold.co/800x800/bf8b3a/ffffff/png?text=Nutri+Millet+1',
        'https://placehold.co/800x800/a26e2f/ffffff/png?text=Nutri+Millet+2',
        'https://placehold.co/800x800/82532a/ffffff/png?text=Nutri+Millet+3',
      ],
    },
    {
      slug: 'millet-mojo',
      title: 'Millet Mojo',
      sku: 'VV-MILLET-MOJO-500G',
      price: '299.00',
      description:
        'Millet Mojo is an active-lifestyle blend with sprouted millets, dates, and natural cocoa. High in plant protein and slow-release carbs — ideal pre- and post-workout fuel for fitness-conscious millennials.',
      shortDescription: 'High-protein millet blend with sprouted grains, dates, and cocoa.',
      ingredients:
        'Sprouted finger millet, sprouted foxtail millet, sprouted little millet, dates, cocoa, almonds, sunflower seeds, pumpkin seeds.',
      howToUse:
        'Blend 2 tbsp with cold milk (dairy or plant) for a shake, or stir into oats. Pairs well with banana and peanut butter.',
      weight: 500,
      stock: 90,
      images: [
        'https://placehold.co/800x800/4a7c30/ffffff/png?text=Millet+Mojo+1',
        'https://placehold.co/800x800/3b6326/ffffff/png?text=Millet+Mojo+2',
        'https://placehold.co/800x800/82532a/ffffff/png?text=Millet+Mojo+3',
      ],
    },
    {
      slug: 'combo-pack',
      title: 'Combo Pack — Nutri Millet + Millet Mojo',
      sku: 'VV-COMBO-PACK',
      price: '549.00',
      description:
        'Get both our flagship blends together and save ₹49. Nutri Millet for everyday family nutrition + Millet Mojo for active lifestyle. Perfect gift pack or a way to try both blends.',
      shortDescription: 'Both 500g blends together — save ₹49.',
      ingredients: 'See individual product listings.',
      howToUse: 'See individual product listings.',
      weight: 1000,
      stock: 60,
      images: [
        'https://placehold.co/800x800/cfa552/ffffff/png?text=Combo+Pack+1',
        'https://placehold.co/800x800/dcbd76/ffffff/png?text=Combo+Pack+2',
      ],
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        price: p.price,
        description: p.description,
        shortDescription: p.shortDescription,
        ingredients: p.ingredients,
        howToUse: p.howToUse,
        weight: p.weight,
        stock: p.stock,
        status: 'PUBLISHED',
      },
      create: {
        slug: p.slug,
        title: p.title,
        sku: p.sku,
        price: p.price,
        description: p.description,
        shortDescription: p.shortDescription,
        ingredients: p.ingredients,
        howToUse: p.howToUse,
        weight: p.weight,
        stock: p.stock,
        status: 'PUBLISHED',
        metaTitle: `${p.title} — Vivasvana`,
        metaDescription: p.shortDescription,
        isVegan: true,
        nutritionFacts: {
          servingSize: '30g',
          energyKcal: 110,
          proteinG: 4,
          carbsG: 18,
          fiberG: 3,
          fatG: 2,
        },
      },
    });

    // Replace images deterministically
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((url, i) => ({
        productId: product.id,
        url,
        altText: `${p.title} image ${i + 1}`,
        sortOrder: i,
      })),
    });

    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: millets.id } },
      update: {},
      create: { productId: product.id, categoryId: millets.id },
    });
  }

  // --- Testimonials --- (idempotent via fixed UUIDs)
  const testimonials = [
    {
      id: '00000000-0000-0000-0000-00000000aa01',
      name: 'Priya Ramanathan',
      location: 'Chennai, TN',
      content:
        'My kids love the Nutri Millet shake every morning. Finally a healthy option they actually ask for!',
      rating: 5,
    },
    {
      id: '00000000-0000-0000-0000-00000000aa02',
      name: 'Arjun Mehta',
      location: 'Bengaluru, KA',
      content:
        'Millet Mojo is now my pre-gym fuel. Clean energy without the crash from sugary protein shakes.',
      rating: 5,
    },
    {
      id: '00000000-0000-0000-0000-00000000aa03',
      name: 'Lakshmi Iyer',
      location: 'Coimbatore, TN',
      content: 'Authentic taste, great packaging, fast delivery. The combo pack is the best value.',
      rating: 5,
    },
  ];
  for (const t of testimonials) {
    await prisma.testimonial.upsert({
      where: { id: t.id },
      update: { content: t.content, rating: t.rating },
      create: t,
    });
  }

  // --- Welcome discount ---
  await prisma.discount.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      description: '10% off your first order',
      type: 'PERCENTAGE',
      value: '10.00',
      minOrderValue: '299.00',
      maxDiscount: '100.00',
      maxUsesPerUser: 1,
      status: 'ACTIVE',
    },
  });

  // --- Sample blog post ---
  await prisma.blogPost.upsert({
    where: { slug: 'why-millets-are-the-future-of-nutrition' },
    update: {},
    create: {
      slug: 'why-millets-are-the-future-of-nutrition',
      title: 'Why Millets Are the Future of Nutrition',
      excerpt:
        'The UN declared 2023 the International Year of Millets — here is why this ancient grain matters now more than ever.',
      content: `# Why Millets Are the Future of Nutrition\n\nMillets have been part of the Indian diet for thousands of years…\n\n## A nutritional powerhouse\n\nUnlike rice and wheat, millets are gluten-free, high in fiber, and rich in iron and calcium.\n\n## Climate-smart farming\n\nMillets need 70% less water than rice…`,
      author: 'Vivasvana Team',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      readingMinutes: 4,
      metaTitle: 'Why Millets Are the Future of Nutrition — Vivasvana',
      metaDescription:
        'Discover why millets — gluten-free, high-fiber, climate-resilient — are the future of Indian nutrition.',
    },
  });

  console.info('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
