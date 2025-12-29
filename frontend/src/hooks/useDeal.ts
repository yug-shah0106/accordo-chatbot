import { useState, useEffect } from "react";
import { dealsApi } from "../api/client";
import type { Deal, Message } from "../api/client";

interface UseDealResult {
  deal: Deal | null;
  messages: Message[];
  loading: boolean;
  error: Error | null;
  sending: boolean;
  autoVendorLoading: boolean;
  sendVendorMessage: (text: string) => Promise<void>;
  autoVendor: () => Promise<void>;
  fetchDeal: () => Promise<void>;
}

export function useDeal(dealId: string | undefined): UseDealResult {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoVendorLoading, setAutoVendorLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDeal = async () => {
    if (!dealId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await dealsApi.get(dealId);
      setDeal(data.deal);
      setMessages(data.messages);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load deal");
      setError(error);
      console.error("Failed to load deal:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendVendorMessage = async (text: string) => {
    if (!dealId || !text.trim() || sending) return;

    setSending(true);
    try {
      await dealsApi.sendMessage(dealId, text);
      await fetchDeal(); // Refresh to get new messages
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to send message");
      setError(error);
      console.error("Failed to send message:", err);
      throw error;
    } finally {
      setSending(false);
    }
  };

  const autoVendor = async () => {
    if (!dealId || autoVendorLoading || sending) return;

    setAutoVendorLoading(true);
    try {
      await dealsApi.autoVendorReply(dealId);
      await fetchDeal(); // Refresh to get new messages
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to generate auto vendor reply");
      setError(error);
      console.error("Failed to generate auto vendor reply:", err);
      throw error;
    } finally {
      setAutoVendorLoading(false);
    }
  };

  useEffect(() => {
    fetchDeal();
  }, [dealId]);

  return {
    deal,
    messages,
    loading,
    error,
    sending,
    autoVendorLoading,
    sendVendorMessage,
    autoVendor,
    fetchDeal,
  };
}
