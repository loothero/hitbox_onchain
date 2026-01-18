# Hitbox — Product Requirements Document (PRD)

## 1. Product Overview

**Hitbox** is a collaborative, explorable artwork and game. A single shared cursor navigates a procedurally generated world under fog-of-war. The world itself is the artwork. The act of coordinated exploration is the performance.

The long-term vision is a **Twitch Plays Pokémon–style** experience where many participants collectively control one entity, except the output is not speedrunning a game but gradually revealing, inhabiting, and transforming a living artwork.

This PRD defines the next major evolution of Hitbox: introducing **onchain-native economic coordination** that incentivizes exploration while preserving accessibility, playability, and artistic openness.

---

## 2. Core Design Principles

1. **Exploration First**

   * There is no final “win state” for the map itself.
   * The primary reward is discovery, coordination, and shared authorship.

2. **Onchain Where It Matters**

   * Financial rules, settlement, and provenance belong onchain.
   * Real-time movement, rendering, and moment-to-moment play remain offchain.

3. **Composable Art Surface**

   * Gameplay logic is stable.
   * Visual themes, maps, and aesthetics are modular and community-driven.

4. **Low Friction Participation**

   * Micropayments should be cheap and predictable.
   * The game must remain playable on mobile and low-powered devices.

5. **Perpetual Game Loop**

   * Hitbox should be able to run indefinitely.
   * Economic incentives ensure the artwork continues to evolve.

6. **Open Source Friendly by Default**

   * Clean interfaces, modular packages, stable APIs.
   * Documentation and contributor ergonomics are product features.

---

## 3. Target User Personas

### 3.1 Casual Participants

* Want to poke the world, feel present, and influence the outcome
* May only make one or two moves
* Sensitive to UX friction and cost

### 3.2 Coordinators / Strategists

* Actively communicate off-platform (Discord, Farcaster, etc.)
* Coordinate voting strategies
* Compete for last-move payouts

### 3.3 Artists / World Builders

* Design custom visual themes
* Create worlds worth exploring
* Care about attribution and provenance

### 3.4 Open Source Contributors

* Want to improve the codebase, UX, docs, or add a theme
* Need clear boundaries, tests, and predictable release process

---

## 4. Core Gameplay Loop

1. A shared cursor exists in a fog-covered world.
2. Players submit paid inputs to influence cursor movement.
3. Inputs are aggregated into discrete **game ticks**.
4. One movement is executed per tick.
5. Each executed movement extends a global timer.
6. If the timer expires, the last mover receives the pot.
7. The game immediately continues (or rolls into a new season).

The loop has no terminal state, only phases of tension and release.

---

## 5. Economic Mechanics

### 5.1 Paid Moves

* Each directional input requires a small payment.
* Payment prevents bot spam and creates economic signal.

### 5.2 Shared Pot

* All move payments accumulate in a shared pot.
* The pot is escrowed onchain.

### 5.3 Timeout Mechanism

* Every successful move resets or extends a countdown timer.
* If no valid move occurs before timeout:

  * The **last mover** is eligible to claim the pot.

### 5.4 Payout Rules (Initial Defaults)

* 70–90% of pot → last mover
* Remainder → season treasury (future prizes, grants, hosting)

### 5.5 Dynamic Pricing (Optional, Phase 2)

* Fee may increase based on:

  * recent activity
  * proximity to timeout
  * per-address move frequency

---

## 6. Tick-Based Voting System

### 6.1 Rationale

Submitting direct onchain moves creates UX friction and gas competition. Instead, Hitbox uses **batched ticks**.

### 6.2 Tick Flow

* The game advances in fixed intervals (e.g. 2–5 seconds).
* During a tick window, players submit paid votes:

  * Up
  * Down
  * Left
  * Right
* At tick end:

  * votes are tallied
  * winning direction is selected
  * cursor moves once

### 6.3 Tie-Breaking

* Deterministic randomness
* Example input: hash of (tick number + previous finalized tick tx hash)

### 6.4 “No Votes” Ticks

MVP decision (recommended):

* If no votes occur in a tick window, the system does **not** advance the cursor and does **not** refresh the timeout.
* This allows the timeout to naturally progress to a claim state.

---

## 7. Architecture

### 7.1 System Components

1. **Web Client**

* Renders the world, fog-of-war, and shared cursor.
* Wallet connection + vote UX.
* Reads chain events as the source of truth for cursor movement.

2. **Smart Contracts (Settlement + Escrow)**

* Holds pot.
* Enforces fee rules.
* Tracks tick/timeout.
* Tracks last mover and allows claims.
* Stores season seed (Phase 2).

3. **Aggregator (Coordinator Service)**

* Watches Vote events for the current tick.
* Computes tick winner and submits `finalizeTick` onchain.
* Exposes minimal read API for clients (optional, but useful).

### 7.2 Source of Truth

* **Onchain events** are the canonical history for:

  * pot balance changes
  * finalized tick outcomes
  * last mover
  * claim outcomes
* Client state must be reconstructible from event history.

### 7.3 Determinism and Replayability

* Anyone should be able to replay the finalized tick stream and obtain the same cursor positions.
* Client should avoid applying speculative moves that are not finalized.

### 7.4 Reliability Expectations

* If the aggregator goes down:

  * votes can still be accepted onchain
  * finalization may pause until aggregator returns
  * timeout claim must remain safe (no incorrect last-mover assignment)

### 7.5 Upgrade Strategy

Preferred default for MVP:

* **Non-upgradeable contracts** for simplicity and trust.
* Deploy new contract for major versions (v2, v3), migrate front-end.

If upgradeability is required:

* Use **UUPS** or Transparent proxy with:

  * timelocked upgrades
  * multisig admin
  * public upgrade notes
  * explicit “break-glass” policy

---

## 8. Smart Contract Requirements

### 8.1 Contract Responsibilities

* Accept paid votes
* Maintain per-tick vote tallies
* Allow exactly one finalization per tick
* Update:

  * last mover
  * last move timestamp
  * pot
  * current tick
* Allow `claim` only when:

  * timeout elapsed
  * caller is last mover

### 8.2 Contract Interface (Conceptual)

* `vote(direction)` payable
* `finalizeTick(tick, winningDirection, metadata)`
* `claim()`
* View helpers: `getState()`, `getTick(tick)`

### 8.3 Events (Must Have)

* `VoteCast(voter, tick, direction, amount)`
* `TickFinalized(tick, winningDirection, lastMover, pot)`
* `Claimed(winner, amount)`

---

## 9. Security Best Practices (Required)

This project handles real funds. Even if the tone is playful and artistic, engineering standards must be senior-level.

### 9.1 Threat Model (Minimum)

Enumerate and design against:

* **Reentrancy** on payouts
* **DoS / griefing** (vote spam, finalize spam, claim spam)
* **Aggregator manipulation** (dishonest finalization)
* **Timestamp dependence** (miners/validators have limited influence)
* **Front-running and MEV** (sniping the final tick, racing finalize)
* **Economic attacks** (last-move sniping, fee exploitation)
* **Oracle-like assumptions** (aggregator is not a trusted oracle)

### 9.2 Core Contract Controls

* Reentrancy guard on value transfers
* Checks-effects-interactions pattern
* Use `call` for ETH transfers with proper handling
* Validate all inputs:

  * direction in allowed set
  * tick in expected range
  * tick not already finalized
* Avoid unbounded loops onchain
* Explicitly handle “no votes” cases
* Restrict finalize:

  * Either permissionless but proof-based, OR
  * Permissioned to an operator with clear governance and monitoring

### 9.3 Aggregator Trust Minimization (Strongly Recommended)

MVP can ship with an operator, but the design should aim to reduce trust:

Option A (Best long-term): **Permissionless finalization**

* Any party can finalize the tick by providing a verifiable tally.
* Requires onchain tallies or compact proofs.

Option B (MVP acceptable): **Operator finalization with guardrails**

* Operator address can call finalize.
* Guardrails:

  * finalization must match observed vote events (community can verify offchain)
  * provide metadata in finalization (e.g. counts per direction)
  * publish aggregator code + runbook so anyone can fork/replace it

### 9.4 Keys, Admin, and Ops Security

* If any privileged role exists (operator, treasury, upgrade admin):

  * use multisig
  * separate hot keys from admin keys
  * maintain a key rotation policy
  * document incident response

### 9.5 Auditing and Review Requirements

* Internal checklist before any mainnet deployment:

  * all critical functions unit-tested
  * fuzz tests / invariant tests for pot accounting, claim rules
  * static analysis (Slither)
  * formatting/linting enforced
  * peer review from someone who did not write the code

### 9.6 Responsible Disclosure

* Include `SECURITY.md` with:

  * how to report vulnerabilities
  * expected response times
  * whether bug bounties exist

---

## 10. Aggregator Requirements

### 10.1 Responsibilities

* Track current tick boundaries
* Index votes for current tick
* At tick end:

  * compute winner
  * submit finalize transaction
* Produce deterministic tie-break
* Provide observability:

  * logs
  * metrics
  * health endpoint

### 10.2 Correctness Requirements

* Winner selection must be deterministic and consistent across replicas
* If restarted, aggregator must recover current tick from chain state
* Must not double-finalize a tick

### 10.3 Resilience

* Retry strategy for tx submission
* Handle temporary RPC failures
* Handle chain reorgs on testnets (at minimum, basic confirmation depth)

### 10.4 Operator Transparency

* Publish aggregator source code
* Provide a “how to run your own aggregator” doc
* Prefer configuration over code changes

---

## 11. Data Access, Composability, and Public Interfaces

Composability is a core goal. Hitbox should be easy to build on top of: dashboards, leaderboards, analytics, bots, alternative clients, and art projects.

Design rule:

* **Onchain events are the canonical public interface.**
* Offchain services (indexers, APIs) should be optional accelerators, not walled gardens.

### 11.1 Onchain Event Interface (Primary)

Third parties must be able to build entirely from chain events.

Required events (see Section 8.3):

* `VoteCast(voter, tick, direction, amount)`
* `TickFinalized(tick, winningDirection, lastMover, pot)`
* `Claimed(winner, amount)`

Additional recommended events (Phase 2+):

* `SeasonStarted(seasonId, seed, startTick, themeId)`
* `SeasonEnded(seasonId, endTick, finalPot, artifactHash)`
* `TreasuryUpdated(newTreasury, splitBps)`

Contract view helpers (must remain stable):

* `getState()` → current tick, tickEndTimestamp, timeoutSeconds, lastMoveTimestamp, lastMover, pot
* `getTick(tick)` → finalized?, winningDirection, vote counts (if stored)
* `getSeason(seasonId)` → seed and metadata

### 11.2 Public Read API (Optional, Recommended)

Provide a simple HTTP API that makes it trivial to build dashboards without running an indexer.

Principles:

* **Read-only by default** (no privileged mutation endpoints).
* **Deterministic + cacheable** responses.
* **Versioned** (`/v1/...`) with a clear deprecation policy.
* **Derived from onchain events** (so anyone can reproduce results).

Minimum endpoints (MVP):

* `GET /v1/health` → service health, chain id, contract address, latest processed block
* `GET /v1/state` → mirror of `getState()` plus computed fields (timeRemaining, timeoutRemaining)
* `GET /v1/ticks/latest` → latest finalized tick data
* `GET /v1/ticks/{tick}` → finalized tick outcome, counts, lastMover, tx hash
* `GET /v1/votes?tick={tick}` → votes (optional pagination)

Analytics endpoints (Phase 2):

* `GET /v1/leaderboard/movers?window=24h|7d|season` → top last-movers, total spend, wins
* `GET /v1/leaderboard/voters?window=...` → top voters, vote counts, spend
* `GET /v1/map/progress` → exploration metrics (see 11.4)
* `GET /v1/season/{id}` → seed, start/end ticks, pot outcomes, theme metadata
* `GET /v1/artifacts/{seasonId}` → artifact hashes/URIs (fog mask, path, etc.)

Webhooks (nice-to-have):

* `POST /v1/webhooks` (register) / `DELETE /v1/webhooks/{id}`
* Events: `tick.finalized`, `pot.claimed`, `season.started`, `season.ended`

Rate limits:

* Public endpoints should have sane defaults and caching headers.

### 11.3 Data Model for Third-Party Builders

Define stable, documented JSON schemas.

Recommended objects:

* `State`: { chainId, contract, currentTick, tickEndsAt, timeoutEndsAt, pot, lastMover }
* `Tick`: { tick, finalized, winningDirection, counts, lastMover, txHash, blockNumber, timestamp }
* `Vote`: { voter, tick, direction, amount, txHash, timestamp }
* `Season`: { id, seed, startTick, endTick, themeId, artifactHash }

### 11.4 Map Progress and Exploration Metrics (Composable “Art Analytics”)

The world/fog-of-war is offchain, but composability still matters.

Goal: enable “completion%”, heatmaps, and exploration dashboards without forcing full onchain world state.

Approach (Phase 2 recommended):

* Define a **deterministic replay** mechanism:

  * world seed is onchain
  * tick finalizations are onchain
  * any indexer can replay cursor movement
* Define a canonical way to compute exploration coverage:

  * fog reveal radius rules are part of `docs/PROTOCOL.md`
  * coverage is computed by replaying cursor positions

Optional “snapshot primitive” (careful, but powerful):

* Periodically publish a content-hash of an exploration mask (e.g., per day or per season end)
* Store only the hash onchain (cheap), store the artifact offchain (IPFS/Arweave)
* Enables quick verification and sharing without onchain bloat

### 11.5 Composability Hooks (Future)

Design for extension points:

* Alternative clients (read-only spectators, mobile-first, Farcaster-native)
* Bots and agents (auto-post tick updates, statistics, memes)
* Community-run indexers and dashboards
* Experimental side-games ("quests" based on tick history)

Hard rule:

* Do not introduce private APIs that become the only source of truth.

---

## 12. Client Requirements

### 11.1 UX Panel (Minimum)

* Wallet connect
* Pot size
* Tick countdown
* Timeout countdown
* Vote buttons (Up/Down/Left/Right)
* Status feedback:

  * tx pending
  * tx confirmed
  * tick finalized
  * claim available

### 11.2 Event-Driven Sync

* Cursor moves only on `TickFinalized` events
* Client supports “cold start” by:

  * reading recent events
  * reconstructing current state

### 11.3 Safety and Clarity

* Always show the user the exact fee and chain
* Avoid confusing users during network mismatch
* Provide “read-only spectator” mode without wallet

---

## 12. Seasons and Provenance

### 12.1 Seasons

* Hitbox runs in continuous seasons.
* Each season has:

  * unique onchain seed
  * optional theme curation

### 12.2 Deterministic World Generation

* World layout is derived from the onchain seed.
* Anyone can regenerate the map independently.

### 12.3 End-of-Season Artifacts (Optional)

* explored fog-of-war mask
* cursor path
* contributor list
* mintable or archivable

---

## 13. Theme System

### 13.1 Theme Registry (Future)

* Artists register themes via metadata + content hash
* Client loads themes dynamically
* Attribution is preserved

### 13.2 Theme Constraints

* Themes must not alter gameplay logic
* Visual-only transformations

---

## 14. Open Source Engineering Best Practices

### 14.1 Repository Structure (Recommended)

Monorepo layout:

* `/apps/client` — web client
* `/apps/aggregator` — coordinator service
* `/packages/core` — shared types, tick math, deterministic utilities
* `/packages/themes` — theme interfaces + example themes
* `/contracts` — smart contracts (Foundry preferred)
* `/docs` — architecture notes, diagrams, specs

### 14.2 Documentation Baseline (Must Have)

* `README.md` (root): what it is + quickstart + demo links
* `docs/ARCHITECTURE.md`: components, data flow, failure modes
* `docs/PROTOCOL.md`: tick rules, tie-break, timeout, payout math
* `CONTRIBUTING.md`: how to run locally, how to submit PRs
* `SECURITY.md`: vulnerability reporting
* `LICENSE`: explicit license (MIT/Apache-2.0 recommended for permissive)
* `CODE_OF_CONDUCT.md`: community standard

### 14.3 GitHub Workflow

* Branching:

  * `main` is always deployable
  * feature branches per change
* Pull Requests:

  * required PR template
  * required reviews for contracts and release changes
  * require CI passing before merge
* Issues:

  * issue templates (bug / feature / security)
  * labels for triage (good first issue, contracts, client, aggregator, docs)

### 14.4 Releases and Versioning

* Use **Semantic Versioning**:

  * MAJOR: breaking protocol/contract changes
  * MINOR: new features, backward-compatible
  * PATCH: fixes
* Maintain `CHANGELOG.md` (Keep a Changelog format recommended)
* Tag releases: `vX.Y.Z`
* For contracts:

  * store deployed addresses per network in `contracts/deployments/*.json`
  * document verification links and constructor args

### 14.5 CI / Quality Gates

Minimum CI jobs:

* lint/format (client + aggregator)
* unit tests (client + aggregator)
* contract tests (Foundry)
* static analysis (Slither) for contracts
* dependency audit (npm audit / osv-scanner)

### 14.6 Code Style and Tooling

* Enforce formatting:

  * Prettier for TS/JS/MD
  * ESLint for TS/JS
  * Forge fmt for Solidity
* Use type safety:

  * shared types in `/packages/core`
* Prefer small, composable modules
* Avoid hidden magic:

  * explicit configs
  * explicit env vars with `.env.example`

### 14.7 Testing Discipline

* Contracts:

  * unit tests for all critical paths
  * fuzz/invariant tests for pot accounting, tick finalization, claims
* Aggregator:

  * deterministic unit tests for tie-break logic
  * integration tests against local chain
* Client:

  * minimal e2e smoke tests

### 14.8 Security in Open Source

* Never commit secrets
* Use GitHub secret scanning + dependabot
* Provide a public incident process in docs
* Prefer reproducible builds and pinned dependencies

---

## 15. Non-Goals (Important)

* No PvP combat
* No NFTs required to play
* No complex progression trees
* No high-frequency onchain writes per frame

---

## 16. Success Metrics

* Sustained daily participation
* Average votes per hour
* Season longevity
* Number of community-created themes
* Low bot activity
* No fund-loss incidents

---

## 17. Open Questions

* Ideal timeout duration
* Optimal tick length
* Best L2 for lowest friction
* How seasons transition automatically
* Whether finalize should be operator-only in MVP

---

## 18. Long-Term Extensions

* Multi-cursor modes
* Multiple concurrent rooms
* DAO-governed theme curation
* Cross-season narrative arcs
* Permissionless finalization proofs

---

## 19. Summary

Hitbox is not a game to be beaten. It is a space to be inhabited.

By anchoring incentives onchain while keeping play human and accessible, Hitbox becomes a perpetual, collective artwork driven by coordination, curiosity, and tension.
