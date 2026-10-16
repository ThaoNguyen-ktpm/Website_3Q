import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import { rolePermissions } from '../src/config/permissions.js';
import { z } from 'zod';

const prisma = new PrismaClient();

const categories = [
  { name: 'Túi xách', slug: 'tui-xach' },
  { name: 'Đồng hồ', slug: 'dong-ho' },
  { name: 'Phụ kiện', slug: 'phu-kien' },
] as const;

const products = [
  { categorySlug: 'tui-xach', name: 'Túi tote vải mẫu', slug: 'tui-tote-vai-mau', priceVnd: 185000, stock: 25 },
  { categorySlug: 'tui-xach', name: 'Túi đeo chéo mini mẫu', slug: 'tui-deo-cheo-mini-mau', priceVnd: 320000, stock: 18 },
  { categorySlug: 'tui-xach', name: 'Ba lô canvas mẫu', slug: 'ba-lo-canvas-mau', priceVnd: 450000, stock: 12 },
  { categorySlug: 'tui-xach', name: 'Túi cầm tay mẫu', slug: 'tui-cam-tay-mau', priceVnd: 275000, stock: 15 },
  { categorySlug: 'dong-ho', name: 'Đồng hồ dây da mẫu', slug: 'dong-ho-day-da-mau', priceVnd: 690000, stock: 10 },
  { categorySlug: 'dong-ho', name: 'Đồng hồ thể thao mẫu', slug: 'dong-ho-the-thao-mau', priceVnd: 790000, stock: 8 },
  { categorySlug: 'dong-ho', name: 'Đồng hồ tối giản mẫu', slug: 'dong-ho-toi-gian-mau', priceVnd: 560000, stock: 14 },
  { categorySlug: 'phu-kien', name: 'Ví đựng thẻ mẫu', slug: 'vi-dung-the-mau', priceVnd: 120000, stock: 30 },
  { categorySlug: 'phu-kien', name: 'Móc khóa mẫu', slug: 'moc-khoa-mau', priceVnd: 45000, stock: 50 },
  { categorySlug: 'phu-kien', name: 'Khăn lụa mẫu', slug: 'khan-lua-mau', priceVnd: 210000, stock: 20 },
] as const;

async function main(): Promise<void> {
  const adminEmails = z.array(z.string().max(191).pipe(z.email())).parse(
    [...new Set((process.env.GOOGLE_ALLOWED_EMAILS ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean))]);
  for (const email of adminEmails) {
    await prisma.staff.upsert({ where: { email }, update: { role: 'ADMIN', status: 'ACTIVE' },
      create: { email, fullName: email.split('@')[0], role: 'ADMIN', status: 'ACTIVE' } });
  }
  console.log(`Seed ADMIN hoàn tất: ${adminEmails.length} tài khoản.`);
  for (const role of ['MANAGER', 'STAFF'] as const) {
    await prisma.$transaction(async db => {
      if (await db.rolePermission.count({ where: { role } }) === 0) {
        await db.rolePermission.createMany({ data: rolePermissions[role].map(permission => ({ role, permission })) });
      }
    }, { isolationLevel: 'Serializable' });
  }
  if (process.env.SEED_SAMPLE_DATA !== 'true') return;
  const seedEnv = z.object({
    SEED_ADMIN_EMAIL: z.email().default('admin@shop.test'),
    SEED_ADMIN_PASSWORD: z.string().min(12).refine(value => !value.startsWith('CHANGE_ME'), 'Set a private seed password in .env'),
  }).parse(process.env);
  const categoryIds = new Map<string, number>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
    categoryIds.set(category.slug, saved.id);
  }

  for (const product of products) {
    const { categorySlug, ...details } = product;
    const categoryId = categoryIds.get(categorySlug);
    if (categoryId === undefined) throw new Error(`Missing category: ${categorySlug}`);
    await prisma.product.upsert({
      where: { slug: details.slug },
      update: { ...details, categoryId },
      create: { ...details, categoryId, description: 'Sản phẩm dữ liệu mẫu để thử nghiệm.' },
    });
  }

  const passwordHash = await bcrypt.hash(seedEnv.SEED_ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: seedEnv.SEED_ADMIN_EMAIL },
    update: { passwordHash, role: UserRole.ADMIN },
    create: { email: seedEnv.SEED_ADMIN_EMAIL, passwordHash, role: UserRole.ADMIN },
  });
  console.log('Seed hoàn tất: 3 danh mục, 10 sản phẩm mẫu, 1 tài khoản admin.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });