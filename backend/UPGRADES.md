# MVP Code Upgrades - Investor-Ready Improvements

This document summarizes the 5 code upgrades implemented to make the MVP more investor-ready and prevent demo surprises.

## 1. ✅ Enforce State Machine in One Place

**Problem**: Negotiation pipeline logic was duplicated across multiple routes, leading to inconsistent behavior.

**Solution**: 
- Created shared `processVendorTurn()` function in `src/engine/processVendorTurn.ts`
- This is now the **SINGLE SOURCE OF TRUTH** for negotiation logic
- Used by:
  - `POST /api/deals/:dealId/messages`
  - `POST /api/deals/:dealId/vendor/next`
  - `POST /api/deals/:dealId/run-demo`

**Key Features**:
- Hard-blocks if `deal.status !== "NEGOTIATING"` (returns 409 Conflict)
- Enforces max rounds BEFORE processing
- Returns `{deal, messages}` for UI consistency

**Outcome**: No more "Escalated but still negotiating" bugs.

---

## 2. ✅ Return {deal, messages} from Action Endpoints

**Problem**: UI had to refetch after actions, causing race conditions and inconsistent state.

**Solution**: All action endpoints now return `{deal, messages}`:
- `POST /api/deals/:dealId/messages` → `{deal, messages, decision, reply}`
- `POST /api/deals/:dealId/vendor/next` → `{deal, messages, decision, reply, vendorGenerated}`
- `POST /api/deals/:dealId/run-demo` → `{deal, messages, steps}`
- `POST /api/deals/:dealId/reset` → `{deal, messages}`
- `POST /api/deals/:dealId/resume` → `{deal, messages}` (new)

**Outcome**: UI always consistent (status, round, transcript, utility) without refetch race conditions.

---

## 3. ✅ Add "Scenario" Support End-to-End

**Problem**: Demo scenarios (Hard/Soft/WalkAway) were UI-only, not affecting vendor behavior.

**Solution**:
- Added `scenario` parameter to `vendorRespond()` function
- Scenarios: `"HARD" | "SOFT" | "WALK_AWAY"`
- Passed through from:
  - `POST /api/deals/:dealId/run-demo` (body: `{scenario: "HARD"}`)
  - `POST /api/deals/:dealId/vendor/next` (body: `{scenario: "HARD"}`)
- Scenario-specific instructions in vendor prompt:
  - **HARD**: "Be firm and resist concessions. Start high and concede very slowly."
  - **SOFT**: "Be more flexible. Willing to negotiate and find middle ground."
  - **WALK_AWAY**: "Be very inflexible. If pressured too much, indicate you may need to walk away."

**Outcome**: Deterministic demos. You can say "Let me run a hard vendor scenario."

---

## 4. ✅ Store Derived Fields Explicitly

**Problem**: Decision metadata was only in JSONB, making analytics and "why it accepted" explanations difficult.

**Solution**:
- **Messages table**: Added columns:
  - `decision_action` (TEXT) - e.g., "ACCEPT", "COUNTER"
  - `utility_score` (NUMERIC) - e.g., 0.84
  - `counter_offer` (JSONB) - if action is COUNTER
- **Deals table**: Added columns:
  - `latest_vendor_offer` (JSONB) - last vendor offer parsed
  - `latest_decision_action` (TEXT) - last decision made
  - `latest_utility` (NUMERIC) - utility of last decision

**Migration**: Run `yarn migrate:derived` to apply schema changes.

**Outcome**: Can show "why it accepted" in summary and build a dashboard later.

---

## 5. ✅ Improve Parsing Robustness

**Problem**: Parser missed common price/term formats, causing unnecessary ASK_CLARIFY.

**Solution**: Enhanced `parseOfferRegex()` to handle:
- **Price formats**:
  - `"$95"`, `"95$"`, `"USD 95"`, `"₹95"`, `"rs 95"`
  - `"95 per unit"`, `"95/unit"`
  - `"$1,200"` (commas removed before parsing)
- **Term formats** (already handled):
  - `"Net 60 days"` → `"Net 60"`
  - `"payment terms 50 days"` → flagged as non-standard
  - `"50 days"` → flagged as non-standard

**Outcome**: Fewer ASK_CLARIFY surprises, more realistic behavior.

---

## 6. ✅ Add /resume Endpoint

**Problem**: ESCALATED deals were a dead end - no way to resume after policy adjustments.

**Solution**:
- New endpoint: `POST /api/deals/:dealId/resume`
- Sets `status` from `ESCALATED` → `NEGOTIATING`
- Validates: only ESCALATED deals can be resumed
- Returns `{deal, messages}` for UI consistency

**Outcome**: "Escalate" feels like a workflow, not a dead end. Users can adjust thresholds and resume.

---

## Files Changed

### New Files
- `src/engine/processVendorTurn.ts` - Shared negotiation pipeline
- `sql/002_add_derived_fields.sql` - Database migration
- `src/db/migrateDerivedFields.ts` - Migration script

### Modified Files
- `src/routes/deals.ts` - Uses shared pipeline, adds /resume, scenario support
- `src/routes/vendorSim.ts` - Uses shared pipeline, scenario support
- `src/repo/dealsRepo.ts` - Added derived fields storage, resumeDeal()
- `src/vendor/vendorAgent.ts` - Added scenario parameter
- `src/engine/parseOffer.ts` - Improved price/term parsing
- `package.json` - Added `migrate:derived` script

---

## Migration Instructions

1. **Run database migration**:
   ```bash
   cd backend
   yarn migrate:derived
   ```

2. **Verify migration**:
   ```bash
   yarn test
   ```
   All 7 integration tests should pass.

---

## Testing

All integration tests pass:
- ✅ Scenario 1: Happy path ACCEPT + terminal lock
- ✅ Scenario 2: Counter-offer + reply validation
- ✅ Scenario 3: ASK_CLARIFY for missing terms
- ✅ Scenario 4: Non-standard terms triggers clarification
- ✅ Scenario 5: ESCALATE/WALK_AWAY blocks chat
- ✅ Scenario 6: Reset works correctly
- ✅ Bonus: Run Demo stops at terminal and respects max rounds

---

## Next Steps (Optional)

1. **Frontend updates**: Update UI to use scenario parameter in demo controls
2. **Analytics dashboard**: Use derived fields to show negotiation patterns
3. **Summary page**: Display `latest_decision_action` and `latest_utility` in deal summaries

