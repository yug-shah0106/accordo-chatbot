# Integration Tests

This test suite validates core API functionality and prevents regressions.

## Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Ensure your database is running and `.env` is configured with `DATABASE_URL`

3. Run migrations:
```bash
npm run migrate
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Test Scenarios

### Scenario 1: Happy Path ACCEPT
- Validates that good offers are accepted
- Ensures terminal state blocks further messages

### Scenario 2: Counter-Offer Validation
- Verifies COUNTER decisions include correct values
- Validates reply contains exact counter offer numbers

### Scenario 3: ASK_CLARIFY for Missing Terms
- Tests partial offer handling
- Ensures system asks only for missing fields

### Scenario 4: Non-Standard Terms
- Validates non-standard term handling
- Ensures clarification is requested

### Scenario 5: ESCALATE/WALK_AWAY Blocking
- Tests terminal state enforcement
- Verifies chat is blocked after escalation

### Scenario 6: Reset Functionality
- Validates reset clears transcript
- Ensures deal returns to NEGOTIATING state

### Bonus: Run Demo Limits
- Validates max rounds enforcement
- Ensures demo stops at terminal states

## Notes

- Tests use a real database connection (ensure test DB is separate or cleanup works)
- Each test cleans up after itself
- Tests may require Ollama to be running (or will use fallback replies)

