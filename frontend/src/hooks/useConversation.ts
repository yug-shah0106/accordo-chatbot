import { useState, useEffect, useRef } from "react";
import { conversationApi, dealsApi, type Deal, type Message } from "../api/client";
import { historyService } from "../services/storage";
import type { DealStatus } from "../services/storage";

export function useConversation(dealId: string | undefined) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [revealAvailable, setRevealAvailable] = useState(false);
  const autoStartedRef = useRef(false);
  const historyTrackedRef = useRef(false);

  // Track deal in history when it's loaded
  const trackDealInHistory = async (dealData: Deal, msgs: Message[]) => {
    if (!dealData || historyTrackedRef.current) return;

    try {
      historyTrackedRef.current = true;
      const existing = await historyService.getHistoryByDealId(dealData.id);
      const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;

      if (existing) {
        // Update existing entry
        await historyService.updateHistory(existing.id, {
          dealTitle: dealData.title,
          counterparty: dealData.vendor_name || "Unknown Vendor",
          status: dealData.status as DealStatus,
          lastMessage: lastMessage?.content || "",
          lastMessagePreview: lastMessage
            ? (lastMessage.content.length > 100
                ? lastMessage.content.slice(0, 100) + "..."
                : lastMessage.content)
            : "No messages yet",
        });
      } else {
        // Create new history entry
        const entry = historyService.createHistoryEntry(
          dealData.id,
          dealData.title,
          dealData.vendor_name || "Unknown Vendor"
        );
        entry.status = dealData.status as DealStatus;
        if (lastMessage) {
          entry.lastMessage = lastMessage.content;
          entry.lastMessagePreview = lastMessage.content.length > 100
            ? lastMessage.content.slice(0, 100) + "..."
            : lastMessage.content;
        }
        await historyService.saveHistory(entry);
      }
    } catch (error) {
      console.error("Failed to track deal in history:", error);
    }
  };

  // Track message in history
  const trackMessageInHistory = async (dealData: Deal, message: Message) => {
    try {
      const existing = await historyService.getHistoryByDealId(dealData.id);

      if (existing) {
        await historyService.updateHistory(existing.id, {
          status: dealData.status as DealStatus,
          lastMessage: message.content,
          lastMessagePreview: message.content.length > 100
            ? message.content.slice(0, 100) + "..."
            : message.content,
        });
      }
    } catch (error) {
      console.error("Failed to track message in history:", error);
    }
  };

  useEffect(() => {
    if (!dealId) return;
    historyTrackedRef.current = false; // Reset when dealId changes
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

      // Track in history
      await trackDealInHistory(data.deal, sanitized);
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

      // Track last message in history
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage) {
        await trackMessageInHistory(result.deal, lastMessage);
      }
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
      historyTrackedRef.current = false; // Reset history tracking
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

      // Update history with reset state
      await trackDealInHistory(result.deal, sanitized);
    } catch (error) {
      console.error("Failed to reset deal:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Allow send for initial states too (CREATED, NEGOTIATING)
  const canSend = ["CREATED", "NEGOTIATING"].includes(deal?.status ?? "") && !sending;
  const canReset = true; // Always allowed

  // Auto-start conversation if no messages and deal is in initial state (only once)
  useEffect(() => {
    if (!loading && deal && messages.length === 0 && dealId && !autoStartedRef.current) {
      const status = deal.status;
      const canStart = (status === "CREATED" || status === "NEGOTIATING") && !sending;
      if (canStart) {
        autoStartedRef.current = true;
        // Auto-start by calling the start endpoint
        conversationApi.start(dealId).then(async result => {
          setDeal(result.deal);
          setMessages(result.messages);
          setRevealAvailable(result.revealAvailable);

          // Track initial message in history
          const lastMessage = result.messages[result.messages.length - 1];
          if (lastMessage) {
            await trackMessageInHistory(result.deal, lastMessage);
          }
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
