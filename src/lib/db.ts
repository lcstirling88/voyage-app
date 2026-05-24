import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. Add a Neon (or other Postgres) connection string to .env')
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
