import { useState, useEffect, useRef } from "react";
import { conversationApi, dealsApi, type Deal, type Message } from "../api/client";

export function useConversation(dealId: string | undefined) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [revealAvailable, setRevealAvailable] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!dealId) return;
    loadDeal();
  }, [dealId]);

  const loadDeal = async () => {
    if (!dealId) return;
    try {
      setLoading(true);
      // Use regular deals API to get initial state (messages will be sanitized by conversation endpoint)
      const data = await dealsApi.get(dealId);
      setDeal(data.deal);
      // Sanitize messages for conversation view (remove metadata)
      const sanitized = data.messages.map((m: Message) => ({
        id: m.id,
        deal_id: m.deal_id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));
      setMessages(sanitized);
      // Check if explainability is available
      const lastAccordo = [...data.messages].reverse().find((m: Message) => m.role === "ACCORDO");
      setRevealAvailable(!!lastAccordo?.explainability_json);
    } catch (error) {
      console.error("Failed to load deal:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!dealId || !text.trim()) return;
    
    try {
      setSending(true);
      const result = await conversationApi.sendMessage(dealId, text);
      setDeal(result.deal);
      setMessages(result.messages);
      setRevealAvailable(result.revealAvailable);
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (!dealId) return;
    
    try {
      setLoading(true);
      autoStartedRef.current = false; // Reset the auto-start ref
      const result = await dealsApi.reset(dealId);
      setDeal(result.deal);
      // Sanitize messages for conversation view
      const sanitized = result.messages.map((m: Message) => ({
        id: m.id,
        deal_id: m.deal_id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));
      setMessages(sanitized);
      setRevealAvailable(false);
    } catch (error) {
      console.error("Failed to reset deal:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ Allow send for initial states too (CREATED, NEGOTIATING)
  const canSend = ["CREATED", "NEGOTIATING"].includes(deal?.status ?? "") && !sending;
  const canReset = true; // Always allowed

  // ✅ Auto-start conversation if no messages and deal is in initial state (only once)
  useEffect(() => {
    if (!loading && deal && messages.length === 0 && dealId && !autoStartedRef.current) {
      const status = deal.status;
      const canStart = (status === "CREATED" || status === "NEGOTIATING") && !sending;
      if (canStart) {
        autoStartedRef.current = true;
        // Auto-start by calling the start endpoint
        conversationApi.start(dealId).then(result => {
          setDeal(result.deal);
          setMessages(result.messages);
          setRevealAvailable(result.revealAvailable);
        }).catch(err => {
          console.error("Failed to auto-start conversation:", err);
          autoStartedRef.current = false; // Reset on error so it can retry
          // If start fails, it's okay - user can send a message manually
        });
      }
    }
  }, [loading, deal?.id, deal?.status, messages.length, sending, dealId]);

  return {
    deal,
    messages,
    loading,
    sending,
    revealAvailable,
    canSend,
    canReset,
    sendMessage,
    reset,
    reload: loadDeal,
  };
}

