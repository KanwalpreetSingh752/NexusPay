import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

async function seed() {
  logger.info('Starting NexusPay database seed...');

  const existing = await prisma.user.findUnique({
    where: { email: 'demo@nexuspay.dev' },
  });

  if (existing) {
    logger.info('Demo merchant already exists, skipping seed.');
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password@123', salt);

  const merchant = await prisma.merchant.create({
    data: {
      businessName: 'Acme E-Commerce Pvt Ltd',
      email: 'demo@nexuspay.dev',
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  const user = await prisma.user.create({
    data: {
      merchantId: merchant.id,
      email: 'demo@nexuspay.dev',
      passwordHash,
      role: 'admin',
    },
  });

  // Seed known Test API Key for developer testing
  const testApiKey = 'npay_test_nexusdemo1234567890abcdef';
  const keyHash = crypto.createHash('sha256').update(testApiKey).digest('hex');

  const apiKey = await prisma.apiKey.create({
    data: {
      merchantId: merchant.id,
      name: 'Development Test Key',
      keyPrefix: 'npay_test_nexusd',
      keyHash,
      environment: 'TEST',
      isActive: true,
    },
  });

  logger.info('Seed completed successfully!');
  logger.info(`Merchant ID: ${merchant.id}`);
  logger.info(`User: ${user.email} / Password@123`);
  logger.info(`Test API Key: ${testApiKey}`);
}

seed()
  .catch((e) => {
    logger.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
