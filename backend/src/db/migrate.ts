import fs from "fs";
import path from "path";
import { pool } from "./db";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const sqlDir = path.join(__dirname, "../../sql");
  const files = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith(".sql"))
    .sort(); // 001_, 002_, 003_

  console.log(`Found ${files.length} migration files: ${files.join(", ")}`);

  for (const f of files) {
    const full = path.join(sqlDir, f);
    const sql = fs.readFileSync(full, "utf8");
    console.log(`Applying ${f}...`);
    await pool.query(sql);
    console.log(`✅ ${f} applied`);
  }
  
  console.log("✅ All migrations applied.");
  await pool.end();
  process.exit(0);
}

run().catch(e => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
