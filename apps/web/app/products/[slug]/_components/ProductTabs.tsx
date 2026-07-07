'use client';

import * as Tabs from '@radix-ui/react-tabs';
import type { ProductDetail } from '@/lib/types';

interface NutritionFacts {
  servingSize?: string;
  energyKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fiberG?: number;
  fatG?: number;
}

function isNutrition(value: unknown): value is NutritionFacts {
  return typeof value === 'object' && value !== null;
}

const tabClass =
  'data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground';

export function ProductTabs({ product }: { product: ProductDetail }) {
  const nutrition = isNutrition(product.nutritionFacts) ? product.nutritionFacts : null;

  return (
    <Tabs.Root defaultValue="description" className="mt-14">
      <Tabs.List className="flex flex-wrap gap-2 border-b" aria-label="Product details">
        <Tabs.Trigger value="description" className={tabClass}>Description</Tabs.Trigger>
        <Tabs.Trigger value="ingredients" className={tabClass}>Ingredients</Tabs.Trigger>
        <Tabs.Trigger value="nutrition" className={tabClass}>Nutrition</Tabs.Trigger>
        <Tabs.Trigger value="how-to-use" className={tabClass}>How to use</Tabs.Trigger>
        <Tabs.Trigger value="reviews" className={tabClass}>
          Reviews ({product.reviews.length})
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="description" className="prose prose-sm max-w-none py-6">
        <p>{product.description}</p>
      </Tabs.Content>

      <Tabs.Content value="ingredients" className="prose prose-sm max-w-none py-6">
        {product.ingredients ? <p>{product.ingredients}</p> : <p>Ingredient list coming soon.</p>}
        {product.allergens && (
          <p className="mt-3 rounded-md border-l-4 border-destructive bg-destructive/5 p-3 text-sm">
            <strong>Allergens:</strong> {product.allergens}
          </p>
        )}
      </Tabs.Content>

      <Tabs.Content value="nutrition" className="py-6">
        {nutrition ? (
          <table className="w-full max-w-md border-collapse text-sm">
            <tbody>
              {nutrition.servingSize && (
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Serving size</th>
                  <td className="py-2 text-right">{nutrition.servingSize}</td>
                </tr>
              )}
              {nutrition.energyKcal !== undefined && (
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Energy</th>
                  <td className="py-2 text-right">{nutrition.energyKcal} kcal</td>
                </tr>
              )}
              {nutrition.proteinG !== undefined && (
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Protein</th>
                  <td className="py-2 text-right">{nutrition.proteinG} g</td>
                </tr>
              )}
              {nutrition.carbsG !== undefined && (
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Carbohydrates</th>
                  <td className="py-2 text-right">{nutrition.carbsG} g</td>
                </tr>
              )}
              {nutrition.fiberG !== undefined && (
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Dietary fiber</th>
                  <td className="py-2 text-right">{nutrition.fiberG} g</td>
                </tr>
              )}
              {nutrition.fatG !== undefined && (
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Fat</th>
                  <td className="py-2 text-right">{nutrition.fatG} g</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Nutrition facts coming soon.</p>
        )}
      </Tabs.Content>

      <Tabs.Content value="how-to-use" className="prose prose-sm max-w-none py-6">
        {product.howToUse ? <p>{product.howToUse}</p> : <p>Usage instructions coming soon.</p>}
      </Tabs.Content>

      <Tabs.Content value="reviews" className="py-6">
        {product.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet. Be the first to share your experience after your order.
          </p>
        ) : (
          <ul className="space-y-4">
            {product.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.authorName}</span>
                    {r.isVerifiedPurchase && (
                      <span className="text-xs text-leaf-600">Verified buyer</span>
                    )}
                  </div>
                  <div aria-label={`${r.rating} out of 5 stars`} className="text-amber-500">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </div>
                </div>
                {r.title && <h4 className="mt-2 font-medium">{r.title}</h4>}
                <p className="mt-1 text-sm text-muted-foreground">{r.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}
