import { pool } from "../db/db";
import { v4 as uuid } from "uuid";

export type NegotiationConfig = {
  parameters: {
    unit_price: {
      weight: number;
      direction: "lower_better" | "higher_better";
      anchor: number;
      target: number;
      max_acceptable: number;
      concession_step: number;
    };
    payment_terms: {
      weight: number;
      options: readonly ["Net 30", "Net 60", "Net 90"];
      utility: { "Net 30": number; "Net 60": number; "Net 90": number };
    };
  };
  accept_threshold: number;
  walkaway_threshold: number;
  max_rounds: number;
};

type TemplateRow = {
  id: string;
  name: string;
  accept_threshold: number;
  walkaway_threshold: number;
  max_rounds: number;
};

type ParamRow = {
  key: "unit_price" | "payment_terms";
  weight: number;
  direction: string;
  config: any; // JSONB
};

// In-memory cache for templates (10 second TTL)
const templateCache = new Map<string, { cfg: NegotiationConfig; expiresAt: number }>();
const TTL_MS = 10_000;

/**
 * Load negotiation template config for a deal
 * Returns normalized config object for the engine
 * 
 * For MVP: Strict mode - throws if template missing (no silent fallback)
 * Use getDefaultConfig() only in dev mode or if explicitly needed
 */
export async function getTemplateForDeal(dealId: string): Promise<NegotiationConfig> {
  // 1) Fetch deal (use negotiation_template_id column)
  const dealResult = await pool.query(
    `SELECT negotiation_template_id FROM deals WHERE id=$1`,
    [dealId]
  );
  if (dealResult.rows.length === 0) {
    throw new Error("Deal not found");
  }

  const templateId: string | null = dealResult.rows[0].negotiation_template_id ?? null;

  // 2) If missing template: throw (strict mode for MVP)
  // This prevents silent fallback to wrong config in demos
  if (!templateId) {
    // For MVP: throw to ensure every deal has explicit template
    // Uncomment fallback only if you intentionally want legacy mode
    throw new Error(`Deal ${dealId} has no negotiation_template_id. Assign a template before processing.`);
    // return getDefaultConfig(); // Keep only if you intentionally want fallback
  }

  // 3) Check cache first
  const cached = templateCache.get(templateId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.cfg;
  }

  // 4) Fetch template + params in parallel
  const [templateResult, paramsResult] = await Promise.all([
    pool.query(
      `SELECT id, name, accept_threshold, walkaway_threshold, max_rounds 
       FROM negotiation_templates WHERE id=$1`,
      [templateId]
    ),
    pool.query(
      `SELECT key, weight, direction, config 
       FROM negotiation_parameters WHERE template_id=$1`,
      [templateId]
    ),
  ]);

  if (templateResult.rows.length === 0) {
    throw new Error(`Template ${templateId} not found`);
  }

  // 5) Build and validate config
  const config = buildConfig(templateResult.rows[0], paramsResult.rows);
  validateConfig(config);

  // 6) Cache for performance
  templateCache.set(templateId, { cfg: config, expiresAt: Date.now() + TTL_MS });

  return config;
}

/**
 * Build normalized config from template and parameters
 */
function buildConfig(template: TemplateRow, params: ParamRow[]): NegotiationConfig {
  const unit = params.find(p => p.key === "unit_price");
  const terms = params.find(p => p.key === "payment_terms");

  if (!unit || !terms) {
    throw new Error("Template missing required parameters (unit_price/payment_terms)");
  }

  return {
    parameters: {
      unit_price: {
        weight: Number(unit.weight),
        direction: unit.direction as "lower_better" | "higher_better",
        anchor: Number(unit.config.anchor),
        target: Number(unit.config.target),
        max_acceptable: Number(unit.config.max_acceptable),
        concession_step: Number(unit.config.concession_step),
      },
      payment_terms: {
        weight: Number(terms.weight),
        options: terms.config.options as readonly ["Net 30", "Net 60", "Net 90"],
        utility: terms.config.utility as { "Net 30": number; "Net 60": number; "Net 90": number },
      },
    },
    accept_threshold: Number(template.accept_threshold),
    walkaway_threshold: Number(template.walkaway_threshold),
    max_rounds: Number(template.max_rounds),
  };
}

/**
 * Validate config to prevent runtime surprises
 */
export function validateConfig(cfg: NegotiationConfig) {
  // Weights must sum to 1.0
  const wSum =
    cfg.parameters.unit_price.weight +
    cfg.parameters.payment_terms.weight;

  if (Math.abs(wSum - 1) > 1e-6) {
    throw new Error(`Invalid config: weights must sum to 1.0 (got ${wSum})`);
  }

  // Unit price validation
  const { anchor, target, max_acceptable, concession_step } = cfg.parameters.unit_price;
  if (!(anchor < target && target <= max_acceptable)) {
    throw new Error(`Invalid unit_price: require anchor < target <= max_acceptable (got anchor=${anchor}, target=${target}, max=${max_acceptable})`);
  }
  if (concession_step <= 0) {
    throw new Error(`Invalid unit_price: concession_step must be > 0 (got ${concession_step})`);
  }

  // Payment terms validation
  const opts = cfg.parameters.payment_terms.options;
  const util = cfg.parameters.payment_terms.utility;

  for (const o of opts) {
    if (typeof util[o] !== "number") {
      throw new Error(`Invalid payment_terms: missing utility for ${o}`);
    }
  }

  // Threshold validation
  if (cfg.accept_threshold <= cfg.walkaway_threshold) {
    throw new Error(`Invalid thresholds: accept_threshold (${cfg.accept_threshold}) must be > walkaway_threshold (${cfg.walkaway_threshold})`);
  }

  // Max rounds validation
  if (cfg.max_rounds < 1 || cfg.max_rounds > 50) {
    throw new Error(`Invalid max_rounds: must be between 1 and 50 (got ${cfg.max_rounds})`);
  }
}

/**
 * Default config (fallback for deals without template)
 * This matches the original hardcoded config
 */
function getDefaultConfig(): NegotiationConfig {
  return {
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
    accept_threshold: 0.70,
    walkaway_threshold: 0.45,
    max_rounds: 6,
  };
}

/**
 * Create a negotiation template
 */
export async function createNegotiationTemplate(input: {
  name: string;
  accept_threshold: number;
  walkaway_threshold: number;
  max_rounds: number;
  parameters: {
    unit_price: {
      weight: number;
      direction: "lower_better" | "higher_better";
      anchor: number;
      target: number;
      max_acceptable: number;
      concession_step: number;
    };
    payment_terms: {
      weight: number;
      options: readonly string[];
      utility: Record<string, number>;
    };
  };
}): Promise<{ id: string }> {
  const templateId = uuid();

  // Insert template
  await pool.query(
    `INSERT INTO negotiation_templates(id, name, accept_threshold, walkaway_threshold, max_rounds)
     VALUES($1, $2, $3, $4, $5)`,
    [
      templateId,
      input.name,
      input.accept_threshold,
      input.walkaway_threshold,
      input.max_rounds,
    ]
  );

  // Insert parameters
  // Unit price parameter
  await pool.query(
    `INSERT INTO negotiation_parameters(template_id, key, weight, direction, config)
     VALUES($1, $2, $3, $4, $5)`,
    [
      templateId,
      "unit_price",
      input.parameters.unit_price.weight,
      input.parameters.unit_price.direction,
      JSON.stringify({
        anchor: input.parameters.unit_price.anchor,
        target: input.parameters.unit_price.target,
        max_acceptable: input.parameters.unit_price.max_acceptable,
        concession_step: input.parameters.unit_price.concession_step,
      }),
    ]
  );

  // Payment terms parameter
  await pool.query(
    `INSERT INTO negotiation_parameters(template_id, key, weight, direction, config)
     VALUES($1, $2, $3, $4, $5)`,
    [
      templateId,
      "payment_terms",
      input.parameters.payment_terms.weight,
      "lower_better", // direction not really used for terms
      JSON.stringify({
        options: input.parameters.payment_terms.options,
        utility: input.parameters.payment_terms.utility,
      }),
    ]
  );

  return { id: templateId };
}

