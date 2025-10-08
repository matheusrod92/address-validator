# Address Validation API - README

## 1. Install & Run

```bash
# Install PNPM if you don't have it
npm install -g pnpm@latest-10

# Install dependencies
pnpm install

# Configure environment variables
cp .env.template .env
# Edit .env and add your API keys:
# GOOGLE_API_KEY=your_google_key
# SMARTY_AUTH_ID=your_smarty_id
# SMARTY_AUTH_TOKEN=your_smarty_token

# Run development server
pnpm start:dev

# Run tests
pnpm test

# Build for production
pnpm build
```

The API will be available at `http://localhost:8080`

**Swagger documentation** is automatically available at `http://localhost:8080` when the server runs.

## 2. Project Structure

```
src/api/address/
├── addressController.ts  # HTTP request/response handlers
├── addressRouter.ts      # Route definitions + OpenAPI specs
├── addressService.ts     # Core business logic & provider fallback
└── addressModel.ts       # Zod validation schemas & TypeScript types

src/common/services/
├── googleService.ts      # Google Address Validation API adapter
└── smartyService.ts      # Smarty US Street Address API adapter
```

**Key endpoint:** `POST /validate-address`

**Request:**
```json
{
  "address": "1600 Amphitheatre Pkwy, Mtn View CA",
  "provider": "google"
}
```
*`provider` is optional: `"google"` | `"smarty"`* (this will force usage of the provider)

**Response:**
```json
{
  "input": "1600 Amphitheatre Pkwy, Mtn View CA",
  "standardized": {
    "number": "1600",
    "street": "Amphitheatre Parkway",
    "city": "Mountain View",
    "state": "CA",
    "zip": "94043"
  },
  "status": "CORRECTED",
  "corrections": ["Address components were corrected or replaced"],
  "warnings": [],
  "provider": "google"
}
```

**Status values:**
- `VALID` - Address is syntactically correct and complete
- `CORRECTED` - Address required fixes (typos, abbreviations, missing components)
- `UNVERIFIABLE` - Address is incomplete, inconsistent, or non-US

## 3. Design Decisions & Trade-offs

### Syntactic vs. Postal Validation
**Decision:** Implemented syntactic validation only (not USPS deliverability checks).

**Rationale:** For fintech/insurance use cases, we need addresses that are structurally valid and normalized, not necessarily postal-deliverable. This supports use cases like lease agreements where addresses must be coherent but might represent new developments or non-standard locations.

### Dual Provider Strategy
**Decision:** Google as primary, Smarty as fallback.

**Trade-offs:**
- **Google strengths:** Advanced heuristics, typo correction, confidence levels per component
- **Smarty strengths:** Fast, US-focused, reliable normalization
- **Cost:** More integration complexity, dual API key management
- **Benefit:** Redundancy and complementary capabilities

If Google returns `UNVERIFIABLE`, the system automatically tries Smarty before giving up.

### US-Only Constraint
**Decision:** Reject non-US addresses explicitly.

**Rationale:** Aligns with TheGuarantors' business domain (US rental/insurance market). Google's API supports international addresses, so we added explicit validation to ensure `regionCode === "US"`.

### Response Format
**Decision:** Removed the boilerplate's `ServiceResponse` wrapper pattern for direct JSON responses.

**Rationale:** Simpler API contract. Instead of:
```json
{ "success": true, "responseObject": { /* actual data */ } }
```
We return the data directly, with standard HTTP status codes and error objects.

### Boilerplate Usage
**Decision:** Used [edwinhern/express-typescript](https://github.com/edwinhern/express-typescript) as the foundation.

**Trade-offs:**
- **Gain:** Fast setup with TypeScript, Zod, OpenAPI docs, testing, linting, Docker pre-configured and Rate Limiter
- **Cost:** Predefined structure and tooling choices (e.g., Vitest, Pino logger, specific middleware patterns)
- **Mitigation:** Removed or adapted parts that didn't fit (e.g., ServiceResponse wrapper)

## 4. AI Usage

### ChatGPT
- **Purpose:** Solution design discussion and API research
- **Tasks:**
  - Explored Google Address Validation API vs Smarty Streets capabilities
  - Discussed trade-offs between syntactic vs postal validation
  - Researched how to interpret Google's `verdict` and `confirmationLevel` fields
  - Identified best practices for address normalization in fintech contexts

### Claude Code
- **Purpose:** Implementation and test generation
- **Tasks:**
  - Wrote comprehensive test suites for all services (45+ test cases)
  - Fixed edge cases discovered during testing (street number duplication, US-only validation, partial data handling)
  - Refactored response format when removing ServiceResponse wrapper

**Workflow:** ChatGPT for architectural decisions → Claude Code for tests and polishing.
