/**
 * Reference data seed (idempotent — safe to run repeatedly).
 * Usage: npm run db:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedReferenceData } from './seed-data';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

seedReferenceData(prisma)
  .then((r) =>
    console.log(
      `Seeded ${r.achievements} achievements, ${r.accessories} accessories, ${r.quests} quests.`,
    ),
  )
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
