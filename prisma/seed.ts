/**
 * Seed: minimal. Now that the app has real users, we don't seed a demo trip —
 * sign up, then create your own. (The script just makes sure the DB connection works.)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const tripCount = await prisma.trip.count()
  const userCount = await prisma.user.count()
  console.log(`Connected. Current state:`)
  console.log(`  users: ${userCount}`)
  console.log(`  trips: ${tripCount}`)
  console.log(`\nNothing to seed — sign in to the app and create your first trip.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
