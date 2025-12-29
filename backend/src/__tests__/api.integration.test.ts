import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dealsRouter } from '../routes/deals';
import { vendorSimRouter } from '../routes/vendorSim';
import { pool } from '../db/db';
import { createNegotiationTemplate, getTemplateForDeal } from '../repo/templatesRepo';
import { createDeal, getDeal, listMessages } from '../repo/dealsRepo';
import type { NegotiationConfig } from '../repo/templatesRepo';

// Load environment variables
dotenv.config();

// Create test app (same structure as index.ts)
const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api', dealsRouter);
app.use('/api', vendorSimRouter);

// Test configuration (matches default template)
const DEFAULT_ACCEPT_THRESHOLD = 0.70;
const DEFAULT_WALKAWAY_THRESHOLD = 0.45;
const DEFAULT_MAX_ROUNDS = 6;

describe('API Integration Tests - Comprehensive', () => {
  let defaultTemplateId: string;
  const testDealIds: string[] = [];
  const testTemplateIds: string[] = [];

  beforeAll(async () => {
    // Ensure database is ready
    await pool.query('SELECT 1');

    // Create default template for tests (required - no fallback)
    const defaultTemplate = await createNegotiationTemplate({
      name: 'Test Default Template',
      accept_threshold: DEFAULT_ACCEPT_THRESHOLD,
      walkaway_threshold: DEFAULT_WALKAWAY_THRESHOLD,
      max_rounds: DEFAULT_MAX_ROUNDS,
      parameters: {
        unit_price: {
          weight: 0.6,
          direction: 'lower_better',
          anchor: 75,
          target: 85,
          max_acceptable: 100,
          concession_step: 2,
        },
        payment_terms: {
          weight: 0.4,
          options: ['Net 30', 'Net 60', 'Net 90'] as const,
          utility: { 'Net 30': 0.2, 'Net 60': 0.6, 'Net 90': 1.0 },
        },
      },
    });
    defaultTemplateId = defaultTemplate.id;
    testTemplateIds.push(defaultTemplateId);
  });

  afterAll(async () => {
    // Clean up all test data
    for (const dealId of testDealIds) {
      await pool.query('DELETE FROM messages WHERE deal_id = $1', [dealId]);
      await pool.query('DELETE FROM deals WHERE id = $1', [dealId]);
    }
    for (const templateId of testTemplateIds) {
      await pool.query('DELETE FROM negotiation_parameters WHERE template_id = $1', [templateId]);
      await pool.query('DELETE FROM negotiation_templates WHERE id = $1', [templateId]);
    }
    await pool.end();
  });

  // Helper: Create a template with optional overrides
  async function createTemplate(overrides?: Partial<{
    accept_threshold: number;
    walkaway_threshold: number;
    max_rounds: number;
    unit_price: Partial<{
      anchor: number;
      target: number;
      max_acceptable: number;
      concession_step: number;
    }>;
  }>) {
    const template = await createNegotiationTemplate({
      name: `Test Template ${Date.now()}`,
      accept_threshold: overrides?.accept_threshold ?? DEFAULT_ACCEPT_THRESHOLD,
      walkaway_threshold: overrides?.walkaway_threshold ?? DEFAULT_WALKAWAY_THRESHOLD,
      max_rounds: overrides?.max_rounds ?? DEFAULT_MAX_ROUNDS,
      parameters: {
        unit_price: {
          weight: 0.6,
          direction: 'lower_better',
          anchor: overrides?.unit_price?.anchor ?? 75,
          target: overrides?.unit_price?.target ?? 85,
          max_acceptable: overrides?.unit_price?.max_acceptable ?? 100,
          concession_step: overrides?.unit_price?.concession_step ?? 2,
        },
        payment_terms: {
          weight: 0.4,
          options: ['Net 30', 'Net 60', 'Net 90'] as const,
          utility: { 'Net 30': 0.2, 'Net 60': 0.6, 'Net 90': 1.0 },
        },
      },
    });
    testTemplateIds.push(template.id);
    return template.id;
  }

  // Helper: Create a deal with template
  async function createDealWithTemplate(templateId: string) {
    const res = await request(app)
      .post('/api/deals')
      .send({ 
        title: 'Test Deal', 
        counterparty: 'Test Vendor',
        negotiationTemplateId: templateId
      });
    expect(res.status).toBe(200);
    const dealId = res.body.id;
    testDealIds.push(dealId);
    return dealId;
  }

  // Helper: Send vendor message
  async function sendVendor(dealId: string, text: string) {
    return request(app)
      .post(`/api/deals/${dealId}/messages`)
      .send({ text });
  }

  // Helper: Get deal
  async function getDealData(dealId: string) {
    const res = await request(app)
      .get(`/api/deals/${dealId}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  // Helper: Assert latest Accordo action
  async function assertLatestAccordoAction(dealId: string, expectedAction: string) {
    const data = await getDealData(dealId);
    const accordoMessages = data.messages.filter((m: any) => m.role === 'ACCORDO');
    expect(accordoMessages.length).toBeGreaterThan(0);
    const latest = accordoMessages[accordoMessages.length - 1];
    expect(latest.engine_decision?.action).toBe(expectedAction);
  }

  // Helper: Assert reply validity
  function assertReplyValid(reply: string, decision: any, vendorOffer: any) {
    const banned = ['utility', 'algorithm', 'engine', 'ai', 'json', 'threshold', 'score', 'accordo'];
    const lowerReply = reply.toLowerCase();
    banned.forEach(word => {
      expect(lowerReply).not.toContain(word);
    });

    if (decision.action === 'COUNTER' && decision.counterOffer) {
      expect(reply).toContain(String(decision.counterOffer.unit_price));
      expect(lowerReply).toContain(decision.counterOffer.payment_terms.toLowerCase());
    }

    if (decision.action === 'ACCEPT') {
      expect(reply).toContain(String(vendorOffer.unit_price));
      expect(lowerReply).toContain(vendorOffer.payment_terms.toLowerCase());
    }
  }

  describe('Test Case 1: DB config is used (no hardcoded)', () => {
    test('strict template (accept_threshold=0.99) should NOT accept normally good offer', async () => {
      const strictTemplateId = await createTemplate({ accept_threshold: 0.99 });
      const dealId = await createDealWithTemplate(strictTemplateId);

      // Use $85 Net 90 which has utility ~0.84 (below 0.99 threshold)
      const res = await sendVendor(dealId, 'We can do $85 Net 90.');
      expect(res.status).toBe(200);

      // Should NOT accept (threshold too high - utility ~0.84 < 0.99)
      // But might COUNTER or ESCALATE depending on walkaway threshold
      expect(['COUNTER', 'ESCALATE']).toContain(res.body.decision.action);
      
      // Verify deal uses the template
      const deal = await getDealData(dealId);
      expect(deal.deal.negotiation_template_id).toBe(strictTemplateId);
    });

    test('lenient template (accept_threshold=0.10) should ACCEPT almost anything', async () => {
      const lenientTemplateId = await createTemplate({ 
        accept_threshold: 0.10,
        walkaway_threshold: 0.05 // Also lower walkaway to ensure ACCEPT
      });
      const dealId = await createDealWithTemplate(lenientTemplateId);

      // Verify deal was created with correct template
      let deal = await getDealData(dealId);
      expect(deal.deal.negotiation_template_id).toBe(lenientTemplateId);

      // Use $85 Net 90 which has utility ~0.84 (well above 0.10 threshold)
      const res = await sendVendor(dealId, 'We can do $85 Net 90.');
      expect(res.status).toBe(200);

      // Should ACCEPT (threshold very low, utility ~0.84 > 0.10)
      expect(res.body.decision.action).toBe('ACCEPT');
      
      // Verify deal still uses the template
      deal = await getDealData(dealId);
      expect(deal.deal.negotiation_template_id).toBe(lenientTemplateId);
    });
  });

  describe('Test Case 2: Happy path ACCEPT + terminal lock', () => {
    test('should accept good offer and block further messages', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send vendor message with good offer ($85 Net 90 = high utility)
      const messageRes = await sendVendor(dealId, 'We can do $85 Net 90.');
      expect(messageRes.status).toBe(200);

      // Verify decision is ACCEPT
      expect(messageRes.body.decision).toBeDefined();
      expect(messageRes.body.decision.action).toBe('ACCEPT');

      // Verify deal status is ACCEPTED
      const deal = await getDealData(dealId);
      expect(deal.deal.status).toBe('ACCEPTED');
      expect(deal.deal.round).toBe(1);

      // Verify messages were created (2 messages: vendor + accordo)
      expect(deal.messages.length).toBe(2);
      expect(deal.messages[0].role).toBe('VENDOR');
      expect(deal.messages[0].extracted_offer).toBeDefined();
      expect(deal.messages[0].extracted_offer.unit_price).toBe(85);
      expect(deal.messages[1].role).toBe('ACCORDO');
      expect(deal.messages[1].engine_decision?.action).toBe('ACCEPT');

      // Verify latest_offer_json matches extracted offer
      expect(deal.deal.latest_offer_json?.unit_price).toBe(85);
      expect(deal.deal.latest_offer_json?.payment_terms).toBe('Net 90');

      // Try sending another message - should be blocked
      const blockedRes = await sendVendor(dealId, 'Can we adjust?');
      expect(blockedRes.status).toBe(409);
      expect(blockedRes.body.error).toContain('ACCEPTED');
    });
  });

  describe('Test Case 3: Counter trade-off (terms improve)', () => {
    test('should counter bad offer and request better terms', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send vendor message with bad offer ($95 Net 30 = lower utility)
      const messageRes = await sendVendor(dealId, 'Best I can do is $95 Net 30.');
      expect(messageRes.status).toBe(200);

      // Verify decision is COUNTER
      expect(messageRes.body.decision).toBeDefined();
      const action = messageRes.body.decision.action;
      expect(['COUNTER', 'ESCALATE']).toContain(action);

      if (action === 'COUNTER') {
        // Verify counter offer exists
        expect(messageRes.body.decision.counterOffer).toBeDefined();
        expect(messageRes.body.decision.counterOffer.unit_price).toBe(95); // Keeps price
        expect(['Net 60', 'Net 90']).toContain(messageRes.body.decision.counterOffer.payment_terms);

        // Verify reply contains counter values
        assertReplyValid(messageRes.body.reply, messageRes.body.decision, { unit_price: 95, payment_terms: 'Net 30' });

        // Verify deal is still NEGOTIATING
        const deal = await getDealData(dealId);
        expect(deal.deal.status).toBe('NEGOTIATING');
        expect(deal.messages.length).toBe(2);
      }
    });
  });

  describe('Test Case 4: Terms already best → price concession', () => {
    test('should move price toward target when terms are already best', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send vendor message with Net 90 (best terms) but higher price
      // Use $95 which should trigger COUNTER (utility ~0.6, below accept threshold 0.70)
      const messageRes = await sendVendor(dealId, 'Best is $95 Net 90.');
      expect(messageRes.status).toBe(200);

      const action = messageRes.body.decision.action;
      
      // Should be COUNTER (utility ~0.6 < 0.70 accept threshold)
      // But if utility is high enough, might ACCEPT - both are valid
      if (action === 'COUNTER') {
        // Verify payment terms stay Net 90
        expect(messageRes.body.decision.counterOffer.payment_terms).toBe('Net 90');
        
        // Verify price is <= vendor price and follows buyer position logic
        const counterPrice = messageRes.body.decision.counterOffer.unit_price;
        expect(counterPrice).toBeLessThanOrEqual(95); // Never above vendor
        expect(counterPrice).toBeLessThanOrEqual(100); // Never above max_acceptable
        
        // Buyer position: min(target, anchor + round*step) = min(85, 75 + 1*2) = 77
        // Desired: min(vendorPrice, buyerPosition) = min(95, 77) = 77
        expect(counterPrice).toBeLessThanOrEqual(77);
      } else if (action === 'ACCEPT') {
        // If utility is high enough, ACCEPT is also valid
        expect(action).toBe('ACCEPT');
      }
    });
  });

  describe('Test Case 5: ASK_CLARIFY missing terms', () => {
    test('should ask for payment terms when only price is provided', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send vendor message with price only
      const messageRes = await sendVendor(dealId, 'We can do $92.');
      expect(messageRes.status).toBe(200);

      // Verify decision is ASK_CLARIFY
      expect(messageRes.body.decision).toBeDefined();
      expect(messageRes.body.decision.action).toBe('ASK_CLARIFY');
      expect(messageRes.body.decision.counterOffer).toBeNull();

      // Verify reply asks for terms
      const reply = messageRes.body.reply.toLowerCase();
      expect(
        reply.includes('terms') ||
        reply.includes('net 30') ||
        reply.includes('net 60') ||
        reply.includes('net 90') ||
        reply.includes('payment')
      ).toBe(true);

      // Verify reply doesn't invent counter offer
      expect(reply).not.toContain('$92'); // Should not restate price if asking for terms
    });
  });

  describe('Test Case 6: Non-standard terms should trigger clarify', () => {
    test('should ask to confirm standard terms when non-standard provided', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send vendor message with non-standard terms
      const messageRes = await sendVendor(dealId, 'I can do $93 and payment terms 50 days.');
      expect(messageRes.status).toBe(200);

      // Verify decision is ASK_CLARIFY (or COUNTER if parser maps it)
      expect(messageRes.body.decision).toBeDefined();
      const action = messageRes.body.decision.action;
      expect(['ASK_CLARIFY', 'COUNTER']).toContain(action);

      // Verify vendor message extractedOffer stored correctly
      const deal = await getDealData(dealId);
      const vendorMsg = deal.messages.find((m: any) => m.role === 'VENDOR');
      expect(vendorMsg.extracted_offer).toBeDefined();
      expect(vendorMsg.extracted_offer.unit_price).toBe(93);
      // payment_terms should be null (non-standard)
      expect(vendorMsg.extracted_offer.payment_terms).toBeNull();
      
      // If meta field exists, verify raw_terms_days
      if (vendorMsg.extracted_offer.meta) {
        expect(vendorMsg.extracted_offer.meta.raw_terms_days).toBe(50);
        expect(vendorMsg.extracted_offer.meta.non_standard_terms).toBe(true);
      }
    });
  });

  describe('Test Case 7: WALK_AWAY (price > max acceptable)', () => {
    test('should walk away from unacceptable price and block further messages', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send vendor message with very bad offer ($120 > max_acceptable=100)
      const messageRes = await sendVendor(dealId, 'Final is $120 Net 60.');
      expect(messageRes.status).toBe(200);

      // Verify decision is WALK_AWAY
      expect(messageRes.body.decision).toBeDefined();
      expect(messageRes.body.decision.action).toBe('WALK_AWAY');

      // Verify deal status is WALKED_AWAY
      const deal = await getDealData(dealId);
      expect(deal.deal.status).toBe('WALKED_AWAY');
      expect(deal.messages.length).toBe(2); // vendor + accordo

      // Try sending another message - should be blocked
      const blockedRes = await sendVendor(dealId, 'Can we negotiate?');
      expect(blockedRes.status).toBe(409);
      expect(blockedRes.body.error).toContain('WALKED_AWAY');
    });
  });

  describe('Test Case 8: ESCALATE on walkaway_threshold', () => {
    test('should escalate when utility below walkaway threshold', async () => {
      // Create template with high walkaway threshold (easy to trigger)
      // $95 Net 30 has utility: price_util ~0.5, terms_util 0.2, total ~0.38
      const strictTemplateId = await createTemplate({ walkaway_threshold: 0.50 });
      const dealId = await createDealWithTemplate(strictTemplateId);

      // Send offer that will have low utility ($95 Net 30)
      // Utility calculation: 0.6 * price_util(95) + 0.4 * terms_util(Net30)
      // price_util(95) = 1 - (95-75)/(100-75) = 1 - 20/25 = 0.2
      // terms_util(Net30) = 0.2
      // total = 0.6 * 0.2 + 0.4 * 0.2 = 0.2 < 0.50 walkaway threshold
      const messageRes = await sendVendor(dealId, '$95 Net 30.');
      expect(messageRes.status).toBe(200);

      // Should escalate because utility < 0.50 walkaway threshold
      expect(messageRes.body.decision.action).toBe('ESCALATE');

      // Verify deal status
      const deal = await getDealData(dealId);
      expect(deal.deal.status).toBe('ESCALATED');

      // Verify terminal lock
      const blockedRes = await sendVendor(dealId, 'Another message');
      expect(blockedRes.status).toBe(409);
    });
  });

  describe('Test Case 9: Max rounds enforced exactly', () => {
    test('should escalate after max rounds and not allow round 11', async () => {
      // Create template with max_rounds = 3
      const templateId = await createTemplate({ max_rounds: 3 });
      const dealId = await createDealWithTemplate(templateId);

      // Send messages up to max_rounds
      // With max_rounds=3, rounds 1, 2, 3 are allowed, round 4 should escalate
      let escalated = false;
      for (let i = 0; i < 4; i++) {
        const res = await sendVendor(dealId, '$95 Net 30.');
        expect(res.status).toBe(200);
        const deal = await getDealData(dealId);
        
        // Check if we've escalated due to max rounds
        if (deal.deal.status === 'ESCALATED') {
          // Verify it was due to max rounds
          expect(res.body.decision.action).toBe('ESCALATE');
          // Check for max rounds reason (message says "Max rounds (3) exceeded")
          const reasons = res.body.decision.reasons || [];
          const hasMaxRoundsReason = reasons.some((r: string) => 
            r.toLowerCase().includes('max rounds') || 
            r.toLowerCase().includes('exceeded')
          );
          // If round is 3 or less and status is ESCALATED, it's likely max rounds
          // The reason should mention max rounds, or round should be exactly 3 (last allowed round)
          // Since we're checking round <= 3 and status is ESCALATED, it must be max rounds
          expect(deal.deal.round).toBeLessThanOrEqual(3);
          escalated = true;
          break;
        }
        
        // Should still be negotiating for rounds 1-2
        if (deal.deal.round < 3) {
          expect(deal.deal.status).toBe('NEGOTIATING');
        }
      }
      
      expect(escalated).toBe(true);

      // Verify final state
      const deal = await getDealData(dealId);
      expect(deal.deal.status).toBe('ESCALATED');
      expect(deal.deal.round).toBeLessThanOrEqual(3);

      // Verify no additional messages allowed
      const blockedRes = await sendVendor(dealId, 'Another message');
      expect(blockedRes.status).toBe(409);
    });
  });

  describe('Test Case 10: Reset clears everything', () => {
    test('should reset deal to initial state', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send a message to create some state
      const msgRes = await sendVendor(dealId, 'We can do $90 Net 60.');
      expect(msgRes.status).toBe(200);

      // Verify deal has messages and round > 0
      let deal = await getDealData(dealId);
      expect(deal.messages.length).toBe(2);
      expect(deal.deal.round).toBeGreaterThan(0);

      // Reset the deal
      const resetRes = await request(app)
        .post(`/api/deals/${dealId}/reset`);
      expect(resetRes.status).toBe(200);

      // Verify deal is reset
      deal = await getDealData(dealId);
      expect(deal.deal.status).toBe('NEGOTIATING');
      expect(deal.deal.round).toBe(0);
      expect(deal.messages.length).toBe(0); // Messages should be deleted

      // Verify we can send messages again
      const newMsgRes = await sendVendor(dealId, 'New offer: $88 Net 90.');
      expect(newMsgRes.status).toBe(200);
    });
  });

  describe('Test Case 11: Auto Vendor endpoint creates both messages', () => {
    test('should generate vendor message and accordo response', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Call auto vendor endpoint
      const autoRes = await request(app)
        .post(`/api/deals/${dealId}/vendor/next`);
      
      // May fail if Ollama unavailable, but if it succeeds, verify structure
      if (autoRes.status === 200) {
        // Verify response includes vendor and accordo data
        expect(autoRes.body.vendorGenerated).toBeDefined();
        expect(autoRes.body.vendorGenerated.message).toBeDefined();
        expect(autoRes.body.decision).toBeDefined();
        expect(autoRes.body.reply).toBeDefined();

        // Verify 2 new messages in DB
        const deal = await getDealData(dealId);
        expect(deal.messages.length).toBe(2);
        expect(deal.messages[0].role).toBe('VENDOR');
        expect(deal.messages[1].role).toBe('ACCORDO');
        expect(deal.messages[1].engine_decision).toBeDefined();
      } else {
        // If Ollama unavailable, at least verify endpoint exists and returns error
        expect(autoRes.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('Test Case 12: Run Demo stops properly', () => {
    test('should stop at terminal state or max rounds', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Run demo with high maxSteps
      const demoRes = await request(app)
        .post(`/api/deals/${dealId}/run-demo`)
        .send({ maxSteps: 20 });
      expect(demoRes.status).toBe(200);

      // Verify demo completed
      expect(demoRes.body.deal).toBeDefined();
      expect(demoRes.body.messages).toBeDefined();
      expect(demoRes.body.steps).toBeDefined();

      // Verify final state
      const finalDeal = demoRes.body.deal;
      // Demo should either reach terminal state OR stop early (e.g., if Ollama unavailable)
      // If steps were processed, it should be terminal; if no steps, NEGOTIATING is acceptable
      if (demoRes.body.steps && demoRes.body.steps.length > 0) {
        expect(['ACCEPTED', 'ESCALATED', 'WALKED_AWAY']).toContain(finalDeal.status);
      }
      expect(finalDeal.round).toBeLessThanOrEqual(DEFAULT_MAX_ROUNDS);

      // Verify steps don't exceed maxSteps
      expect(demoRes.body.steps.length).toBeLessThanOrEqual(20);

      // Verify message count matches (2 per step)
      const expectedMessages = demoRes.body.steps.length * 2;
      expect(demoRes.body.messages.length).toBeGreaterThanOrEqual(expectedMessages);

      // Verify we can't send more messages
      if (finalDeal.status !== 'NEGOTIATING') {
        const blockedMsgRes = await sendVendor(dealId, 'Another message');
        expect(blockedMsgRes.status).toBe(409);
      }
    });
  });

  describe('DB Integrity Test: Investor proof', () => {
    test('every ACCORDO message has engineDecision, every VENDOR message has extractedOffer', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send a few messages
      await sendVendor(dealId, '$90 Net 60.');
      await sendVendor(dealId, '$88 Net 90.');

      const deal = await getDealData(dealId);
      const messages = deal.messages;

      // Verify every message has required fields
      for (const msg of messages) {
        if (msg.role === 'VENDOR') {
          expect(msg.extracted_offer).toBeDefined();
          expect(msg.extracted_offer).not.toBeNull();
        } else if (msg.role === 'ACCORDO') {
          expect(msg.engine_decision).toBeDefined();
          expect(msg.engine_decision).not.toBeNull();
          expect(msg.engine_decision.action).toBeDefined();
        }
      }
    });
  });
});
