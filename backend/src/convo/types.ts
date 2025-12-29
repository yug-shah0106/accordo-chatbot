export type PaymentTerms = "Net 30" | "Net 60" | "Net 90";

export type Offer = {
  unit_price: number | null;
  payment_terms: PaymentTerms | null;
};

export type DecisionAction = "ACCEPT" | "COUNTER" | "ASK_CLARIFY" | "ESCALATE" | "WALK_AWAY";

export type Decision = {
  action: DecisionAction;
  utilityScore: number; // total utility for vendorOffer if computable
  counterOffer: Offer | null;
  reasons: string[];
};

export type NegotiationConfig = {
  parameters: {
    unit_price: {
      weight: number;
      direction: "lower_better";
      anchor: number;
      target: number;
      max_acceptable: number;
      concession_step: number;
    };
    payment_terms: {
      weight: number;
      options: readonly PaymentTerms[];
      utility: Record<PaymentTerms, number>;
    };
  };
  accept_threshold: number;
  walkaway_threshold: number;
  max_rounds: number;
};

export type Explainability = {
  vendorOffer: Offer;
  utilities: {
    priceUtility: number | null;
    termsUtility: number | null;
    weightedPrice: number | null;
    weightedTerms: number | null;
    total: number | null;
  };
  decision: {
    action: DecisionAction;
    reasons: string[];
    counterOffer: Offer | null;
  };
  configSnapshot: {
    weights: { price: number; terms: number };
    thresholds: { accept: number; walkaway: number };
    unitPrice: { anchor: number; target: number; max: number; step: number };
    termOptions: PaymentTerms[];
  };
};

export type ConvoPhase = "WAITING_FOR_OFFER" | "WAITING_FOR_PREFERENCE" | "NEGOTIATING" | "TERMINAL";

export type ConvoState = {
  phase: ConvoPhase;
  askedPreference?: boolean;
  awaitingPreference?: boolean;
  lastVendorOffer?: Offer | null;
  pendingCounter?: Offer | null;
  pendingCounterOffer?: Offer | null; // alias for pendingCounter
  lastIntent?: string;
  preferenceAskedForOfferId?: string; // prevent asking preference multiple times for same offer
  refusalCount?: number; // how many times vendor refused without new offer
  convoRound?: number; // separate from deal.round if needed
};

