import { pool } from "./db";
import { createNegotiationTemplate } from "../repo/templatesRepo";
import dotenv from "dotenv";

dotenv.config();

async function seedDefaultTemplate() {
  try {
    // Check if default template already exists
    const existing = await pool.query(
      "SELECT id FROM negotiation_templates WHERE name = $1",
      ["Default Buy-side"]
    );

    let templateId: string;

    if (existing.rows.length > 0) {
      templateId = existing.rows[0].id;
      console.log(`✅ Default template already exists: ${templateId}`);
    } else {
      // Create default template matching original hardcoded config
      const template = await createNegotiationTemplate({
        name: "Default Buy-side",
        accept_threshold: 0.70,
        walkaway_threshold: 0.45,
        max_rounds: 6,
        parameters: {
          unit_price: {
            weight: 0.6,
            direction: "lower_better",
            anchor: 75,
            target: 85,
            max_acceptable: 100,
            concession_step: 2,
          },
          payment_terms: {
            weight: 0.4,
            options: ["Net 30", "Net 60", "Net 90"] as const,
            utility: { "Net 30": 0.2, "Net 60": 0.6, "Net 90": 1.0 },
          },
        },
      });
      templateId = template.id;
      console.log(`✅ Created default template: ${templateId}`);
    }

    // Assign default template to all deals without a template
    const updateResult = await pool.query(
      `UPDATE deals 
       SET negotiation_template_id = $1 
       WHERE negotiation_template_id IS NULL
       RETURNING id`,
      [templateId]
    );

    if (updateResult.rows.length > 0) {
      console.log(`✅ Assigned default template to ${updateResult.rows.length} existing deals`);
    }

    await pool.end();
  } catch (error) {
    console.error("❌ Error seeding default template:", error);
    await pool.end();
    process.exit(1);
  }
}

seedDefaultTemplate();
