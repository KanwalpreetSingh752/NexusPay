# NexusPay — Production-Grade Payment Gateway & Financial Settlement Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D.svg?logo=redis)](https://redis.io/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **NexusPay** is an enterprise-grade payment gateway and ledger settlement engine engineered from first principles to reflect real-world fintech distributed systems (modeled after **Stripe, Razorpay, CRED, and Adyen**). 
>
> Unlike typical CRUD wrappers around a payment modal, NexusPay explicitly solves **distributed transaction consistency, two-phase cross-system failures, double-spending races, untrusted client signals, outbox-driven durable event dispatch, and immutable financial accounting**.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [The 7 Hard Engineering Invariants](#-the-7-hard-engineering-invariants)
- [Entity-Relationship & Data Model](#-entity-relationship--data-model)
- [Payment State Machine & Lifecycle](#-payment-state-machine--lifecycle)
- [Security & Threat Model](#-security--threat-model)
- [API Reference](#-api-reference)
- [Repository Structure](#-repository-structure)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Automated Verification & Tests](#-automated-verification--tests)
- [Interactive Demo Guide](#-interactive-demo-guide)
- [Fintech Placement Interview Cheat Sheet](#-fintech-placement-interview-cheat-sheet)

---

## 🏗️ System Architecture

NexusPay adopts a **Clean Architecture Modular Monolith** pattern. Business logic is strictly decoupled from providers, frameworks, and storage layers.

```
                          ┌──────────────────────────────────────────────┐
                          │         Merchant Portal / Checkout Demo      │
                          │            (React + Vite + Tailwind)         │
                          └──────────────────────┬───────────────────────┘
                                                 │ HTTPS (JWT / API Key)
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ NexusPay Core Engine (Express + TypeScript)                                                 │
│                                                                                             │
│  [Sliding-Window Rate Limiter] ──▶ [Dual Auth: JWT / SHA-256 API Key] ──▶ [Idempotency Guard]│
│                                                                                             │
│  ┌────────────────────────┐    ┌───────────────────────────┐    ┌────────────────────────┐  │
│  │     Payment Domain     │    │   Webhook Ingress (PSP)   │    │ Merchant Outbox Relay  │  │
│  │ ────────────────────── │    │ ───────────────────────── │    │ ────────────────────── │  │
│  │ • State Machine Guard  │    │ • Raw Buffer HMAC Verify  │    │ • FOR UPDATE SKIP LOCK │  │
│  │ • Intent vs Attempt    │    │ • Provider Deduplication  │    │ • Exponential Backoff  │  │
│  │ • Row-Lock Refund Cap  │    │ • Authoritative Capture   │    │ • Webhook Signatures   │  │
│  └───────────┬────────────┘    └─────────────┬─────────────┘    └───────────┬────────────┘  │
│              │                               │                              │               │
│              └───────────────────────────────┼──────────────────────────────┘               │
│                                              │                                              │
│                                 Single ACID Transaction Boundary                             │
│                                              ▼                                              │
│                      ┌───────────────────────────────────────────────┐                      │
│                      │           PostgreSQL 15+ (Source of Truth)    │                      │
│                      │ ───────────────────────────────────────────── │                      │
│                      │ • Atomic Idempotency Records & Payload Hashes │                      │
│                      │ • PaymentIntents & Multi-Attempts (BigInt)    │                      │
│                      │ • Pessimistic Locked Refunds                  │                      │
│                      │ • Append-Only Transaction Journal Entries     │                      │
│                      │ • Transactional Outbox Events & Deliveries    │                      │
│                      └───────────────────────┬───────────────────────┘                      │
│                                              │                                              │
│                      ┌───────────────────────┴───────────────────────┐                      │
│                      ▼                                               ▼                      │
│  ┌───────────────────────────────────────┐   ┌───────────────────────────────────────────┐  │
│  │ Redis 7+ Cache & Rate Limiting        │   │ Autonomous Background Daemons             │  │
│  │ ───────────────────────────────────── │   │ ───────────────────────────────────────── │  │
│  │ • ZSET Sliding Window Counters        │   │ • Outbox Relay (At-least-once delivery)   │  │
│  │ • Idempotent Fast-Path Lookup         │   │ • Cross-System Reconciliation Engine      │  │
│  └───────────────────────────────────────┘   │ • Stale Idempotency Cleaner               │  │
│                                              └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┬──────────────────────────────────────┘
                                                       │
                           Provider Boundary (Non-ACID)│
                                                       ▼
                                       ┌───────────────────────────────┐
                                       │   Payment Service Provider    │
                                       │    (Razorpay API & Webhooks)  │
                                       └───────────────────────────────┘
```

---

## 🎯 The 7 Hard Engineering Invariants

These 7 invariants form the architectural core of NexusPay. Each addresses a classic distributed systems problem in financial technology.

### 1. PostgreSQL Atomic Idempotency Reservation
* **The Vulnerability:** Naive implementations check Redis and then write to PostgreSQL. Under heavy concurrency (e.g., flash sales, rapid double-clicks), two concurrent requests both miss the cache, bypass the check simultaneously, and produce duplicate credit card charges (**TOCTOU race condition**).
* **The Invariant:** NexusPay enforces an **atomic reservation** in PostgreSQL via a compound unique constraint:
  ```sql
  UNIQUE (merchant_id, operation, idempotency_key)
  ```
  The first request inserts a row with state `PROCESSING`. A concurrent request hits the database constraint and is immediately rejected with `409 Conflict`.
* **Tamper Proofing:** The payload is recursively sorted and hashed using `SHA-256`. Replaying the same key with an altered amount or currency returns `400 Bad Request` ("Idempotency payload mismatch"). Replaying with the exact same payload returns the cached original HTTP response.

### 2. Separation of `PaymentIntent` and `PaymentAttempt`
* **The Vulnerability:** Storing provider transaction identifiers (e.g., `razorpay_order_id`) directly on the order record breaks when a customer switches payment methods, when an order times out, or when multiple payment attempts are made for one logical cart.
* **The Invariant:**
  * **`PaymentIntent`:** Represents the merchant's logical intention to collect funds (amount, currency, merchant ownership, cumulative settled balance).
  * **`PaymentAttempt`:** Represents an individual execution against an external banking/PSP network.
  * *Benefits:* Supports multi-attempt histories, retries on different payment rails, and prevents delayed provider failure webhooks from overwriting a successful settlement.

### 3. Dual-System Cross-Boundary Fault Recovery
* **The Vulnerability:** A single relational database transaction cannot atomically span your database and an external third-party HTTP API (Razorpay/Stripe). If the external API call succeeds but the local network drops before saving the provider reference, an orphaned charge occurs.
* **The Invariant:** 
  1. Internal `PaymentIntent` and `PaymentAttempt` records are persisted **before** calling external APIs.
  2. The internal attempt ID is forwarded to the provider as a deterministic reference (`receipt`).
  3. If the network call times out, the attempt is marked `UNCERTAIN` (never assumed failed).
  4. An asynchronous **Reconciliation Worker** queries Razorpay using the `receipt` reference to synchronize the authoritative state without duplicate order creation.

### 4. Untrusted Browser Checkout Callbacks
* **The Vulnerability:** Front-end JavaScript callbacks (e.g., Razorpay modal handlers) execute on client devices and are fundamentally untrusted. Malicious users can intercept requests, fake transaction success payloads, or alter amounts in transit.
* **The Invariant:** The client-side callback is treated strictly as an optimization hint. Settlement requires:
  1. Cryptographic HMAC-SHA256 signature verification over `order_id + "|" + payment_id`.
  2. Tenant ownership validation (verifying the order belongs to the authenticated merchant).
  3. Server-to-server authoritative validation: Fetching the payment record directly from Razorpay's API to confirm `amount`, `currency`, and `captured` status match the internal intent.
  4. Ingress webhooks serve as the authoritative fall-through if the browser disconnects before posting the callback.

### 5. Transactional Outbox Pattern for Webhooks
* **The Vulnerability:** Updating payment status in the database and emitting an HTTP webhook in memory causes dual-write failure: if the server restarts after the DB commit but before the HTTP post, downstream merchant systems never learn of the payment.
* **The Invariant:**
  * The domain state change and the webhook event (`outbox_events`) are committed in the **exact same ACID PostgreSQL transaction**.
  * A dedicated background Outbox Worker selects pending events using:
    ```sql
    SELECT * FROM outbox_events WHERE status = 'PENDING' FOR UPDATE SKIP LOCKED LIMIT 50;
    ```
  * Events are cryptographically signed using the merchant's endpoint secret (`X-NexusPay-Signature: t=...,v1=...`) and retried using exponential backoff with jitter up to 10 attempts.

### 6. Append-Only Financial Transaction Journal
* **The Vulnerability:** Storing balance as an editable column (`balance = balance + amount`) allows race conditions and creates an un-auditable system where silent data corruption cannot be diagnosed or reversed.
* **The Invariant:** Balances are **never modified in-place**. Every captured payment, platform fee deduction, and refund appends an immutable record to `transaction_journal_entries`:
  * `PAYMENT_CAPTURE` records gross amount, 2% platform fee, and net balance.
  * `REFUND_FULL` and `REFUND_PARTIAL` record adjustments against the original entry.
  * Foreign keys referencing financial history utilize `ON DELETE RESTRICT` to prevent accidental deletion of historical records.

### 7. Concurrency-Safe Refund Processing
* **The Vulnerability:** If a merchant triggers two refund requests for ₹500 simultaneously on an order captured at ₹600, both requests could pass validation in parallel and refund ₹1,000, causing a direct financial loss (**double-refund race**).
* **The Invariant:** Refunds acquire a pessimistic row-level database lock:
  ```sql
  SELECT * FROM payment_intents WHERE id = $1 FOR UPDATE;
  ```
  The engine verifies `(refundedAmount + requestedAmount) <= capturedAmount` inside the locked transaction before calling the payment provider. Subsequent requests queue behind the lock and are rejected once the available balance is exhausted.

---

## 🗄️ Entity-Relationship & Data Model

NexusPay uses 14 relational tables in PostgreSQL managed via Prisma ORM:

```mermaid
erDiagram
    merchants ||--o{ users : "has"
    merchants ||--o{ api_keys : "owns"
    merchants ||--o{ payment_intents : "collects"
    merchants ||--o{ idempotency_records : "scopes"
    merchants ||--o{ merchant_webhook_endpoints : "configures"
    merchants ||--o{ transaction_journal_entries : "audits"

    payment_intents ||--o{ payment_attempts : "attempts"
    payment_intents ||--o{ refunds : "has"
    payment_intents ||--o{ transaction_journal_entries : "journals"

    merchant_webhook_endpoints ||--o{ webhook_deliveries : "receives"
    merchant_webhook_events ||--o{ webhook_deliveries : "delivers"

    users ||--o{ refresh_tokens : "authenticates"
```

### Core Schema Highlights

| Model | Primary Invariant Enforced | Key Fields |
|---|---|---|
| `IdempotencyRecord` | Atomic reservation & request fingerprinting | `merchantId`, `operation`, `idempotencyKey` (Compound Unique), `requestHash`, `status` |
| `PaymentIntent` | Overall payment lifecycle & ledger state | `amount` (BigInt), `capturedAmount`, `refundedAmount`, `status` (Enum), `currency` |
| `PaymentAttempt` | Per-attempt PSP interaction | `paymentIntentId`, `attemptNumber`, `providerOrderId`, `providerPaymentId`, `status` |
| `Refund` | Safe partial/full reversals | `paymentIntentId`, `amount` (BigInt), `status`, `providerRefundId` |
| `TransactionJournalEntry` | Append-only financial ledger | `grossAmount`, `feeAmount`, `netAmount`, `entryType`, `paymentIntentId` |
| `OutboxEvent` | Guaranteed webhook dispatch | `aggregateType`, `aggregateId`, `eventType`, `payload`, `status`, `retryCount` |
| `ApiKey` | Cryptographic secret storage | `keyPrefix`, `keyHash` (SHA-256, secrets never stored plaintext) |

---

## 🔄 Payment State Machine & Lifecycle

```mermaid
stateDiagram-v2
    [*] --> REQUIRES_PAYMENT: Intent Created
    REQUIRES_PAYMENT --> PROCESSING: Attempt Initiated (PSP Order Linked)
    
    PROCESSING --> SUCCEEDED: Authoritative Capture (HMAC + State Match)
    PROCESSING --> FAILED: Hard Decline / Invalid Signature
    PROCESSING --> UNCERTAIN: Network Timeout / Ambiguous
    
    UNCERTAIN --> SUCCEEDED: Reconciliation Match
    UNCERTAIN --> FAILED: Reconciliation Decline
    
    SUCCEEDED --> PARTIALLY_REFUNDED: Partial Refund Executed
    PARTIALLY_REFUNDED --> PARTIALLY_REFUNDED: Further Partial Refund
    PARTIALLY_REFUNDED --> REFUNDED: Balance Exhausted
    SUCCEEDED --> REFUNDED: Full Refund Executed

    FAILED --> [*]
    REFUNDED --> [*]
```

### State Transition Rules
1. **Terminal State Immutability:** Once an intent reaches `SUCCEEDED`, delayed `FAILED` webhooks are rejected.
2. **Refund Eligibility:** Refunds are only permitted from states `SUCCEEDED` or `PARTIALLY_REFUNDED`.
3. **Pessimistic Balance Verification:** `refundedAmount` is tracked monotonically and cannot exceed `capturedAmount`.

---

## 🛡️ Security & Threat Model

| Threat | Attack Vector | NexusPay Defense |
|---|---|---|
| **Replay Attacks** | Resending valid captured payloads | Unique idempotency key reservation scoped to `(merchantId, operation, key)`. |
| **Payload Tampering** | Reusing a key with an inflated amount | Recursive deterministic JSON sorting + SHA-256 payload hashing. Mismatches return `400 Bad Request`. |
| **Secret Leakage** | Database leak exposing merchant keys | API secrets are displayed **once** upon creation. Stored in DB using non-reversible `SHA-256` hashes. |
| **Log Infiltration** | Card/Key details printed in log drains | Custom Winston redactor masks `password`, `accessToken`, `refreshToken`, `authorization`, and `signature`. |
| **API Abuse / DDoS** | Rapid unauthenticated endpoint spam | Redis Sorted-Set Sliding-Window rate limiter (120 req/min/IP). |
| **Data Loss on Cascade** | Deleting a merchant erases records | All financial relationships enforce `ON DELETE RESTRICT`. |
| **Timing Attacks** | Secret string comparison in webhooks | `crypto.timingSafeEqual` used on all HMAC verifications. |

---

## 📡 API Reference

All requests accept and return JSON. Endpoints (except public webhooks/health) require either:
- **Dashboard:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Merchant API:** `Authorization: Bearer npay_test_<API_KEY>`

### 1. Payment Intents

#### Create Intent
```http
POST /api/v1/payments/intents
Idempotency-Key: e2e-tx-99482716
Content-Type: application/json

{
  "amount": 49900,
  "currency": "INR",
  "description": "Enterprise Cloud Plan",
  "customerId": "cust_8281",
  "customerEmail": "finance@acme.com",
  "customerName": "Alice Smith"
}
```
*Note: Monetary values are represented in **integer minor units** (e.g., `49900` = ₹499.00).*

#### Verify & Authorize Payment
```http
POST /api/v1/payments/verify
Idempotency-Key: e2e-verify-8812
Content-Type: application/json

{
  "razorpayOrderId": "order_0d856e33a75be71ee899",
  "razorpayPaymentId": "pay_994827164920",
  "razorpaySignature": "simulated_valid_signature"
}
```

#### Process Safe Refund
```http
POST /api/v1/payments/:id/refunds
Idempotency-Key: rfnd-key-1029
Content-Type: application/json

{
  "amount": 20000,
  "reason": "Customer cancellation within 14 days"
}
```

#### Cursor-Paginated List
```http
GET /api/v1/payments?limit=20&status=SUCCEEDED&cursor=MjAyNi0xMC0yN1QxMzoxMzo0Mi4wMTBaI2IwOTQ...
```

### 2. Analytics & Reporting
- `GET /api/v1/analytics/overview` — Gross volume, net volume, intent success rates, conversion rates.
- `GET /api/v1/analytics/trends?days=14` — Daily volume aggregated for charts.
- `GET /api/v1/analytics/methods` — Breakdown by payment method (card, upi, netbanking).

### 3. API Key Management
- `GET /api/v1/api-keys` — List active merchant keys (hash hidden, prefix exposed).
- `POST /api/v1/api-keys` — Issue new API key pair (returns raw secret once).
- `DELETE /api/v1/api-keys/:id` — Immediately revoke key.

### 4. Health & Diagnostics
- `GET /health/live` — Basic liveness probe (`{"status": "ok"}`).
- `GET /health/ready` — Deep readiness probe verifying active PostgreSQL connection pool & Redis ping.

---

## 📂 Repository Structure

```
NexusPay/
├── package.json                   # Workspaces configuration (server + client)
├── docker-compose.yml             # Local PostgreSQL 15 & Redis 7 services
├── .env.example                   # Baseline environment configurations
│
├── server/                        # Backend Service (Node.js + Express + TS)
│   ├── prisma/
│   │   ├── schema.prisma          # 14-model relational database schema
│   │   └── seed.ts                # Deterministic seed data (Demo Merchant)
│   └── src/
│       ├── config/                # Environment validation (Zod), DB, & Redis singletons
│       ├── middleware/            # Auth, Sliding Limiter, Idempotency, Error Handler
│       ├── modules/
│       │   ├── auth/              # JWT session lifecycle, refresh token rotation
│       │   ├── payments/          # Intent creation, settlement, concurrency-safe refunds
│       │   ├── webhooks/          # Provider ingress HMAC, merchant outbox dispatch
│       │   ├── api-keys/          # SHA-256 hashed API key management
│       │   └── analytics/         # SQL aggregated business metrics
│       ├── integrations/razorpay/ # PSP client wrapper + resilient simulation mode
│       ├── workers/               # Outbox dispatch & reconciliation background jobs
│       └── tests/                 # End-to-end invariant test suites (Jest + Supertest)
│
└── client/                        # Merchant Operations Dashboard (React 18 + Vite)
    └── src/
        ├── api/                   # Axios client with JWT refresh interceptors
        ├── context/               # Global authentication context
        ├── components/layout/     # Dark-theme dashboard shell, nav, status bar
        └── pages/dashboard/
            ├── OverviewPage.tsx   # Financial KPI cards & Recharts area charts
            ├── CheckoutDemoPage.tsx # Live interactive payment simulation modal
            ├── PaymentsPage.tsx   # Transaction explorer & refund modal
            ├── ApiKeysPage.tsx    # Key generation & revocation management
            └── WebhooksPage.tsx   # Real-time webhook logs & delivery inspect
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm` v9+
- **Database**: PostgreSQL 15+ (local installation or Docker)
- **Cache**: Redis 7+ (local installation or Docker)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/NexusPay.git
cd NexusPay

# Install all workspace dependencies
npm install
```

### 2. Configure Environment Variables
Copy the template configuration files:
```bash
cp .env.example .env
cp .env.example server/.env
```

Ensure `server/.env` contains your database and redis connection strings:
```env
PORT=4000
NODE_ENV=development
API_PREFIX=/api/v1
DATABASE_URL="postgresql://nexuspay_admin:nexuspay_secure_dev@localhost:5432/nexuspay?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="super-secret-jwt-access-key-minimum-32-characters"
JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-minimum-32-characters"
RAZORPAY_KEY_ID="rzp_test_NexusDemoKey01"
RAZORPAY_KEY_SECRET="rzp_test_secret_key_01"
RAZORPAY_WEBHOOK_SECRET="rzp_test_webhook_secret_01"
RAZORPAY_SIMULATION_MODE=true
```

### 3. Start Infrastructure (Docker)
If you do not have native PostgreSQL and Redis running:
```bash
docker compose up -d
```

### 4. Push Schema & Seed Database
```bash
cd server
npx prisma db push
npx tsx src/prisma/seed.ts
cd ..
```

*Pre-seeded Demo Credentials:*
- **Portal URL:** `http://localhost:5173`
- **Email:** `demo@nexuspay.dev`
- **Password:** `Password@123`
- **Test Key:** `npay_test_nexusdemo1234567890abcdef`

### 5. Launch Development Servers
Open two terminal windows:

```powershell
# Terminal 1: Backend API
cd D:\projects\NexusPay\server
npm run dev
# Running on http://localhost:4000
```

```powershell
# Terminal 2: React Dashboard
cd D:\projects\NexusPay\client
npm run dev
# Running on http://localhost:5173
```

---

## 🧪 Automated Verification & Tests

NexusPay includes automated tests validating core distributed system invariants:

```bash
cd server
npm test
```

### Test Suite Coverage

```text
 PASS  src/tests/auth.test.ts
  ✓ Register new merchant + user (212 ms)
  ✓ Login returns JWT pair (89 ms)
  ✓ Token refresh rotates tokens and invalidates previous (145 ms)

 PASS  src/tests/idempotency.test.ts
  ✓ Atomically reserves request and returns identical response on replay (178 ms)
  ✓ Rejects modified payload under identical key with 400 Bad Request (92 ms)
  ✓ Rejects concurrent collision with 409 Conflict (115 ms)

 PASS  src/tests/payment.state.test.ts
  ✓ Rejects invalid monetary representations (paise fractions) (45 ms)
  ✓ Enforces server-side HMAC validation (rejects forged signatures) (64 ms)
  ✓ Full lifecycle: Intent -> Processing -> Succeeded -> Partial Refund (312 ms)
  ✓ Enforces pessimistic locking: Rejects refunds exceeding captured amount (190 ms)

Test Suites: 3 passed, 3 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        11.132 s
```

---

## 💻 Interactive Demo Guide

To demonstrate the gateway in an interview setting:

1. **Open the Dashboard:** Go to `http://localhost:5173` and log in with `demo@nexuspay.dev`.
2. **Open the Checkout Demo:** Navigate to `/checkout-demo`.
3. **Trigger a Payment:** Click **Pay ₹499.00 (Test Mode)**.
   - *Inspect Network Tab:* Observe the `Idempotency-Key` header sent with the request.
   - *Observe Monitor:* Watch the 4-step state progression:
     1. Intent persisted with status `REQUIRES_PAYMENT`.
     2. Attempt created with status `PENDING_PROVIDER` and order linked.
     3. Signature verified with `crypto.timingSafeEqual` and Razorpay state checked.
     4. Atomic ledger commit: status updated to `SUCCEEDED` with an immutable journal entry.
4. **Trigger a Safe Refund:**
   - Go to **Payments Explorer** (`/payments`).
   - Click **Refund** on the settled transaction.
   - Enter an amount (e.g., ₹200.00). The transaction updates to `PARTIALLY_REFUNDED`.
   - Attempt to refund ₹400.00 (exceeding the remaining balance). Observe that the engine rejects the request with `400 Bad Request`.

---

## 🎤 Fintech Placement Interview Cheat Sheet

| Question an Interviewer Will Ask | Production Answer (How NexusPay Works) |
|---|---|
| *"Why not use Redis alone for idempotency?"* | "A Redis-only approach using `SETNX` or `INCR` is susceptible to TOCTOU race conditions and data loss during memory eviction or Redis failover. In NexusPay, we use a PostgreSQL unique constraint on `(merchant_id, operation, idempotency_key)` to guarantee atomic reservation. Redis is used solely as an optional cache layer." |
| *"What happens if your server crashes after Razorpay captures a payment but before you save it?"* | "We use an asynchronous reconciliation workflow. We persist the `PaymentIntent` and `PaymentAttempt` *before* calling Razorpay, passing our internal attempt ID as the `receipt`. If a timeout occurs, the attempt is marked `UNCERTAIN`. Our Reconciliation Worker polls Razorpay with that receipt to synchronize state authoritatively." |
| *"Why can't we trust the signature verification callback from the browser checkout?"* | "The browser environment is untrusted. Even with a valid signature, the user could have paid against a different order ID or for a lower amount. NexusPay verifies the cryptographic signature, validates tenant ownership, and calls the Razorpay API directly to confirm that `amount`, `currency`, and `status` match our database intent." |
| *"How do you prevent duplicate webhook delivery from crashing downstream systems?"* | "On ingress, incoming webhooks are deduplicated using a unique constraint on `provider_event_id`. On egress, we use the Transactional Outbox pattern: the database updates and outbox events commit in the same ACID transaction. An asynchronous worker delivers events with `FOR UPDATE SKIP LOCKED` and exponential backoff." |
| *"Why not update merchant balances with a simple `UPDATE merchants SET balance = balance + amount`?"* | "Direct balance updates destroy financial auditability. NexusPay uses an append-only `TransactionJournalEntry` model. Every payment capture, fee deduction, and refund is recorded as an immutable debit/credit row. Balances are derived, preventing silent corruption." |
| *"How do you prevent race conditions on concurrent refund requests?"* | "We use pessimistic row-level locking via `SELECT ... FOR UPDATE` on the `PaymentIntent`. In the locked transaction, we check that `refundedAmount + requestedAmount <= capturedAmount`. Concurrent requests block until the first finishes and are rejected once available balance is zero." |

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details. Built for engineering placement demonstrations and distributed system case studies.
