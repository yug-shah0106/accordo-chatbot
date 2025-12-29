import { pool } from "./db";
import * as fs from "fs";
import * as path from "path";

async function migrate() {
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, "../../sql/002_add_derived_fields.sql"),
    "utf-8"
  );

  try {
    await pool.query(migrationSQL);
    console.log("✅ Migration 002_add_derived_fields.sql applied successfully");
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      console.log("ℹ️  Migration already applied (columns may already exist)");
    } else {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

migrate();

