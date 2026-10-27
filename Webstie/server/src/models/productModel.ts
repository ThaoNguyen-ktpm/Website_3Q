import { prisma } from './prisma.js';

export function findProducts() {
  return prisma.product.findMany({
    select: {
      id: true,
      name: true,
      priceVnd: true,
      category: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  });
}
