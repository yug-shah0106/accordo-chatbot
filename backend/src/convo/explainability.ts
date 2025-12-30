import type { Decision, Explainability, NegotiationConfig, Offer } from "./types";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function priceUtility(config: NegotiationConfig, price: number) {
  const { anchor, max_acceptable } = config.parameters.unit_price;
  if (price <= anchor) return 1;
  if (price >= max_acceptable) return 0;
  return 1 - (price - anchor) / (max_acceptable - anchor);
}

function termsUtility(config: NegotiationConfig, terms: Offer["payment_terms"]) {
  if (!terms) return 0;
  return config.parameters.payment_terms.utility[terms] ?? 0;
}

export function computeExplainability(
  config: NegotiationConfig,
  vendorOffer: Offer,
  decision: Decision
): Explainability {
  const wP = config.parameters.unit_price.weight;
  const wT = config.parameters.payment_terms.weight;

  const pu = vendorOffer.unit_price == null ? null : priceUtility(config, vendorOffer.unit_price);
  const tu = vendorOffer.payment_terms == null ? null : termsUtility(config, vendorOffer.payment_terms);

  const weightedPrice = pu == null ? null : clamp01(pu * wP);
  const weightedTerms = tu == null ? null : clamp01(tu * wT);

  const total =
    weightedPrice == null || weightedTerms == null ? null : clamp01(weightedPrice + weightedTerms);

  return {
    vendorOffer: {
      unit_price: vendorOffer.unit_price,
      payment_terms: vendorOffer.payment_terms,
    },
    utilities: {
      priceUtility: pu,
      termsUtility: tu,
      weightedPrice,
      weightedTerms,
      total,
    },
    decision: {
      action: decision.action,
      reasons: decision.reasons ?? [],
      counterOffer: decision.counterOffer ?? null,
    },
    configSnapshot: {
      weights: { price: wP, terms: wT },
      thresholds: { accept: config.accept_threshold, walkaway: config.walkaway_threshold },
      unitPrice: {
        anchor: config.parameters.unit_price.anchor,
        target: config.parameters.unit_price.target,
        max: config.parameters.unit_price.max_acceptable,
        step: config.parameters.unit_price.concession_step,
      },
      termOptions: [...config.parameters.payment_terms.options],
    },
  };
}

