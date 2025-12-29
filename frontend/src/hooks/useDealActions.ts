import { useState, useEffect, useCallback } from "react";
import { dealsApi } from "../api/client";
import type { Deal, Message, NegotiationConfig } from "../api/client";

interface UseDealActionsResult {
  deal: Deal | null;
  messages: Message[];
  config: NegotiationConfig | null;
  loading: boolean;
  error: Error | null;
  sending: boolean;
  autoVendorLoading: boolean;
  runDemoLoading: boolean;
  resetLoading: boolean;
  
  // Action permissions
  canNegotiate: boolean;
  canRunDemo: boolean;
  canAutoVendor: boolean;
  canSend: boolean;
  canReset: boolean;
  
  // Actions
  sendVendorMessage: (text: string) => Promise<void>;
  autoVendor: () => Promise<void>;
  runDemo: () => Promise<void>;
  reset: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useDealActions(dealId: string | undefined): UseDealActionsResult {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [config, setConfig] = useState<NegotiationConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoVendorLoading, setAutoVendorLoading] = useState(false);
  const [runDemoLoading, setRunDemoLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!dealId) return;

    setLoading(true);
    setError(null);
    try {
      const [dealData, configData] = await Promise.all([
        dealsApi.get(dealId),
        dealsApi.getConfig(dealId).catch(() => null), // Gracefully handle if config endpoint fails
      ]);
      setDeal(dealData.deal);
      setMessages(dealData.messages);
      setConfig(configData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load deal");
      setError(error);
      console.error("Failed to load deal:", err);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const sendVendorMessage = useCallback(async (text: string) => {
    if (!dealId || !text.trim() || sending) return;

    setSending(true);
    try {
      const result = await dealsApi.sendMessage(dealId, text);
      // API now returns deal + messages, so update state directly
      if (result.deal && result.messages) {
        setDeal(result.deal);
        setMessages(result.messages);
      } else {
        // Fallback to reload if response format is unexpected
        await reload();
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error("Failed to send message");
      setError(error);
      console.error("Failed to send message:", err);
      // If 409 Conflict, update state with returned deal/messages
      if (err.response?.status === 409 && err.response?.data?.deal && err.response?.data?.messages) {
        setDeal(err.response.data.deal);
        setMessages(err.response.data.messages);
      }
      throw error;
    } finally {
      setSending(false);
    }
  }, [dealId, sending, reload]);

  const autoVendor = useCallback(async () => {
    if (!dealId || autoVendorLoading || sending) return;

    setAutoVendorLoading(true);
    try {
      // Micro delay for realism (400-900ms)
      const delay = 400 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      const result = await dealsApi.autoVendorReply(dealId);
      // API now returns deal + messages, so update state directly
      if (result.deal && result.messages) {
        setDeal(result.deal);
        setMessages(result.messages);
      } else {
        await reload();
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error("Failed to generate auto vendor reply");
      setError(error);
      console.error("Failed to generate auto vendor reply:", err);
      // If 409 Conflict, update state with returned deal/messages
      if (err.response?.status === 409 && err.response?.data?.deal && err.response?.data?.messages) {
        setDeal(err.response.data.deal);
        setMessages(err.response.data.messages);
      }
      throw error;
    } finally {
      setAutoVendorLoading(false);
    }
  }, [dealId, autoVendorLoading, sending, reload]);

  const runDemo = useCallback(async () => {
    if (!dealId || runDemoLoading || sending || autoVendorLoading) return;

    setRunDemoLoading(true);
    try {
      const result = await dealsApi.runDemo(dealId, 10);
      // API now returns deal + messages, so update state directly
      if (result.deal && result.messages) {
        setDeal(result.deal);
        setMessages(result.messages);
      } else {
        await reload();
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error("Failed to run demo");
      setError(error);
      console.error("Failed to run demo:", err);
      // If 409 Conflict, update state with returned deal/messages
      if (err.response?.status === 409 && err.response?.data?.deal && err.response?.data?.messages) {
        setDeal(err.response.data.deal);
        setMessages(err.response.data.messages);
      }
      throw error;
    } finally {
      setRunDemoLoading(false);
    }
  }, [dealId, runDemoLoading, sending, autoVendorLoading, reload]);

  const reset = useCallback(async () => {
    if (!dealId || resetLoading) return;

    setResetLoading(true);
    try {
      const result = await dealsApi.reset(dealId);
      // API returns deal + messages, so update state directly
      if (result.deal && result.messages) {
        setDeal(result.deal);
        setMessages(result.messages);
      } else {
        await reload();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to reset deal");
      setError(error);
      console.error("Failed to reset deal:", err);
      throw error;
    } finally {
      setResetLoading(false);
    }
  }, [dealId, resetLoading, reload]);

  // Calculate permissions
  const canNegotiate = deal?.status === "NEGOTIATING";
  const maxRounds = config?.max_rounds ?? 6; // Fallback to 6 if config not loaded
  const canRunDemo = canNegotiate && (deal?.round ?? 0) < maxRounds;
  const canAutoVendor = canNegotiate;
  // ✅ Allow chat when status is ESCALATED (but disable AutoVendor/RunDemo)
  const canSend = !!deal && (deal.status === "NEGOTIATING" || deal.status === "ESCALATED");
  const canReset = true; // Always allowed

  // Initial load
  useEffect(() => {
    if (dealId) {
      reload();
    }
  }, [dealId, reload]);

  return {
    deal,
    messages,
    config,
    loading,
    error,
    sending,
    autoVendorLoading,
    runDemoLoading,
    resetLoading,
    canNegotiate,
    canRunDemo,
    canAutoVendor,
    canSend,
    canReset,
    sendVendorMessage,
    autoVendor,
    runDemo,
    reset,
    reload,
  };
}

