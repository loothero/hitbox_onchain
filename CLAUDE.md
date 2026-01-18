# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hitbox Onchain** is a collaborative, explorable artwork and game inspired by Twitch Plays Pokémon. A single shared cursor navigates a procedurally generated fog-of-war world, controlled by paid directional votes that are batched into discrete ticks.

**Key insight:** This is not a game to be beaten, but a space to be inhabited. The artwork is the world itself, revealed through collective coordination.

**Live docs:** See `hitbox_onchain_prd.md` for full product requirements and `PROTOCOL.md` for deterministic protocol specification.

## Development Commands

### Prerequisites
- Node.js 18+
- [Foundry](https://getfoundry.sh) installed globally

### Setup & Build
```bash
# Install all dependencies (uses npm workspaces)
npm install

# Build core package (required before aggregator)
npm run build -w @hitbox/core

# Build aggregator
npm run build:aggregator

# Build contracts
cd contracts && forge build
```

### Testing
```bash
# Run contract tests
cd contracts && forge test

# Run specific contract test
cd contracts && forge test --match-test testVote

# Run with verbosity
cd contracts && forge test -vvv

# Run with gas reporting
cd contracts && forge test --gas-report
```

### Development Workflow
```bash
# Watch mode for core package
npm run dev -w @hitbox/core

# Watch mode for aggregator
npm run dev:aggregator

# Format Solidity code
cd contracts && forge fmt
```

### Contract Deployment
```bash
# Deploy to testnet (requires env vars)
cd contracts && forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

## Architecture: Three-Component System

### 1. Smart Contracts (`/contracts`)
**Tech:** Solidity 0.8.24, Foundry framework

**Core Contract:** `HitboxPot.sol` - Escrow and settlement

**Responsibilities:**
- Accept paid votes (payable `vote(direction)`)
- Track per-tick vote tallies
- Enforce operator-only `finalizeTick()`
- Maintain timeout clock and last mover tracking
- Allow `claim()` only when timeout elapsed and caller is last mover

**Key Features:**
- Reentrancy guard on all value transfers
- Immutable constants: `tickDurationSeconds`, `timeoutSeconds`, `minFee`
- Events: `VoteCast`, `TickFinalized`, `Claimed`

**Testing Philosophy:**
- Unit tests for all critical paths
- Fuzz/invariant tests for pot accounting
- Security: All funds must be accounted for at all times

**Critical Files:**
- `src/HitboxPot.sol` - Main contract
- `test/HitboxPot.t.sol` - Test suite
- `script/Deploy.s.sol` - Deployment script

### 2. Aggregator Service (`/aggregator`)
**Tech:** TypeScript, Node.js, Express, Viem

**Responsibilities:**
- Watch blockchain for `VoteCast` events
- Track vote counts per tick
- At tick boundary, compute winning direction
- Submit `finalizeTick()` transaction onchain
- Expose read API for clients

**Key Files:**
- `src/index.ts` - Express server, health endpoints
- `src/tickLoop.ts` - Core tick resolution loop
- `src/chainClient.ts` - Viem blockchain interaction

**Critical Design Rule:** Aggregator must be **stateless** - it recovers full state from onchain events on restart. No vote should be lost if aggregator crashes.

**Deterministic Tie-Break:** Uses `keccak256(tickNumber, previousTxHash)` to resolve ties (see `@hitbox/core/tieBreak.ts`)

### 3. Core Package (`/packages/core`)
**Tech:** TypeScript library

**Purpose:** Shared types, tie-break logic, protocol constants

**Exports:**
- `Direction` enum (Up=0, Down=1, Left=2, Right=3)
- `GameState`, `Vote`, `TickOutcome` interfaces
- `resolveTickWinner()` - Deterministic winner selection
- `PROTOCOL` constants (tick duration, timeout, min fee)

**Usage:** Import in both aggregator and client code to ensure consistent behavior

## Protocol Fundamentals

### Tick System
- Game advances in **fixed intervals** (default: 3 seconds)
- During tick window, players submit paid votes
- At tick end, aggregator tallies votes and finalizes winning direction onchain
- **No-vote ticks:** If zero votes, tick is NOT finalized, cursor does NOT move, timeout is NOT refreshed

### Direction Encoding
```solidity
Up = 0, Down = 1, Left = 2, Right = 3
```
This encoding is **canonical** across contract, aggregator, and client.

### Tie-Breaking (CRITICAL: Must be deterministic)
```typescript
// Per PROTOCOL.md Section 5.3
entropy = keccak256(abi.encodePacked(tickNumber, previousTxHash))
winnerIndex = entropy % tiedDirections.length
```

All implementations must use this exact formula. See `packages/core/src/tieBreak.ts`.

### Timeout & Claims
- Every finalized tick with votes extends timeout clock
- If `currentTime > lastMoveTimestamp + timeoutSeconds`, last mover can claim pot
- Claim transfers entire pot, resets to zero, game continues

### Event Sourcing Model
**Onchain events are the single source of truth:**
- `VoteCast(voter, tick, direction, amount)` - All votes
- `TickFinalized(tick, winningDirection, lastMover, pot)` - Canonical movement history
- `Claimed(winner, amount)` - Pot payouts

Any client/indexer can reconstruct full game state from event history.

## Key Design Constraints

### Determinism & Replayability
**Hard requirement:** Anyone must be able to replay the `TickFinalized` event stream and arrive at the same cursor positions.

This means:
- Tie-break logic must be deterministic
- World generation must be deterministic from seed (future)
- No hidden state offchain

### Trust Minimization
**MVP uses operator-controlled finalization** for simplicity, but design goals:
- Publish aggregator source code (it's in this repo)
- Anyone can verify vote tallies against onchain events
- Anyone can run their own aggregator
- Long-term: Move to permissionless finalization with proofs

### Security Posture
This project handles **real funds**. Requirements:
- Reentrancy guard on all transfers
- Checks-effects-interactions pattern
- Validate all inputs (direction in [0,3], tick not finalized, etc.)
- No unbounded loops onchain
- Static analysis with Slither before deployment
- Peer review on all contract changes

## Environment Variables

### Aggregator (`.env` example)
```bash
RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=0x...
OPERATOR_PRIVATE_KEY=0x...
PORT=3001
```

### Contract Deployment
```bash
RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...  # For verification
```

## API Endpoints (Aggregator)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health, chain ID, latest block |
| `/state` | GET | Current game state (tick, pot, timeout) |
| `/votes/current` | GET | Vote counts for current tick |

**Design rule:** All API responses must be **derivable from onchain data**. No private walled-garden APIs.

## Monorepo Structure (npm workspaces)

```
hitbox_onchain/
├── contracts/           # Foundry project
│   ├── src/            # Solidity contracts
│   ├── test/           # Forge tests
│   ├── script/         # Deploy scripts
│   └── foundry.toml    # Foundry config
├── aggregator/          # Node.js service
│   └── src/            # TypeScript source
├── packages/
│   └── core/           # Shared types & utilities
│       └── src/        # TypeScript library
└── docs/               # Specs and diagrams
```

**Build order matters:** Core package must build before aggregator (it's a dependency).

## Common Workflows

### Adding a New Direction (Hypothetical Example)
If you needed to add a 5th direction:
1. Update `NUM_DIRECTIONS` in `HitboxPot.sol`
2. Add new direction to `Direction` enum in `packages/core/src/types.ts`
3. Update tie-break logic (already handles dynamic count)
4. Update tests in `HitboxPot.t.sol`
5. Update client UI (not in this repo)

### Changing Tick Duration
**Warning:** This requires contract redeployment.
1. Modify constructor args in `Deploy.s.sol`
2. Redeploy contract
3. Update aggregator `CONTRACT_ADDRESS` env var
4. Update `PROTOCOL.TICK_DURATION_SECONDS` in `core/src/types.ts` to match

### Debugging Aggregator Issues
```bash
# Check what the aggregator sees
npm run dev:aggregator

# Check contract state directly
cast call $CONTRACT_ADDRESS "currentTick()(uint256)" --rpc-url $RPC_URL

# Check recent events
cast logs --address $CONTRACT_ADDRESS --from-block 12345 --rpc-url $RPC_URL
```

## Testing Strategy

### Contracts
- **Unit tests:** All public functions
- **Fuzz tests:** Pot accounting, no double-finalize, claim rules
- **Invariants:** Pot balance == sum of all votes minus claims

### Aggregator
- **Deterministic tests:** Tie-break logic matches PROTOCOL.md
- **Integration tests:** Against local Anvil chain
- **Recovery tests:** Restart aggregator mid-tick, verify state recovery

### Core Package
- Pure functions, easy to unit test
- Focus on tie-break correctness

## Critical Code Patterns

### Reentrancy Protection (Always)
```solidity
function claim() external nonReentrant {
    // checks
    require(msg.sender == lastMover, NotLastMover());
    require(block.timestamp > lastMoveTimestamp + timeoutSeconds, TimeoutNotReached());
    require(pot > 0, NoPotToClaim());

    // effects
    uint256 amount = pot;
    pot = 0;

    // interactions
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, TransferFailed());
}
```

### State Recovery (Aggregator)
```typescript
// On startup, aggregator must:
// 1. Read currentTick from contract
// 2. Fetch all VoteCast events for currentTick
// 3. Rebuild vote counts
// 4. Continue normal operation
```

## Documentation Standards

- **Public functions:** Always include NatSpec comments
- **Protocol changes:** Update PROTOCOL.md first, then implement
- **Breaking changes:** Increment MAJOR version, document migration path
- **Deployment:** Record contract addresses in `contracts/deployments/network.json`

## Non-Goals (Important)

- **No PvP combat** - This is not a battle royale
- **No NFTs required to play** - Accessibility first
- **No high-frequency onchain writes** - Ticks batch inputs
- **No terminal win state** - Game runs perpetually

## Glossary

- **Tick:** Fixed time window (e.g. 3 seconds) for vote collection
- **Finalization:** Aggregator computing winner and submitting onchain
- **Pot:** Accumulated ETH from all votes
- **Last Mover:** Address eligible to claim pot after timeout
- **Operator:** Privileged address allowed to finalize ticks (MVP design)
- **Fog-of-war:** Visibility mask (offchain, deterministic from cursor path)

## Getting Help

- `README.md` - Quickstart and overview
- `hitbox_onchain_prd.md` - Full product requirements
- `PROTOCOL.md` - Formal protocol specification
- `CONTRIBUTING.md` - How to contribute
- `SECURITY.md` - Vulnerability reporting

## Philosophy

Hitbox is an exploration-first, coordination-driven artwork. The onchain component exists to anchor economic incentives and preserve history, not to implement complex gameplay. Keep the chain layer **simple, robust, and deterministic**. Keep the art layer **rich, modular, and offchain**.
