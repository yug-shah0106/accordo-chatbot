import { vendorPolicy } from "./vendorPolicy";
import { OfferSchema } from "../engine/types";
import { z } from "zod";

const VendorResponseSchema = OfferSchema.extend({
  message: z.string()
});

export type VendorResponse = z.infer<typeof VendorResponseSchema>;

export async function vendorRespond(args: {
  dealTitle: string;
  round: number;
  lastAccordoText: string;
  lastAccordoCounterOffer: any | null; // {unit_price, payment_terms} if present
  scenario?: "HARD" | "SOFT" | "WALK_AWAY"; // Scenario for deterministic demos
}): Promise<VendorResponse> {
  const base = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL!;

  const isFirstRound = args.round === 1 && args.lastAccordoText === "Start negotiation.";
  const initialPrice = isFirstRound ? vendorPolicy.start_price : undefined;
  const scenario = args.scenario || "HARD";

  // Scenario-specific behavior
  let scenarioInstructions = "";
  if (scenario === "HARD") {
    scenarioInstructions = "- Be firm and resist concessions. Start high and concede very slowly.";
  } else if (scenario === "SOFT") {
    scenarioInstructions = "- Be more flexible. Willing to negotiate and find middle ground.";
  } else if (scenario === "WALK_AWAY") {
    scenarioInstructions = "- Be very inflexible. If pressured too much, indicate you may need to walk away.";
  }

  const prompt = `
You are a vendor sales rep negotiating.
You must follow vendor policy (strict):
- Never offer unit_price below ${vendorPolicy.min_price}
- Prefer payment terms ${vendorPolicy.preferred_terms}
- Avoid ${vendorPolicy.worst_terms} unless price is high
- Concede slowly (step ${vendorPolicy.concession_step}) over rounds, not all at once
${isFirstRound ? `- This is the first round. Start with price around ${vendorPolicy.start_price} and prefer ${vendorPolicy.preferred_terms}` : ""}
${scenarioInstructions}
Return ONLY JSON in this exact schema:
{"unit_price": number, "payment_terms":"Net 30"|"Net 60"|"Net 90", "message": string}

Deal: ${args.dealTitle}
Round: ${args.round}
Scenario: ${scenario}
${isFirstRound ? "This is the opening offer. Make a strong initial proposal." : `Last Accordo message: """${args.lastAccordoText}"""`}
${args.lastAccordoCounterOffer ? `Accordo requested terms: ${JSON.stringify(args.lastAccordoCounterOffer)}` : ""}
`;

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  
  if (!res.ok) {
    console.warn(`Ollama API error (${res.status}), using fallback`);
    const fallbackPrice = Math.max(vendorPolicy.min_price, 110 - args.round * 2);
    const fallbackTerms = args.round <= 2 ? vendorPolicy.preferred_terms : "Net 30";
    return {
      unit_price: fallbackPrice,
      payment_terms: fallbackTerms,
      message: `We can do $${fallbackPrice} ${fallbackTerms}.`,
    };
  }

  const data = await res.json();
  const raw = ((data as any).response ?? "").trim();

  // Check if response is empty
  if (!raw) {
    console.warn("Ollama returned empty response, using fallback");
    const fallbackPrice = Math.max(vendorPolicy.min_price, 110 - args.round * 2);
    const fallbackTerms = args.round <= 2 ? vendorPolicy.preferred_terms : "Net 30";
    return {
      unit_price: fallbackPrice,
      payment_terms: fallbackTerms,
      message: `We can do $${fallbackPrice} ${fallbackTerms}.`,
    };
  }

  // Try to extract JSON from the response (might have markdown code blocks)
  let jsonStr = raw;
  
  // First, try to extract from markdown code blocks
  const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find JSON object directly in the response
    const directJsonMatch = raw.match(/\{[\s\S]*\}/);
    if (directJsonMatch && directJsonMatch[0]) {
      jsonStr = directJsonMatch[0].trim();
    }
  }

  // Validate that we have something to parse
  if (!jsonStr || !jsonStr.startsWith('{')) {
    console.warn("Ollama returned non-JSON response, using fallback");
    const fallbackPrice = Math.max(vendorPolicy.min_price, 110 - args.round * 2);
    const fallbackTerms = args.round <= 2 ? vendorPolicy.preferred_terms : "Net 30";
    return {
      unit_price: fallbackPrice,
      payment_terms: fallbackTerms,
      message: `We can do $${fallbackPrice} ${fallbackTerms}.`,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    // Fallback: deterministic response if Ollama returns non-JSON
    console.warn("Ollama returned invalid JSON, using fallback");
    const fallbackPrice = Math.max(vendorPolicy.min_price, 110 - args.round * 2);
    const fallbackTerms = args.round <= 2 ? vendorPolicy.preferred_terms : "Net 30";
    return {
      unit_price: fallbackPrice,
      payment_terms: fallbackTerms,
      message: `We can do $${fallbackPrice} ${fallbackTerms}.`,
    };
  }

  // Guardrail: validate schema + clamp min price
  let validated: VendorResponse;
  try {
    validated = VendorResponseSchema.parse(parsed);
  } catch (error) {
    // Fallback if schema validation fails
    console.warn("LLM reply failed validation, using fallback");
    const fallbackPrice = Math.max(vendorPolicy.min_price, 110 - args.round * 2);
    const fallbackTerms = args.round <= 2 ? vendorPolicy.preferred_terms : "Net 30";
    return {
      unit_price: fallbackPrice,
      payment_terms: fallbackTerms,
      message: `We can do $${fallbackPrice} ${fallbackTerms}.`,
    };
  }

  if (validated.unit_price !== null && validated.unit_price < vendorPolicy.min_price) {
    validated.unit_price = vendorPolicy.min_price;
  }

  return validated; // {unit_price, payment_terms, message}
}

