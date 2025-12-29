import fs from "fs";
import path from "path";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sqlPath = path.join(process.cwd(), "sql", "003_add_templates.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);

  await client.end();
  console.log("✅ Migration 003_add_templates.sql applied successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

