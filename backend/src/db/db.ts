import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please create a .env file in the backend directory with:\n" +
    "DATABASE_URL=postgresql://accordo:accordo@localhost:5432/accordo_mvp"
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

