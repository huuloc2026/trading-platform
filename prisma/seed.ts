import { PrismaClient, Plan, Role, StrategyStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';
import * as path from 'path';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seeding...');
  await clearDatabase();
  await createOrganizations();
  await createUsers();
  await createStrategies();
  await createBacktestResults();
  await createAuditLogs();
  console.log('✅ Seeding completed!');
}

async function clearDatabase() {
  console.log('Clearing existing data...');
  // Xóa theo thứ tự để tránh lỗi khóa ngoại
  await prisma.auditLog.deleteMany();
  await prisma.backtestResult.deleteMany();
  await prisma.backtestJob.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  console.log('✅ Database cleared');
}

async function createOrganizations() {
  console.log('Creating organizations...');
  const organizations = [
    { name: 'Trading Fund Inc.', plan: Plan.PRO, email: 'contact@tradingfund.com', isActive: true },
    { name: 'Quantitative Research Lab', plan: Plan.PRO, email: 'info@quantlab.com', isActive: true },
    { name: 'Retail Trading Co.', plan: Plan.FREE, email: 'support@retailtrading.com', isActive: true },
    { name: 'Crypto Hedge Fund', plan: Plan.PRO, email: 'hello@cryptohedge.com', isActive: false },
  ];

  for (const org of organizations) {
    await prisma.organization.create({ data: org });
  }
}

async function createUsers() {
  console.log('Creating users...');
  const organizations = await prisma.organization.findMany();
  const passwordHash = await bcrypt.hash('password123', 10);

  for (const org of organizations) {
    // Admin user
    await prisma.user.create({
      data: {
        email: `admin@${org.name.toLowerCase().replace(/\s+/g, '')}.com`,
        passwordHash,
        role: Role.ADMIN,
        orgId: org.id,
        fullName: faker.person.fullName(),
        isActive: org.isActive,
      }
    });

    if (org.isActive) {
      const researcherCount = org.plan === Plan.PRO ? 3 : 1;
      for (let i = 0; i < researcherCount; i++) {
        await prisma.user.create({
          data: {
            email: faker.internet.email(),
            passwordHash,
            role: Role.RESEARCHER,
            orgId: org.id,
            fullName: faker.person.fullName(),
            isActive: faker.datatype.boolean({ probability: 0.9 }),
          }
        });
      }
    }
  }
}

async function createStrategies() {
  console.log('Creating strategies...');
  const users = await prisma.user.findMany();
  const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
  await fs.mkdir(uploadsDir, { recursive: true });

  for (const user of users) {
    if (!user.isActive) continue;
    
    const numStrats = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < numStrats; i++) {
      const fileName = `${faker.string.alphanumeric(10)}.py`;
      const userDir = path.join(uploadsDir, user.id);
      await fs.mkdir(userDir, { recursive: true });
      await fs.writeFile(path.join(userDir, fileName), '# Sample Strategy Content');

      await prisma.strategy.create({
        data: {
          name: `${faker.commerce.productName()} Strategy`,
          description: faker.commerce.productDescription(),
          filePath: path.join('uploads', 'strategies', user.id, fileName),
          userId: user.id,
          status: StrategyStatus.COMPLETED,
          // FIX: Ép kiểu as any cho trường Json
          metadata: {
            symbols: ['AAPL', 'TSLA'],
            parameters: { period: 14 },
          } as any,
        }
      });
    }
  }
}

async function createBacktestResults() {
  console.log('Creating backtest results...');
  const strategies = await prisma.strategy.findMany();

  for (const strategy of strategies) {
    await prisma.backtestResult.create({
      data: {
        strategyId: strategy.id,
        sharpeRatio: faker.number.float({ min: 0.5, max: 3.0 }),
        maxDrawdown: faker.number.float({ min: 0.05, max: 0.2 }),
        totalReturn: faker.number.float({ min: 0.1, max: 0.5 }),
        // FIX: Ép kiểu as any cho mảng các object trong Json
        pnlSeries: [
          { date: '2023-01-01', value: 0 },
          { date: '2023-01-02', value: 0.02 }
        ] as any,
        logs: 'Backtest completed successfully',
      }
    });
  }
}

async function createAuditLogs() {
  console.log('Creating audit logs...');
  const users = await prisma.user.findMany();
  
  for (let i = 0; i < 20; i++) {
    const user = faker.helpers.arrayElement(users);
    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.id,
        action: 'STRATEGY_CREATED',
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        // FIX: Ép kiểu as any
        details: { info: 'System seed' } as any,
      }
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });