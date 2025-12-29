import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExplainabilityPanel from '../ExplainabilityPanel';
import type { Message, Explainability } from '../../../api/client';

describe('ExplainabilityPanel - "Why we did this" Section', () => {
  const createMockExplainability = (overrides?: Partial<Explainability>): Explainability => ({
    vendorOffer: {
      unit_price: 85,
      payment_terms: 'Net 90',
    },
    utilities: {
      priceUtility: 0.6,
      termsUtility: 1.0,
      weightedPrice: 0.36,
      weightedTerms: 0.4,
      total: 0.76,
    },
    decision: {
      action: 'ACCEPT',
      reasons: ['Offer meets acceptance threshold', 'Good price and terms'],
      counterOffer: null,
    },
    configSnapshot: {
      weights: { price: 0.6, terms: 0.4 },
      thresholds: { accept: 0.70, walkaway: 0.45 },
      unitPrice: {
        anchor: 75,
        target: 85,
        max: 100,
        step: 2,
      },
      termOptions: ['Net 30', 'Net 60', 'Net 90'],
    },
    ...overrides,
  });

  const createMockMessage = (role: 'VENDOR' | 'ACCORDO', explainability?: Explainability | null): Message => ({
    id: `msg-${Date.now()}-${Math.random()}`,
    deal_id: 'deal-1',
    role,
    content: role === 'VENDOR' ? 'We can do $85 Net 90.' : 'Confirmed — we can proceed.',
    created_at: new Date().toISOString(),
    explainability_json: explainability ?? undefined,
  });

  describe('Empty state', () => {
    it('should show empty message when no explainability data available', () => {
      const messages: Message[] = [];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Why We Did This')).toBeInTheDocument();
      expect(screen.getByText('Send a vendor message to see reasoning.')).toBeInTheDocument();
    });

    it('should show empty message when messages exist but no ACCORDO message has explainability', () => {
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', null),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Why We Did This')).toBeInTheDocument();
      expect(screen.getByText('Send a vendor message to see reasoning.')).toBeInTheDocument();
    });
  });

  describe('Latest Offer Card', () => {
    it('should display vendor offer with price and terms', () => {
      const explain = createMockExplainability();
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Latest Offer')).toBeInTheDocument();
      expect(screen.getByText('Unit Price:')).toBeInTheDocument();
      expect(screen.getByText('$85')).toBeInTheDocument();
      expect(screen.getByText('Payment Terms:')).toBeInTheDocument();
      expect(screen.getByText('Net 90')).toBeInTheDocument();
    });

    it('should display "—" when price is null', () => {
      const explain = createMockExplainability({
        vendorOffer: {
          unit_price: null,
          payment_terms: 'Net 90',
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Unit Price:')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.getByText('Net 90')).toBeInTheDocument();
    });

    it('should display "—" when payment terms are null', () => {
      const explain = createMockExplainability({
        vendorOffer: {
          unit_price: 85,
          payment_terms: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('$85')).toBeInTheDocument();
      expect(screen.getByText('Payment Terms:')).toBeInTheDocument();
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Deal Score Breakdown', () => {
    it('should display Deal Score Breakdown with all utilities', () => {
      const explain = createMockExplainability();
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Deal Score Breakdown')).toBeInTheDocument();
      expect(screen.getByText(/Higher is better for us \(0–1\)/)).toBeInTheDocument();

      // Price section
      expect(screen.getByText('Price:')).toBeInTheDocument();
      expect(screen.getByText(/0\.60 × 0\.60 = 0\.36/)).toBeInTheDocument();

      // Terms section
      expect(screen.getByText('Terms:')).toBeInTheDocument();
      expect(screen.getByText(/1\.00 × 0\.40 = 0\.40/)).toBeInTheDocument();

      // Total
      expect(screen.getByText('Total Deal Score:')).toBeInTheDocument();
      expect(screen.getByText('0.76')).toBeInTheDocument();
    });

    it('should display "—" for Price when priceUtility is null', () => {
      const explain = createMockExplainability({
        vendorOffer: {
          unit_price: null,
          payment_terms: 'Net 90',
        },
        utilities: {
          priceUtility: null,
          termsUtility: 1.0,
          weightedPrice: null,
          weightedTerms: 0.4,
          total: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Price:')).toBeInTheDocument();
      const priceRow = screen.getByText('Price:').closest('.utility-breakdown-row');
      expect(priceRow).toBeInTheDocument();
      expect(priceRow).toHaveTextContent('—');
    });

    it('should display "—" for Terms when termsUtility is null', () => {
      const explain = createMockExplainability({
        vendorOffer: {
          unit_price: 85,
          payment_terms: null,
        },
        utilities: {
          priceUtility: 0.6,
          termsUtility: null,
          weightedPrice: 0.36,
          weightedTerms: null,
          total: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Terms:')).toBeInTheDocument();
      const termsRow = screen.getByText('Terms:').closest('.utility-breakdown-row');
      expect(termsRow).toBeInTheDocument();
      expect(termsRow).toHaveTextContent('—');
    });

    it('should display "—" for Total when total is null', () => {
      const explain = createMockExplainability({
        utilities: {
          priceUtility: 0.6,
          termsUtility: 1.0,
          weightedPrice: 0.36,
          weightedTerms: 0.4,
          total: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Total Deal Score:')).toBeInTheDocument();
      const totalRow = screen.getByText('Total Deal Score:').closest('.utility-breakdown-row');
      expect(totalRow).toBeInTheDocument();
      expect(totalRow).toHaveTextContent('—');
    });

    it('should display progress bar with correct width', () => {
      const explain = createMockExplainability({
        utilities: {
          priceUtility: 0.6,
          termsUtility: 1.0,
          weightedPrice: 0.36,
          weightedTerms: 0.4,
          total: 0.76,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      const progressFill = document.querySelector('.utility-progress-fill');
      expect(progressFill).toBeInTheDocument();
      expect(progressFill).toHaveStyle({ width: '76%' });
    });

    it('should display threshold marker when accept threshold > 0', () => {
      const explain = createMockExplainability({
        configSnapshot: {
          weights: { price: 0.6, terms: 0.4 },
          thresholds: { accept: 0.70, walkaway: 0.45 },
          unitPrice: {
            anchor: 75,
            target: 85,
            max: 100,
            step: 2,
          },
          termOptions: ['Net 30', 'Net 60', 'Net 90'],
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      const thresholdMarker = document.querySelector('.utility-progress-marker');
      expect(thresholdMarker).toBeInTheDocument();
      expect(thresholdMarker).toHaveStyle({ left: '70%' });
    });
  });

  describe('Decision Card', () => {
    it('should display decision action badge', () => {
      const explain = createMockExplainability({
        decision: {
          action: 'ACCEPT',
          reasons: ['Offer meets acceptance threshold'],
          counterOffer: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Decision & Reasoning')).toBeInTheDocument();
      expect(screen.getByText('ACCEPT')).toBeInTheDocument();
    });

    it('should display decision reasons', () => {
      const explain = createMockExplainability({
        decision: {
          action: 'COUNTER',
          reasons: [
            'Price is above target',
            'Requesting better payment terms',
            'Offer utility below acceptance threshold',
          ],
          counterOffer: {
            unit_price: 88,
            payment_terms: 'Net 90',
          },
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Price is above target')).toBeInTheDocument();
      expect(screen.getByText('Requesting better payment terms')).toBeInTheDocument();
      expect(screen.getByText('Offer utility below acceptance threshold')).toBeInTheDocument();
    });

    it('should display counter offer when present', () => {
      const explain = createMockExplainability({
        decision: {
          action: 'COUNTER',
          reasons: ['Requesting better terms'],
          counterOffer: {
            unit_price: 88,
            payment_terms: 'Net 90',
          },
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Counter Offer:')).toBeInTheDocument();
      expect(screen.getByText('Unit Price:')).toBeInTheDocument();
      expect(screen.getByText('$88')).toBeInTheDocument();
      expect(screen.getByText('Payment Terms:')).toBeInTheDocument();
      expect(screen.getByText('Net 90')).toBeInTheDocument();
    });

    it('should not display counter offer section when counterOffer is null', () => {
      const explain = createMockExplainability({
        decision: {
          action: 'ACCEPT',
          reasons: ['Offer accepted'],
          counterOffer: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.queryByText('Counter Offer:')).not.toBeInTheDocument();
    });

    it('should display "—" for counter offer price when null', () => {
      const explain = createMockExplainability({
        decision: {
          action: 'COUNTER',
          reasons: ['Requesting terms'],
          counterOffer: {
            unit_price: null,
            payment_terms: 'Net 90',
          },
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Counter Offer:')).toBeInTheDocument();
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Latest ACCORDO message selection', () => {
    it('should use explainability from the latest ACCORDO message', () => {
      const explain1 = createMockExplainability({
        vendorOffer: { unit_price: 90, payment_terms: 'Net 60' },
      });
      const explain2 = createMockExplainability({
        vendorOffer: { unit_price: 85, payment_terms: 'Net 90' },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain1),
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain2),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      // Should show the latest offer (85, Net 90), not the first one (90, Net 60)
      expect(screen.getByText('$85')).toBeInTheDocument();
      expect(screen.getByText('Net 90')).toBeInTheDocument();
      expect(screen.queryByText('$90')).not.toBeInTheDocument();
      expect(screen.queryByText('Net 60')).not.toBeInTheDocument();
    });

    it('should ignore VENDOR messages when finding explainability', () => {
      const explain = createMockExplainability();
      const messages: Message[] = [
        createMockMessage('VENDOR', explain), // VENDOR message with explainability (should be ignored)
        createMockMessage('ACCORDO', null), // ACCORDO without explainability
        createMockMessage('ACCORDO', explain), // Latest ACCORDO with explainability
      ];
      render(<ExplainabilityPanel messages={messages} />);

      // Should show explainability from ACCORDO message, not VENDOR
      expect(screen.getByText('Latest Offer')).toBeInTheDocument();
      expect(screen.getByText('$85')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero utility values correctly', () => {
      const explain = createMockExplainability({
        utilities: {
          priceUtility: 0,
          termsUtility: 0,
          weightedPrice: 0,
          weightedTerms: 0,
          total: 0,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText(/0\.00 × 0\.60 = 0\.00/)).toBeInTheDocument();
      expect(screen.getByText(/0\.00 × 0\.40 = 0\.00/)).toBeInTheDocument();
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('should handle maximum utility values correctly', () => {
      const explain = createMockExplainability({
        utilities: {
          priceUtility: 1.0,
          termsUtility: 1.0,
          weightedPrice: 0.6,
          weightedTerms: 0.4,
          total: 1.0,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText(/1\.00 × 0\.60 = 0\.60/)).toBeInTheDocument();
      expect(screen.getByText(/1\.00 × 0\.40 = 0\.40/)).toBeInTheDocument();
      expect(screen.getByText('1.00')).toBeInTheDocument();
    });

    it('should handle empty reasons array', () => {
      const explain = createMockExplainability({
        decision: {
          action: 'ACCEPT',
          reasons: [],
          counterOffer: null,
        },
      });
      const messages: Message[] = [
        createMockMessage('VENDOR'),
        createMockMessage('ACCORDO', explain),
      ];
      render(<ExplainabilityPanel messages={messages} />);

      expect(screen.getByText('Decision & Reasoning')).toBeInTheDocument();
      expect(screen.getByText('ACCEPT')).toBeInTheDocument();
      // Should not crash with empty reasons
      const reasonsList = document.querySelector('.decision-reasons-list');
      expect(reasonsList).not.toBeInTheDocument();
    });
  });
});


