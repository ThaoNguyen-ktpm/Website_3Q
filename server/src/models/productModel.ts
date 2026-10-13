import { prisma } from './prisma.js';

export function findProducts(categorySlug?: string) {
  return prisma.product.findMany({
    where: categorySlug ? { category: { slug: categorySlug } } : undefined,
    select: {
      id: true,
      name: true,
      priceVnd: true,
      category: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  });
}
