import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

const db = drizzle({ connection: process.env.DATABASE_URL })
await migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname })
await db.$client.end()
console.log('Migrations applied')
