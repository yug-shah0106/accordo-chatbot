# Accordo MVP - Complete Task List

This document outlines the step-by-step tasks to build a negotiation chatbot MVP with React UI, Node backend, Postgres, and local Ollama.

## Stack Overview
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Docker)
- **AI**: Local Ollama (llama3.1)
- **Architecture**: Monorepo (backend/ + frontend/)

---

## TASK 0 — Create repo + folders (project skeleton)

**Context**: We will keep frontend and backend separate to stay clean and scalable.

**Steps**:
1. Create folder structure:
   ```
   mkdir accordo-mvp && cd accordo-mvp
   mkdir backend frontend
   ```

2. Initialize git (optional):
   ```
   git init
   ```

✅ **Done when**: folders exist.

---

## TASK 1 — Postgres setup (Docker) + env values

**Context**: Backend will store negotiation history in Postgres.

**Steps**:
1. Create `docker-compose.yml` in root
2. Run DB: `docker compose up -d`

✅ **Done when**: Postgres is running on localhost:5432.

---

## TASK 2 — Backend setup (Node + Express + TypeScript)

**Context**: Backend will expose APIs for: create deal, send vendor message, generate Accordo reply, fetch messages.

**Steps** (inside backend/):
1. Initialize npm project
2. Install dependencies
3. Setup TypeScript
4. Create `backend/.env` with config

✅ **Done when**: backend dependencies + env exist.

---

## TASK 3 — Create DB schema (SQL) + migration runner

**Context**: We persist:
- Deal templates (hardcoded config)
- Deals (each negotiation instance)
- Messages (vendor + accordo + decisions + extracted offer)

**Steps**:
1. Create `backend/sql/001_init.sql`
2. Create migration runner `backend/src/db/migrate.ts`
3. Run migration: `npm run migrate`

✅ **Done when**: tables exist in Postgres.

---

## TASK 4 — Backend DB helper (pg client wrapper)

**Context**: Next tasks will use this db.ts to read/write deals and messages.

**Steps**:
1. Create `backend/src/db/db.ts` with Pool connection

✅ **Done when**: backend can connect to DB.

---

## TASK 5 — Define the hardcoded negotiation config (the "playbook")

**Context**: This config drives all logic. Only 2 variables for MVP.

**Steps**:
1. Create `backend/src/engine/config.ts` with negotiation parameters

✅ **Done when**: config is defined and importable.

---

## TASK 6 — Define Offer + Decision schema (Zod validation)

**Context**: We never trust raw strings. Engine uses strict objects.

**Steps**:
1. Create `backend/src/engine/types.ts` with Zod schemas

✅ **Done when**: schemas compile.

---

## TASK 7 — Offer extraction (regex first, Ollama fallback)

**Context**: Vendor writes text like: "Best I can do is 95 Net 30". We extract {unit_price:95, payment_terms:"Net 30"}.

**Steps**:
1. Create `backend/src/engine/parseOffer.ts` with regex parser
2. Create `backend/src/ollama/extractOffer.ts` (optional Ollama fallback)

✅ **Done when**: you can extract {price, terms} from text.

---

## TASK 8 — Utility calculation (0..1) + hard guardrails

**Context**: Engine must "calculate" like Pactum. LLM must not decide numbers.

**Steps**:
1. Create `backend/src/engine/utility.ts` with utility functions

✅ **Done when**: you can compute utility for an offer.

---

## TASK 9 — Core hardcoded decision engine (Accept/Counter/Escalate)

**Context**: This is the "brain." Uses utility + rounds + trade-off ladder.

**Steps**:
1. Create `backend/src/engine/decide.ts` with decision logic

✅ **Done when**: engine always returns a safe decision.

---

## TASK 10 — Generate the chatbot text (Ollama "voice" + strict guardrails)

**Context**: Engine decides numbers; Ollama writes the message.

**Steps**:
1. Create `backend/src/ollama/writeReply.ts` with Ollama integration

✅ **Done when**: you get human-like negotiation responses.

---

## TASK 11 — Backend DB queries (create deal, save messages, fetch messages)

**Context**: Now we wire engine + DB. Next task will add APIs.

**Steps**:
1. Create `backend/src/repo/dealsRepo.ts` with all DB operations

✅ **Done when**: you can create deals and store messages.

---

## TASK 12 — Implement main API: send vendor message → decide → Ollama reply → save

**Context**: This endpoint is the core of the MVP.

**Steps**:
1. Create `backend/src/routes/deals.ts` with Express routes
2. Create `backend/src/index.ts` with Express app setup

✅ **Done when**:
- POST /api/deals works
- POST /api/deals/:id/messages returns {decision, reply} and persists data

---

## TASK 13 — Setup Ollama locally (model + test)

**Context**: Backend calls Ollama on http://localhost:11434.

**Steps**:
1. Install Ollama (your OS method)
2. Pull model: `ollama pull llama3.1`
3. Test: `curl http://localhost:11434/api/tags`

✅ **Done when**: tags show your model.

---

## TASK 14 — Frontend setup (React + Vite)

**Context**: Now we build chat UI to demo negotiations.

**Steps** (inside frontend/):
1. Create Vite React TypeScript project
2. Install axios
3. Create `frontend/.env`

✅ **Done when**: npm run dev starts React app.

---

## TASK 15 — Frontend: Create Deal screen

**Context**: A "New Deal" page to start demo quickly.

**Steps**:
1. Create `frontend/src/pages/NewDeal.tsx` with form

✅ **Done when**: you can create a deal from UI.

---

## TASK 16 — Frontend: Chat screen (vendor input → accordo reply)

**Context**: This is the main demo experience.

**Steps**:
1. Create chat UI with message list and input box

✅ **Done when**: chat works end-to-end.

---

## TASK 17 — Add "Vendor Simulator" buttons (for perfect demos)

**Context**: Demos fail when client writes weird stuff. Add buttons for consistent flows.

**Steps**:
1. Add preset message buttons to chat screen

✅ **Done when**: you can demo in 60 seconds reliably.

---

## TASK 18 — Agreement Summary page (audit output)

**Context**: Enterprise buyers will ask "what did it agree to, and why?"

**Steps**:
1. Create `/deals/:id/summary` page showing status, offers, decisions, transcript

✅ **Done when**: you have a clean "result screen".

---

## TASK 19 — MVP QA checklist (must pass before client demo)

**Context**: You need predictable behavior.

**Test messages**:
1. "We can do 95 Net 30" → counter demands better terms
2. "Ok Net 60" → controlled price concession
3. "90 Net 60" → likely accept
4. "110 Net 30" → walk away
5. "Best price is 95" → ask clarify for Net 30/60/90

✅ **Done when**: all 5 are stable.

---

## Full End-to-End Pseudocode

```
POST /deals/:id/messages(text):
  deal = db.getDeal(id)

  // Extract offer
  offer = parseOfferRegex(text)
  // optional: if missing fields -> offer = ollama_extract(text)

  db.addMessage(VENDOR, text, extractedOffer=offer)

  decision = decideNextMove(offer, deal.round + 1)

  replyText = ollama_writeReply(
     vendorText=text,
     vendorOffer=offer,
     decision=decision
  )

  db.addMessage(ACCORDO, replyText, engineDecision=decision)

  status = mapDecisionToStatus(decision.action)
  db.updateDeal(id, round+1, status, latest_offer_json=offer)

  return {decision, replyText}
```

