# Negotiation Templates System

The negotiation configuration has been moved from hardcoded constants to Postgres, making the system more flexible and "real product" ready.

## Architecture

### Database Schema

**negotiation_templates**
- Stores reusable negotiation "playbooks"
- Fields: `id`, `name`, `accept_threshold`, `walkaway_threshold`, `max_rounds`

**negotiation_parameters**
- One row per parameter per template
- Fields: `template_id`, `key` ('unit_price' | 'payment_terms'), `weight`, `direction`, `config` (JSONB)

**deals**
- Added `negotiation_template_id` column to reference templates
- Falls back to default config if no template assigned

### How It Works

1. **Deal Creation**: Deals can optionally specify a `negotiation_template_id`
2. **Decision Time**: When processing a vendor turn, the system:
   - Loads the template for the deal (or uses default)
   - Builds normalized config object
   - Passes config to engine functions
3. **Engine Functions**: All engine functions now accept `config` as parameter instead of importing hardcoded config

## Migration Steps

1. **Run schema migration**:
   ```bash
   yarn migrate:templates
   ```

2. **Seed default template**:
   ```bash
   yarn seed:template
   ```

3. **Existing deals**: Will automatically use default config (backward compatible)

## API Changes

### Engine Functions (Updated Signatures)

- `decideNextMove(config, vendorOffer, round)` - now accepts config
- `totalUtility(config, offer)` - now accepts config
- `priceUtility(config, price)` - now accepts config
- `termsUtility(config, terms)` - now accepts config
- `nextBetterTerms(config, terms)` - now accepts config (DB-driven, no hardcoding)

### Repository Functions

- `getTemplateForDeal(dealId)` - loads and builds config from DB
- `createNegotiationTemplate(input)` - creates new template

## Benefits

✅ **Multiple Templates**: Create "Aggressive", "Cashflow-first", "Fast-close" templates  
✅ **Per-Deal Policies**: Each deal can use different negotiation strategy  
✅ **Auditability**: Show investors "this is policy-driven, not random AI"  
✅ **Future UI**: "Template Editor" becomes natural next milestone  
✅ **Backward Compatible**: Existing deals work with default template

## Example: Creating a New Template

```typescript
import { createNegotiationTemplate } from "./repo/templatesRepo";

const template = await createNegotiationTemplate({
  name: "Aggressive Buy-side",
  accept_threshold: 0.80,  // Higher threshold = more selective
  walkaway_threshold: 0.50,
  max_rounds: 4,           // Faster escalation
  parameters: {
    unit_price: {
      weight: 0.7,          // Price more important
      direction: "lower_better",
      anchor: 70,           // Start lower
      target: 80,
      max_acceptable: 95,
      concession_step: 1,   // Smaller steps
    },
    payment_terms: {
      weight: 0.3,
      options: ["Net 30", "Net 60", "Net 90"],
      utility: { "Net 30": 0.1, "Net 60": 0.5, "Net 90": 1.0 },
    },
  },
});
```

## Default Template

The default template matches the original hardcoded config:
- Accept threshold: 0.70
- Walkaway threshold: 0.45
- Max rounds: 6
- Unit price: weight 0.6, anchor 75, target 85, max 100
- Payment terms: weight 0.4, Net 90 preferred

## Future Enhancements

- Template editor UI
- Template versioning
- A/B testing different templates
- Per-counterparty templates
- Template analytics dashboard

