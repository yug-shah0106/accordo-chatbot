import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dealsRouter } from '../routes/deals';
import { convoRouter } from '../convo/convoRouter';
import { pool } from '../db/db';
import { createNegotiationTemplate, getTemplateForDeal } from '../repo/templatesRepo';
import { createDeal, getDeal, listMessages } from '../repo/dealsRepo';

// Load environment variables
dotenv.config();

// Create test app (same structure as index.ts)
const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api', dealsRouter);
app.use('/api/convo', convoRouter);

// Test configuration
const DEFAULT_ACCEPT_THRESHOLD = 0.70;
const DEFAULT_WALKAWAY_THRESHOLD = 0.45;
const DEFAULT_MAX_ROUNDS = 6;

describe('Explainability API Tests - "Why we did this" Section', () => {
  let defaultTemplateId: string;
  const testDealIds: string[] = [];
  const testTemplateIds: string[] = [];

  beforeAll(async () => {
    // Ensure database is ready
    await pool.query('SELECT 1');

    // Create default template for tests
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

  // Helper: Send vendor message via conversation API
  async function sendVendorMessage(dealId: string, text: string) {
    return request(app)
      .post(`/api/convo/deals/${dealId}/messages`)
      .send({ text });
  }

  describe('GET /api/convo/deals/:dealId/last-explain', () => {
    test('should return explainability data when available', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send a vendor message to trigger explainability computation
      const messageRes = await sendVendorMessage(dealId, 'We can do $85 Net 90.');
      expect(messageRes.status).toBe(200);

      // Get explainability
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(200);
      expect(explainRes.body).toHaveProperty('explainability');
      
      const explain = explainRes.body.explainability;
      
      // Verify structure
      expect(explain).toHaveProperty('vendorOffer');
      expect(explain).toHaveProperty('utilities');
      expect(explain).toHaveProperty('decision');
      expect(explain).toHaveProperty('configSnapshot');

      // Verify vendorOffer structure
      expect(explain.vendorOffer).toHaveProperty('unit_price');
      expect(explain.vendorOffer).toHaveProperty('payment_terms');
      expect(explain.vendorOffer.unit_price).toBe(85);
      expect(explain.vendorOffer.payment_terms).toBe('Net 90');

      // Verify utilities structure
      expect(explain.utilities).toHaveProperty('priceUtility');
      expect(explain.utilities).toHaveProperty('termsUtility');
      expect(explain.utilities).toHaveProperty('weightedPrice');
      expect(explain.utilities).toHaveProperty('weightedTerms');
      expect(explain.utilities).toHaveProperty('total');

      // Verify utilities are numbers (not null for complete offer)
      expect(typeof explain.utilities.priceUtility).toBe('number');
      expect(typeof explain.utilities.termsUtility).toBe('number');
      expect(typeof explain.utilities.weightedPrice).toBe('number');
      expect(typeof explain.utilities.weightedTerms).toBe('number');
      expect(typeof explain.utilities.total).toBe('number');

      // Verify utilities are in valid range [0, 1]
      expect(explain.utilities.priceUtility).toBeGreaterThanOrEqual(0);
      expect(explain.utilities.priceUtility).toBeLessThanOrEqual(1);
      expect(explain.utilities.termsUtility).toBeGreaterThanOrEqual(0);
      expect(explain.utilities.termsUtility).toBeLessThanOrEqual(1);
      expect(explain.utilities.total).toBeGreaterThanOrEqual(0);
      expect(explain.utilities.total).toBeLessThanOrEqual(1);

      // Verify decision structure
      expect(explain.decision).toHaveProperty('action');
      expect(explain.decision).toHaveProperty('reasons');
      expect(Array.isArray(explain.decision.reasons)).toBe(true);

      // Verify configSnapshot structure
      expect(explain.configSnapshot).toHaveProperty('weights');
      expect(explain.configSnapshot).toHaveProperty('thresholds');
      expect(explain.configSnapshot).toHaveProperty('unitPrice');
      expect(explain.configSnapshot).toHaveProperty('termOptions');

      // Verify weights
      expect(explain.configSnapshot.weights).toHaveProperty('price');
      expect(explain.configSnapshot.weights).toHaveProperty('terms');
      expect(explain.configSnapshot.weights.price).toBe(0.6);
      expect(explain.configSnapshot.weights.terms).toBe(0.4);

      // Verify thresholds
      expect(explain.configSnapshot.thresholds).toHaveProperty('accept');
      expect(explain.configSnapshot.thresholds).toHaveProperty('walkaway');
      expect(explain.configSnapshot.thresholds.accept).toBe(DEFAULT_ACCEPT_THRESHOLD);
      expect(explain.configSnapshot.thresholds.walkaway).toBe(DEFAULT_WALKAWAY_THRESHOLD);
    });

    test('should return 404 when no explainability data available', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Try to get explainability without sending any messages
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(404);
      expect(explainRes.body).toHaveProperty('error');
      expect(explainRes.body.error).toContain('No explainability data available');
    });

    test('should return 404 for non-existent deal', async () => {
      const fakeDealId = '00000000-0000-0000-0000-000000000000';
      
      const explainRes = await request(app)
        .get(`/api/convo/deals/${fakeDealId}/last-explain`);
      
      expect(explainRes.status).toBe(404);
    });

    test('should handle explainability with null price utility correctly', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send message with only payment terms (no price)
      const messageRes = await sendVendorMessage(dealId, 'We can do Net 90.');
      expect(messageRes.status).toBe(200);

      // Get explainability
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(200);
      const explain = explainRes.body.explainability;

      // Price utility should be null when price is missing
      expect(explain.vendorOffer.unit_price).toBeNull();
      expect(explain.utilities.priceUtility).toBeNull();
      expect(explain.utilities.weightedPrice).toBeNull();

      // Terms utility should be present
      expect(explain.vendorOffer.payment_terms).toBe('Net 90');
      expect(explain.utilities.termsUtility).not.toBeNull();
      expect(explain.utilities.weightedTerms).not.toBeNull();

      // Total should be null when one component is null
      expect(explain.utilities.total).toBeNull();
    });

    test('should handle explainability with null terms utility correctly', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send message with only price (no terms)
      const messageRes = await sendVendorMessage(dealId, 'We can do $85.');
      expect(messageRes.status).toBe(200);

      // Get explainability
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(200);
      const explain = explainRes.body.explainability;

      // Terms utility should be null when terms are missing
      expect(explain.vendorOffer.payment_terms).toBeNull();
      expect(explain.utilities.termsUtility).toBeNull();
      expect(explain.utilities.weightedTerms).toBeNull();

      // Price utility should be present
      expect(explain.vendorOffer.unit_price).toBe(85);
      expect(explain.utilities.priceUtility).not.toBeNull();
      expect(explain.utilities.weightedPrice).not.toBeNull();

      // Total should be null when one component is null
      expect(explain.utilities.total).toBeNull();
    });

    test('should return explainability for latest ACCORDO message only', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send first message
      await sendVendorMessage(dealId, 'We can do $90 Net 60.');
      
      // Get first explainability
      const firstExplainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      expect(firstExplainRes.status).toBe(200);
      const firstExplain = firstExplainRes.body.explainability;
      expect(firstExplain.vendorOffer.unit_price).toBe(90);

      // Send second message
      await sendVendorMessage(dealId, 'We can do $85 Net 90.');
      
      // Get latest explainability (should be for second message)
      const secondExplainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      expect(secondExplainRes.status).toBe(200);
      const secondExplain = secondExplainRes.body.explainability;
      expect(secondExplain.vendorOffer.unit_price).toBe(85);
      expect(secondExplain.vendorOffer.payment_terms).toBe('Net 90');
    });

    test('should include counterOffer in decision when action is COUNTER', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Send message that triggers COUNTER action
      const messageRes = await sendVendorMessage(dealId, 'We can do $95 Net 30.');
      expect(messageRes.status).toBe(200);

      // Get explainability
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(200);
      const explain = explainRes.body.explainability;

      // If action is COUNTER, counterOffer should be present
      if (explain.decision.action === 'COUNTER') {
        expect(explain.decision.counterOffer).not.toBeNull();
        expect(explain.decision.counterOffer).toHaveProperty('unit_price');
        expect(explain.decision.counterOffer).toHaveProperty('payment_terms');
      }
    });

    test('should calculate utilities correctly for different offers', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      // Test case 1: Best offer ($75 Net 90) - should have high utility
      await sendVendorMessage(dealId, 'We can do $75 Net 90.');
      let explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      expect(explainRes.status).toBe(200);
      let explain = explainRes.body.explainability;
      
      // Price at anchor (75) should give utility = 1
      expect(explain.utilities.priceUtility).toBe(1);
      // Net 90 should give utility = 1.0
      expect(explain.utilities.termsUtility).toBe(1.0);
      // Total should be weighted sum: 0.6 * 1 + 0.4 * 1 = 1.0
      expect(explain.utilities.total).toBeCloseTo(1.0, 2);

      // Reset deal for next test
      await request(app).post(`/api/deals/${dealId}/reset`);

      // Test case 2: Worst acceptable offer ($100 Net 30) - should have low utility
      await sendVendorMessage(dealId, 'We can do $100 Net 30.');
      explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      expect(explainRes.status).toBe(200);
      explain = explainRes.body.explainability;
      
      // Price at max (100) should give utility = 0
      expect(explain.utilities.priceUtility).toBe(0);
      // Net 30 should give utility = 0.2
      expect(explain.utilities.termsUtility).toBe(0.2);
      // Total should be weighted sum: 0.6 * 0 + 0.4 * 0.2 = 0.08
      expect(explain.utilities.total).toBeCloseTo(0.08, 2);
    });

    test('should include reasons in decision', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      await sendVendorMessage(dealId, 'We can do $85 Net 90.');
      
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(200);
      const explain = explainRes.body.explainability;

      // Decision should have reasons array
      expect(Array.isArray(explain.decision.reasons)).toBe(true);
      expect(explain.decision.reasons.length).toBeGreaterThan(0);
      
      // Each reason should be a string
      explain.decision.reasons.forEach((reason: any) => {
        expect(typeof reason).toBe('string');
        expect(reason.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Explainability data integrity', () => {
    test('should ensure explainability is stored in ACCORDO messages', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      await sendVendorMessage(dealId, 'We can do $85 Net 90.');
      
      // Get messages directly from DB
      const messages = await listMessages(dealId);
      const accordoMessages = messages.filter(m => m.role === 'ACCORDO');
      
      expect(accordoMessages.length).toBeGreaterThan(0);
      
      // Latest ACCORDO message should have explainability_json
      const latestAccordo = accordoMessages[accordoMessages.length - 1];
      expect(latestAccordo.explainability_json).toBeDefined();
      expect(latestAccordo.explainability_json).not.toBeNull();
      
      // Verify structure matches what API returns
      const explain = latestAccordo.explainability_json;
      expect(explain).toHaveProperty('vendorOffer');
      expect(explain).toHaveProperty('utilities');
      expect(explain).toHaveProperty('decision');
      expect(explain).toHaveProperty('configSnapshot');
    });

    test('should ensure explainability matches decision and offer', async () => {
      const dealId = await createDealWithTemplate(defaultTemplateId);

      await sendVendorMessage(dealId, 'We can do $88 Net 60.');
      
      const explainRes = await request(app)
        .get(`/api/convo/deals/${dealId}/last-explain`);
      
      expect(explainRes.status).toBe(200);
      const explain = explainRes.body.explainability;

      // Get messages to verify consistency
      const messages = await listMessages(dealId);
      const latestAccordo = [...messages].reverse().find(m => m.role === 'ACCORDO');
      
      if (latestAccordo && latestAccordo.engine_decision) {
        // Decision action should match
        expect(explain.decision.action).toBe(latestAccordo.engine_decision.action);
        
        // Counter offer should match if present
        if (latestAccordo.engine_decision.counterOffer) {
          expect(explain.decision.counterOffer).toEqual(latestAccordo.engine_decision.counterOffer);
        }
      }

      // Vendor offer in explainability should match extracted offer
      const vendorMessage = messages.find(m => m.role === 'VENDOR');
      if (vendorMessage && vendorMessage.extracted_offer) {
        expect(explain.vendorOffer.unit_price).toBe(vendorMessage.extracted_offer.unit_price);
        expect(explain.vendorOffer.payment_terms).toBe(vendorMessage.extracted_offer.payment_terms);
      }
    });
  });
});


