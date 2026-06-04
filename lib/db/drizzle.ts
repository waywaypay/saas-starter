import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const postgresUrl = process.env.POSTGRES_URL;

export const client = postgresUrl ? postgres(postgresUrl) : null as unknown as ReturnType<typeof postgres>;
export const db = postgresUrl
  ? drizzle(client, { schema })
  : new Proxy({} as ReturnType<typeof drizzle>, {
      get() {
        throw new Error('POSTGRES_URL environment variable is not set');
      },
    });
