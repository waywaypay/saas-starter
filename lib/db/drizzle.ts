import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

type Database = PostgresJsDatabase<typeof schema>;

let clientInstance: ReturnType<typeof postgres> | null = null;
let dbInstance: Database | null = null;

function init() {
  if (!dbInstance) {
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    clientInstance = postgres(postgresUrl);
    dbInstance = drizzle(clientInstance, { schema });
  }
  return dbInstance;
}

// Lazily initialize the database client so importing this module does not throw
// at build time when POSTGRES_URL is absent. The real connection is created on
// first use (request time).
export const client = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop, receiver) {
    init();
    const value = Reflect.get(clientInstance as object, prop, receiver);
    return typeof value === 'function' ? value.bind(clientInstance) : value;
  }
}) as ReturnType<typeof postgres>;

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = init();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  }
}) as Database;
