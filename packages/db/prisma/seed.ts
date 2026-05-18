/**
 * Seed: real Vivasvana catalog mirrored from the live Shopify site
 * (https://vivasvana.com) — 3 SKUs with full product copy, prices, and
 * image paths under /products/* (served from apps/web/public/).
 *
 * Note: this seed does NOT create Supabase auth.users rows — auth users are
 * created via Supabase Studio or the auth API. The admin User row uses a
 * fixed UUID; promote any signed-up user via `pnpm admin:promote <email>`.
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
      description: 'Plant-based millet superfoods for everyday Indian nutrition.',
    },
  });

  // --- Products: real catalog from vivasvana.com ---
  interface ProductSeed {
    slug: string;
    title: string;
    sku: string;
    price: Prisma.Decimal | string;
    salePrice?: string;
    shortDescription: string;
    description: string;
    ingredients: string;
    howToUse: string;
    allergens: string;
    weight: number;
    stock: number;
    nutritionFacts: Prisma.JsonObject;
    images: string[];
  }

  const products: ProductSeed[] = [
    {
      slug: 'nutri-millet',
      title:
        'Vivasvana Nutri Millet | Iron-Rich High Fibre Millet Mix | Plant-Based Daily Nutrition for Gut Health, Digestion & Energy | 500g',
      sku: 'VV-NUTRI-MILLET-500G',
      price: '399.00',
      salePrice: '299.00',
      shortDescription:
        'Iron-rich, high-fibre millet mix for daily gut health, digestion and sustained plant-based energy. Made from 6+ ancient Indian millets.',
      description: `Vivasvana Nutri Millet is a daily-nutrition blend crafted from six ancient Indian millets — finger millet (ragi), foxtail, kodo, little, barnyard and pearl — combined with almonds, cashews and natural jaggery. Designed for the whole family: powered with iron, calcium and dietary fibre to support gut health, digestion and steady energy without the crashes of refined cereals.\n\nMade in India. FSSAI certified. 100% plant-based. No refined sugar. No preservatives. No artificial colours or flavours.`,
      ingredients:
        'Finger millet (ragi), foxtail millet, kodo millet, little millet, barnyard millet, pearl millet, almonds, cashews, jaggery, cardamom. Processed in a facility that also handles tree nuts, soy and wheat.',
      howToUse:
        'Mix 2-3 tablespoons (50g) with hot milk (dairy or plant) or water. Stir until smooth. Adjust sweetness with extra jaggery or honey. Best as a breakfast porridge or evening snack. Can also be added to smoothie bowls, oats or kheer.',
      allergens: 'Contains nuts (almonds, cashews). May contain traces of soy, wheat and other tree nuts.',
      weight: 500,
      stock: 120,
      nutritionFacts: {
        servingSize: '50g',
        energyKcal: 208,
        proteinG: 8.2,
        carbsG: 35.1,
        fiberG: 5.1,
        fatG: 3.4,
        ironMg: 4.6,
        calciumMg: 86,
      },
      images: [
        '/products/nutri-millet/front.png',
        '/products/nutri-millet/back.png',
        '/products/nutri-millet/how-to-prepare.png',
        '/products/nutri-millet/benefits.png',
        '/products/nutri-millet/lifestyle-1.jpg',
        '/products/nutri-millet/lifestyle-2.jpg',
      ],
    },
    {
      slug: 'millet-mojo',
      title:
        'Vivasvana Millet Mojo | High Protein Plant-Based Meal Replacement | Ancient Millet Superfood for Strength, Energy & Recovery | 500g',
      sku: 'VV-MILLET-MOJO-500G',
      price: '399.00',
      salePrice: '299.00',
      shortDescription:
        'High-protein, plant-based meal replacement powder. 10.15g protein per 50g serving. Built for strength, muscle recovery and sustained energy — naturally.',
      description: `Vivasvana Millet Mojo is a complete plant-based meal replacement made from 6+ ancient Indian millets, plant proteins, nuts, pulses and digestive herbs (cumin, ajwain, fenugreek, kalonji). Each 50g serving delivers 10.15g of plant protein, 5.13g of dietary fibre and 208.87 kcal of clean, slow-release fuel — engineered for active-lifestyle Indians who want strength without dairy or whey.\n\nMade in India. FSSAI certified. 100% vegan. Lactose-free. No refined sugar, no preservatives, no artificial sweeteners.`,
      ingredients:
        'Sprouted finger millet, sprouted foxtail millet, sprouted little millet, kodo millet, barnyard millet, pearl millet, plant protein blend (soy, pea), almonds, cashews, sunflower seeds, pumpkin seeds, dates, cocoa, cumin, ajwain, fenugreek, kalonji.',
      howToUse:
        'Blend 2 tablespoons (50g) with 250ml warm water, dairy or plant milk for a smooth shake. Pair with banana, peanut butter or oats for a complete meal. Best within 30 minutes post-workout or as a high-protein breakfast.',
      allergens:
        'Contains Soy, Peanut, Sesame, Coconut. Processed in a facility that also handles tree nuts and wheat (gluten). Not suitable for severe gluten intolerance or celiac disease.',
      weight: 500,
      stock: 90,
      nutritionFacts: {
        servingSize: '50g',
        energyKcal: 208.87,
        proteinG: 10.15,
        carbsG: 32.4,
        fiberG: 5.13,
        fatG: 3.9,
        ironMg: 5.2,
        calciumMg: 92,
      },
      images: [
        '/products/millet-mojo/front.png',
        '/products/millet-mojo/back.png',
        '/products/millet-mojo/nutrition-facts.png',
        '/products/millet-mojo/lifestyle-1.jpg',
        '/products/millet-mojo/lifestyle-2.jpg',
      ],
    },
    {
      slug: 'combo-pack',
      title:
        'Vivasvana Combo Pack | Nutri Millet + Millet Mojo | Complete Plant-Based Nutrition Bundle | Gut Health + Protein + Energy | 500g x 2',
      sku: 'VV-COMBO-PACK',
      price: '798.00',
      salePrice: '549.00',
      shortDescription:
        'Both 500g blends together — save ₹249. Nutri Millet for everyday family nutrition + Millet Mojo for active-lifestyle protein.',
      description: `Get our two flagship blends together and save ₹249. Vivasvana Nutri Millet powers the family's daily gut-health and energy routine, while Millet Mojo fuels muscle recovery and strength for the active members. One bundle, one month of clean plant-based nutrition for the whole household.\n\nMade in India. FSSAI certified. 100% plant-based. No refined sugar. No preservatives.`,
      ingredients: 'See individual Nutri Millet and Millet Mojo product listings for full ingredient details.',
      howToUse: 'See individual product listings. Both can be mixed with water, milk or plant milk and used as porridge, shake or smoothie.',
      allergens:
        'Contains nuts (almonds, cashews), soy, peanut, sesame, coconut. Processed in a facility that also handles tree nuts and wheat (gluten).',
      weight: 1000,
      stock: 60,
      nutritionFacts: {
        servingSize: '50g (per pack)',
        energyKcal: '208–209',
        proteinG: '8.2–10.15',
        carbsG: '32.4–35.1',
        fiberG: '5.1–5.13',
        fatG: '3.4–3.9',
      },
      images: [
        '/products/combo-pack/cover.png',
        '/products/combo-pack/millet-mojo-front.png',
        '/products/combo-pack/nutri-millet-front.png',
      ],
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        sku: p.sku,
        price: p.price,
        salePrice: p.salePrice,
        shortDescription: p.shortDescription,
        description: p.description,
        ingredients: p.ingredients,
        howToUse: p.howToUse,
        allergens: p.allergens,
        weight: p.weight,
        stock: p.stock,
        status: 'PUBLISHED',
        nutritionFacts: p.nutritionFacts,
        isVegan: true,
        metaTitle: p.title.split('|')[0]?.trim(),
        metaDescription: p.shortDescription,
      },
      create: {
        slug: p.slug,
        title: p.title,
        sku: p.sku,
        price: p.price,
        salePrice: p.salePrice,
        description: p.description,
        shortDescription: p.shortDescription,
        ingredients: p.ingredients,
        howToUse: p.howToUse,
        allergens: p.allergens,
        weight: p.weight,
        stock: p.stock,
        status: 'PUBLISHED',
        metaTitle: p.title.split('|')[0]?.trim(),
        metaDescription: p.shortDescription,
        isVegan: true,
        nutritionFacts: p.nutritionFacts,
      },
    });

    // Replace images deterministically so re-running the seed picks up new files
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((url, i) => ({
        productId: product.id,
        url,
        altText: `${p.title.split('|')[0]?.trim() ?? p.slug} ${i + 1}`,
        sortOrder: i,
      })),
    });

    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: millets.id } },
      update: {},
      create: { productId: product.id, categoryId: millets.id },
    });
  }

  // --- Testimonials (real ones from the live site) ---
  const testimonials = [
    {
      id: '00000000-0000-0000-0000-00000000aa01',
      name: 'Priya S.',
      location: 'Mumbai',
      content:
        'Millet Mojo has completely transformed my morning routine. I feel stronger and more energetic throughout the day!',
      rating: 5,
    },
    {
      id: '00000000-0000-0000-0000-00000000aa02',
      name: 'Rahul M.',
      location: 'Bangalore',
      content:
        "Finally a clean protein that doesn't upset my stomach. Nutri Millet is now a daily staple for my whole family.",
      rating: 5,
    },
    {
      id: '00000000-0000-0000-0000-00000000aa03',
      name: 'Ananya K.',
      location: 'Delhi',
      content:
        "Love that it's 100% plant-based and made from ancient grains. You can taste the quality difference!",
      rating: 5,
    },
  ];
  for (const t of testimonials) {
    await prisma.testimonial.upsert({
      where: { id: t.id },
      update: { content: t.content, rating: t.rating, name: t.name, location: t.location },
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
