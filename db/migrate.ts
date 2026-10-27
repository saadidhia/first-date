import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

const db = drizzle({ connection: process.env.DATABASE_URL })
await migrate(db, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) })
await db.$client.end()
console.log('Migrations applied')
