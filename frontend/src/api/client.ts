import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface Deal {
  id: string;
  title: string;
  counterparty?: string;
  status: string;
  round: number;
  latest_offer_json?: any;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  deleted_at?: string | null;
}

export interface Explainability {
  vendorOffer: { unit_price: number | null; payment_terms: string | null };
  utilities: {
    priceUtility: number | null;
    termsUtility: number | null;
    weightedPrice: number | null;
    weightedTerms: number | null;
    total: number | null;
  };
  decision: {
    action: string;
    reasons: string[];
    counterOffer?: { unit_price: number | null; payment_terms: string | null } | null;
  };
  configSnapshot: {
    weights: { price: number; terms: number };
    thresholds: { accept: number; walkaway: number };
    unitPrice: { anchor: number; target: number; max: number; step: number };
    termOptions: string[];
  };
}

export interface Message {
  id: string;
  deal_id: string;
  role: "VENDOR" | "ACCORDO" | "SYSTEM";
  content: string;
  extracted_offer?: any;
  engine_decision?: any;
  explainability_json?: Explainability | null;
  created_at: string;
}

export interface NegotiationConfig {
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
}

export const dealsApi = {
  list: async () => {
    const res = await api.get<{ deals: Deal[] }>("/deals");
    return res.data;
  },
  create: async (data: { title: string; counterparty?: string; templateId?: string }) => {
    const res = await api.post<{ id: string }>("/deals", data);
    return res.data;
  },
  get: async (dealId: string) => {
    const res = await api.get<{ deal: Deal; messages: Message[] }>(`/deals/${dealId}`);
    return res.data;
  },
  getConfig: async (dealId: string) => {
    const res = await api.get<{ config: NegotiationConfig }>(`/deals/${dealId}/config`);
    return res.data.config;
  },
  sendMessage: async (dealId: string, text: string) => {
    const res = await api.post<{ deal: Deal; messages: Message[]; decision: any; reply: string }>(`/deals/${dealId}/messages`, { text });
    return res.data;
  },
  autoVendorReply: async (dealId: string) => {
    const res = await api.post<{ deal: Deal; messages: Message[]; vendorGenerated: any; decision: any; reply: string }>(`/deals/${dealId}/vendor/next`);
    return res.data;
  },
  reset: async (dealId: string) => {
    const res = await api.post<{ deal: Deal; messages: Message[] }>(`/deals/${dealId}/reset`);
    return res.data;
  },
  runDemo: async (dealId: string, maxSteps?: number) => {
    const res = await api.post<{ deal: Deal; messages: Message[]; steps: any[] }>(`/deals/${dealId}/run-demo`, { maxSteps });
    return res.data;
  },

  // Deal lifecycle methods
  listArchived: async () => {
    const res = await api.get<{ deals: Deal[] }>("/deals/archived");
    return res.data;
  },
  listDeleted: async () => {
    const res = await api.get<{ deals: Deal[] }>("/deals/deleted");
    return res.data;
  },
  archive: async (dealId: string) => {
    const res = await api.post<{ deal: Deal }>(`/deals/${dealId}/archive`);
    return res.data;
  },
  unarchive: async (dealId: string) => {
    const res = await api.post<{ deal: Deal }>(`/deals/${dealId}/unarchive`);
    return res.data;
  },
  softDelete: async (dealId: string) => {
    const res = await api.post<{ deal: Deal }>(`/deals/${dealId}/soft-delete`);
    return res.data;
  },
  restore: async (dealId: string) => {
    const res = await api.post<{ deal: Deal }>(`/deals/${dealId}/restore`);
    return res.data;
  },
  archiveFromDeleted: async (dealId: string) => {
    const res = await api.post<{ deal: Deal }>(`/deals/${dealId}/archive-from-deleted`);
    return res.data;
  },
  permanentlyDelete: async (dealId: string) => {
    const res = await api.delete<{ success: boolean }>(`/deals/${dealId}/permanent`);
    return res.data;
  },
};

export const conversationApi = {
  start: async (dealId: string) => {
    const res = await api.post<{ deal: Deal; messages: Message[]; revealAvailable: boolean }>(
      `/convo/deals/${dealId}/start`
    );
    return res.data;
  },
  sendMessage: async (dealId: string, text: string) => {
    const res = await api.post<{ deal: Deal; messages: Message[]; revealAvailable: boolean }>(
      `/convo/deals/${dealId}/messages`,
      { text }
    );
    return res.data;
  },
  getExplain: async (dealId: string) => {
    const res = await api.get<{
      vendorOffer: { unit_price: number | null; payment_terms: string | null };
      utilities: {
        priceUtility: number | null;
        termsUtility: number | null;
        weightedPrice: number | null;
        weightedTerms: number | null;
        total: number | null;
      };
      decision: {
        action: string;
        reasons: string[];
        counterOffer?: { unit_price: number | null; payment_terms: string | null } | null;
      };
      reasons: string[];
      counterOffer?: { unit_price: number | null; payment_terms: string | null } | null;
      configSnapshot: {
        weights: { price: number; terms: number };
        thresholds: { accept: number; walkaway: number };
        unitPrice: { anchor: number; target: number; max: number; step: number };
        termOptions: string[];
      };
    }>(`/convo/deals/${dealId}/last-explain`);
    return res.data;
  },
};

