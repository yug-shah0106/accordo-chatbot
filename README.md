# Accordo MVP - Negotiation Chatbot

A complete MVP for an AI-powered negotiation chatbot that handles procurement negotiations with hardcoded decision logic and Ollama for natural language generation.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Docker)
- **AI**: Local Ollama (llama3.1)

## Architecture

- **Monorepo** structure with separate `backend/` and `frontend/` directories
- **Hardcoded negotiation engine** for predictable decision-making
- **Ollama integration** for generating human-like negotiation messages
- **PostgreSQL** for persistence (deals, messages, audit logs)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Ollama installed locally

### 1. Setup Database

```bash
# Start PostgreSQL
docker compose up -d

# Verify it's running
docker ps
```

### 2. Setup Backend

```bash
cd backend

# Install dependencies (already done)
npm install

# Create .env file (if not exists)
# PORT=4000
# DATABASE_URL=postgresql://accordo:accordo@localhost:5432/accordo_mvp
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.1

# Run database migration
npm run migrate

# Start backend server
npm run dev
```

Backend will run on `http://localhost:4000`

### 3. Setup Ollama

```bash
# Install Ollama (if not installed)
# macOS: brew install ollama
# Or download from https://ollama.ai

# Pull the model
ollama pull llama3.1

# Verify it's running
curl http://localhost:11434/api/tags
```

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies (already done)
npm install

# Create .env file (if not exists)
# VITE_API_BASE_URL=http://localhost:4000/api

# Start frontend dev server
npm run dev
```

Frontend will run on `http://localhost:5173`

## Project Structure

```
accordo-mvp/
├── backend/
│   ├── src/
│   │   ├── db/           # Database connection & migrations
│   │   ├── engine/       # Negotiation logic (config, utility, decide)
│   │   ├── ollama/       # Ollama integration (extract, writeReply)
│   │   ├── repo/         # Database queries
│   │   ├── routes/       # Express API routes
│   │   └── index.ts      # Express app entry
│   ├── sql/              # SQL migration files
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── pages/        # React pages (NewDeal, Chat, Summary)
│   │   └── App.tsx       # Router setup
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Endpoints

### `POST /api/deals`
Create a new deal negotiation.

**Request:**
```json
{
  "title": "Office Supplies Q1 2024",
  "counterparty": "Acme Corp",
  "templateId": null
}
```

**Response:**
```json
{
  "id": "uuid"
}
```

### `GET /api/deals/:dealId`
Get deal details and all messages.

**Response:**
```json
{
  "deal": { ... },
  "messages": [ ... ]
}
```

### `POST /api/deals/:dealId/messages`
Send a vendor message and get Accordo's reply.

**Request:**
```json
{
  "text": "We can do 95 Net 30"
}
```

**Response:**
```json
{
  "decision": {
    "action": "COUNTER",
    "utilityScore": 0.65,
    "counterOffer": { "unit_price": 95, "payment_terms": "Net 60" },
    "reasons": [ ... ]
  },
  "reply": "Thank you for your offer..."
}
```

## Negotiation Logic

The engine negotiates on 2 variables:
- **unit_price**: Target 75-85, max acceptable 100
- **payment_terms**: Net 30 (0.2 utility), Net 60 (0.6), Net 90 (1.0)

**Decision Flow:**
1. Extract offer from vendor message (regex + optional Ollama)
2. Calculate utility score (0-1)
3. Apply guardrails:
   - Missing fields → ASK_CLARIFY
   - Price > max → WALK_AWAY
   - Utility >= 0.70 → ACCEPT
   - Utility < 0.45 or max rounds → ESCALATE
   - Otherwise → COUNTER with strategy
4. Generate reply via Ollama (with strict guardrails)
5. Persist to database

## Testing the MVP

Use the **Vendor Simulator** buttons in the chat UI for consistent demos:

1. **"Vendor: 95 Net 30"** → Should counter demanding better terms
2. **"Vendor: Net 60 max"** → Should ask for price clarification
3. **"Vendor: ok 93 Net 60"** → Should likely accept (high utility)
4. **"Vendor: 110 Net 30 (walk-away)"** → Should walk away (price too high)
5. **"Best price is 95"** → Should ask to clarify payment terms

## Development

### Backend
```bash
cd backend
npm run dev        # Start with hot reload
npm run migrate    # Run database migrations
```

### Frontend
```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Build for production
```

## Notes

- The `.env` files are gitignored - create them manually as shown above
- Ollama must be running before starting the backend
- Database must be migrated before first use
- All negotiation logic is hardcoded (no ML training required)

## Integration with Accordo Backend

The main Accordo backend (port 8000) integrates with this chatbot system:

### Automatic Deal Creation

When a vendor is attached to a requisition in the main system, a deal is automatically created here via `POST /api/deals`:

```javascript
// Called from Accordo backend's chatbot.service.js
POST /api/deals
{
  "title": "{ProjectName} - {RequisitionTitle}",
  "counterparty": "{VendorName}"
}
```

The returned deal ID is stored in the Contract model (`chatbotDealId`) and included in vendor notification emails.

### Email Links

Vendors receive emails with links to:
- **Vendor Portal**: `http://localhost:3000/vendor?token={uniqueToken}`
- **AI Negotiation Assistant**: `http://localhost:5173/conversation/deals/{dealId}`

### Configuration

The Accordo backend uses these environment variables:
```env
CHATBOT_FRONTEND_URL=http://localhost:5173
CHATBOT_API_URL=http://localhost:4000/api
```

## Next Steps (Post-MVP)

- Add authentication
- Support multiple deal templates
- Add webhook notifications
- Enhanced offer extraction with better regex/Ollama
- Analytics dashboard
- Export negotiation transcripts

