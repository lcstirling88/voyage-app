import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  throw new Error('DATABASE_URL is not set. Drop your Neon connection string into .env')
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
