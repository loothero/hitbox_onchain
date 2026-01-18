# Hitbox Protocol Specification (PROTOCOL.md)

Version: v0.1 (Draft)
Status: Informational / Implementable

This document formally specifies the Hitbox protocol. It defines the deterministic rules that govern ticks, voting, movement, timeouts, replayability, and derived analytics.

The goal of this document is:

* to allow **independent implementations** (clients, aggregators, indexers)
* to ensure **deterministic replay** from onchain data
* to preserve **composability and verifiability**

---

## 1. Terminology

* **Tick**: A discrete time window during which votes are collected and exactly one movement may be finalized.
* **Vote**: A paid directional input submitted by a participant during a tick.
* **Finalization**: The act of selecting a winning direction for a tick and committing it onchain.
* **Cursor**: The single shared player entity moving through the world.
* **World**: A procedurally generated grid derived from a deterministic seed.
* **Fog-of-war**: Visibility mask revealing tiles around the cursor.
* **Season**: A continuous run of ticks associated with a single world seed.

---

## 2. Determinism Guarantees

The following inputs are **authoritative and sufficient** to replay the game state:

1. Season seed (onchain)
2. Ordered stream of `TickFinalized` events
3. Protocol constants (tick duration, movement rules, fog rules)

Given the above, any conforming implementation MUST be able to:

* reconstruct cursor position per tick
* reconstruct explored tiles
* compute derived metrics (coverage %, heatmaps)

No offchain state is considered canonical.

---

## 3. Time Model

### 3.1 Tick Duration

* Tick duration is a fixed constant: `TICK_DURATION_SECONDS`.
* Ticks are sequential and monotonically increasing.

Each tick `n` has:

* `tickStartTime = genesisTime + (n * TICK_DURATION_SECONDS)`
* `tickEndTime = tickStartTime + TICK_DURATION_SECONDS`

Implementations MAY derive tick boundaries from onchain timestamps but MUST respect the ordering enforced by finalized ticks.

### 3.2 Tick Eligibility

A vote is eligible for tick `n` if:

* `block.timestamp < tickEndTime`
* tick `n` has not been finalized

Votes outside the window MUST be rejected.

---

## 4. Voting Model

### 4.1 Directions

Valid directions are encoded as:

* `0` → Up
* `1` → Down
* `2` → Left
* `3` → Right

Any other value is invalid.

### 4.2 Vote Semantics

* Each vote is associated with exactly one tick.
* Each vote carries a payment (`msg.value`).
* Multiple votes per address per tick are permitted in MVP unless restricted by policy.

Vote events MUST emit:

* voter address
* tick number
* direction
* amount paid

---

## 5. Tick Finalization

### 5.1 Finalization Conditions

A tick `n` may be finalized if:

* current time >= `tickEndTime`
* tick `n` has not already been finalized

### 5.2 Vote Tallying

For tick `n`:

* Count votes per direction: `counts[0..3]`
* Let `max = max(counts)`

Cases:

1. `max == 0` (no votes)

   * Tick is NOT finalized
   * Cursor does not move
   * Timeout is NOT refreshed

2. `max > 0`

   * Tick is finalized
   * Winning direction is selected (see tie-break)

### 5.3 Tie-Breaking Rule

If multiple directions share the same `max` count:

```
tied = [directions where counts[d] == max]

entropy = keccak256(
  abi.encode(
    tickNumber,
    previousFinalizedTickHash
  )
)

winnerIndex = entropy % tied.length
winningDirection = tied[winnerIndex]
```

This rule MUST be used by all conforming implementations.

---

## 6. Cursor Movement Rules

### 6.1 Movement Vector

Each finalized tick applies exactly one movement:

* Up    → (x, y-1)
* Down  → (x, y+1)
* Left  → (x-1, y)
* Right → (x+1, y)

### 6.2 Collision Handling

If the target tile is blocked (wall, impassable terrain):

* Cursor position does NOT change
* Tick is still considered finalized
* Timeout IS refreshed

This ensures determinism and avoids ambiguous behavior.

---

## 7. Timeout and Claim Logic

### 7.1 Timeout Refresh

* Timeout timestamp is updated ONLY on finalized ticks with `max > 0` votes.
* No-vote ticks do not refresh timeout.

### 7.2 Claim Eligibility

A claim is valid if:

* `currentTime > lastMoveTimestamp + TIMEOUT_SECONDS`
* caller == `lastMover`

Upon successful claim:

* pot is transferred
* pot resets to zero
* game continues with next tick

---

## 8. World Generation

### 8.1 Seed

* Each season has a single immutable seed stored onchain.
* Seed MUST be used as the sole entropy source for world generation.

### 8.2 Grid Definition

* World is a finite 2D grid (e.g. 128x128).
* Coordinate system:

  * origin and orientation MUST be documented and consistent.

### 8.3 Tile Semantics

Tiles MAY include:

* empty
* wall
* hazard
* collectible

Tile semantics affect rendering only in MVP.

---

## 9. Fog-of-War Rules

### 9.1 Visibility Radius

* Cursor reveals tiles within radius `R`.
* Radius is a protocol constant.

### 9.2 Reveal Semantics

* Fog reveal is additive and permanent per season.
* Once revealed, a tile remains revealed.

### 9.3 Replay Requirement

Given cursor positions per tick, a client MUST be able to reconstruct the full fog mask.

---

## 10. Replay Algorithm (Reference)

Given:

* seed
* ordered list of finalized ticks

Algorithm:

1. Generate world from seed
2. Initialize cursor at spawn point
3. Initialize empty fog mask
4. For each finalized tick:

   * apply movement
   * reveal fog around new cursor position

Output:

* cursor path
* fog coverage

---

## 11. Derived Metrics (Non-Canonical)

The following metrics are **derived**, not protocol state:

* Map completion percentage
* Heatmaps of movement
* Most-visited tiles
* Player contribution statistics

All derived metrics MUST be computable from replay.

---

## 12. Client Conformance Requirements

A conforming client:

* MUST treat onchain events as authoritative
* MUST follow movement, tie-break, and fog rules exactly
* MUST support cold start replay
* MAY implement speculative UX, but MUST reconcile with finalized ticks

---

## 13. Aggregator Conformance Requirements

A conforming aggregator:

* MUST follow tick timing rules
* MUST use the specified tie-break algorithm
* MUST not finalize no-vote ticks
* MUST recover state solely from chain data on restart

---

## 14. Versioning and Compatibility

* This protocol uses semantic versioning.
* Breaking changes increment MAJOR version.
* Protocol version MUST be referenced in:

  * client builds
  * aggregator builds
  * documentation

---

## 15. Design Philosophy

This protocol intentionally keeps the **art and experience offchain**, while anchoring **coordination, economics, and history onchain**.

The protocol is not a game engine. It is a **coordination substrate** for collective exploration.
