# Hitbox Onchain: State Machine & Architecture

**Created:** 2026-01-16
**Purpose:** Visual documentation of system architecture, state transitions, and data flows

---

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Game State Machine](#game-state-machine)
3. [Tick Lifecycle](#tick-lifecycle)
4. [Vote Flow](#vote-flow)
5. [Claim Flow](#claim-flow)
6. [Data Flow Between Layers](#data-flow-between-layers)
7. [Event Sourcing Model](#event-sourcing-model)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HITBOX ONCHAIN SYSTEM                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: CLIENT (React + Wagmi + Viem)                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  App.tsx     │  │  P5Canvas    │  │  Hooks       │                  │
│  │  - Wallet    │  │  - Visual    │  │  - useVote   │                  │
│  │  - Vote UI   │  │  - Fog-of-   │  │  - useClaim  │                  │
│  │  - Pot       │  │    War       │  │  - useGame   │                  │
│  │  - Timers    │  │  - Themes    │  │    State     │                  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘                  │
│         │                                     │                          │
│         └─────────────────┬───────────────────┘                          │
└───────────────────────────┼──────────────────────────────────────────────┘
                            │ HTTP / JSON-RPC
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: AGGREGATOR (Node.js + Express + Viem)                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  REST API (Port 3001)                                            │  │
│  │  • GET /health      → Service status, chain info                │  │
│  │  • GET /state       → Current tick, pot, timeouts               │  │
│  │  • GET /votes/current → Vote counts for active tick             │  │
│  └────────────────────────┬─────────────────────────────────────────┘  │
│                            │                                             │
│  ┌─────────────────────────▼────────────────────────────────────────┐  │
│  │  Tick Loop (500ms polling)                                       │  │
│  │  1. Check if tick ended (currentTime > tickEndTimestamp)        │  │
│  │  2. Fetch all VoteCast events for tick                          │  │
│  │  3. Tally votes per direction: [up, down, left, right]          │  │
│  │  4. Resolve winner (or tie-break if needed)                     │  │
│  │  5. Submit finalizeTick(tick, winningDirection) transaction     │  │
│  │  6. Mark tick as processed                                      │  │
│  └────────────────────────┬─────────────────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────────────────┘
                             │ Viem (JSON-RPC)
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: CORE PACKAGE (@hitbox/core)                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Shared Logic (TypeScript)                                       │  │
│  │  • Direction enum: { Up: 0, Down: 1, Left: 2, Right: 3 }        │  │
│  │  • GameState interface                                           │  │
│  │  • resolveTickWinner(votes[]) → direction                        │  │
│  │  • resolveTieBreak(tick, prevTxHash, tiedDirections[])          │  │
│  │  • PROTOCOL constants (tick duration, timeout, min fee)         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                             │ Imported by Aggregator & Client
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: SMART CONTRACT (Solidity 0.8.24 on EVM)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  HitboxPot.sol (334 lines)                                       │  │
│  │                                                                   │  │
│  │  STATE VARIABLES:                                                │  │
│  │  • uint256 currentTick              ← Active tick number         │  │
│  │  • uint256 tickEndTimestamp         ← When current tick ends     │  │
│  │  • uint256 pot                      ← Total accumulated ETH      │  │
│  │  • uint256 lastMoveTimestamp        ← Last finalization time     │  │
│  │  • address lastMover                ← Eligible to claim pot      │  │
│  │  • mapping(tick → direction → count) votes ← Vote tallies        │  │
│  │  • mapping(tick → bool) isTickFinalized ← Finalization status    │  │
│  │                                                                   │  │
│  │  FUNCTIONS:                                                       │  │
│  │  • vote(direction) payable          ← Players submit votes       │  │
│  │  • finalizeTick(tick, direction)    ← Operator commits result    │  │
│  │  • claim() nonReentrant             ← Last mover withdraws pot   │  │
│  │  • getState() view                  ← Read all state             │  │
│  │  • getTickVotes(tick) view          ← Read vote counts           │  │
│  │                                                                   │  │
│  │  EVENTS:                                                          │  │
│  │  • VoteCast(voter, tick, direction, amount)                      │  │
│  │  • TickFinalized(tick, winningDirection, lastMover, pot)         │  │
│  │  • Claimed(winner, amount)                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Deployed At: 0x5FbDB2315678afecb367f032d93F642f64180aa3 (Anvil)       │
│  Operator: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266                  │
└─────────────────────────────────────────────────────────────────────────┘
                             │ Blockchain Events
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: BLOCKCHAIN (Anvil / Base Sepolia)                             │
│  • Event logs (permanent, immutable)                                    │
│  • Transaction history (canonical source of truth)                      │
│  • State storage (contract variables)                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Game State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HITBOX GAME STATE MACHINE                           │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   GENESIS STATE      │
                    │                      │
                    │  currentTick = 0     │
                    │  pot = 0             │
                    │  lastMover = 0x0     │
                    └──────────┬───────────┘
                               │
                               │ Contract Deployed
                               ▼
        ┌──────────────────────────────────────────────┐
        │          ACTIVE TICK (Accepting Votes)       │
        │                                              │
        │  tickEndTimestamp = now + 3 seconds          │
        │  votes[currentTick][direction] accumulating  │
        └──────────┬─────────────────────┬─────────────┘
                   │                     │
           vote()  │                     │  Time passes
          payable  │                     │  (3 seconds)
                   │                     │
                   ▼                     ▼
        ┌──────────────────┐  ┌──────────────────────┐
        │  Vote Recorded   │  │   Tick Ended         │
        │                  │  │  (Pending Finalize)  │
        │  pot += msg.value│  │                      │
        │  votes[tick][dir]│  │  Aggregator detects  │
        │      += 1        │  │  tickEndTimestamp    │
        │                  │  │  has passed          │
        │  emit VoteCast   │  │                      │
        └──────────────────┘  └──────────┬───────────┘
                                         │
                                         │ Aggregator tallies votes
                                         │ resolves winner
                                         │ (or tie-break)
                                         ▼
                          ┌──────────────────────────┐
                          │  finalizeTick() Called   │
                          │                          │
                          │  Validates:              │
                          │  • Tick not finalized    │
                          │  • Has votes             │
                          │  • Caller is operator    │
                          │                          │
                          │  Updates:                │
                          │  • currentTick++         │
                          │  • lastMoveTimestamp     │
                          │  • lastMover = operator  │
                          │                          │
                          │  emit TickFinalized      │
                          └──────────┬───────────────┘
                                     │
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           │ pot > 0                 │                         │ pot = 0
           │ game continues          │                         │ game continues
           ▼                         ▼                         ▼
    ┌─────────────────┐      ┌──────────────┐        ┌─────────────────┐
    │  ACTIVE POT     │      │  NEW TICK    │        │   EMPTY POT     │
    │  (Claimable)    │      │  STARTED     │        │   (No Claims)   │
    │                 │      │              │        │                 │
    │  Timeout clock  │      │  Return to   │        │   Continue      │
    │  running:       │      │  ACTIVE TICK │        │   to NEW TICK   │
    │  60 minutes     │      │  state       │        │                 │
    └────────┬────────┘      └──────────────┘        └─────────────────┘
             │
             │ Time passes
             │ (60 minutes)
             │ since lastMoveTimestamp
             ▼
    ┌──────────────────────┐
    │  TIMEOUT REACHED     │
    │  (Claimable)         │
    │                      │
    │  isClaimable() = true│
    │  for lastMover       │
    └──────────┬───────────┘
               │
               │ lastMover calls claim()
               ▼
    ┌──────────────────────────┐
    │  claim() Executed        │
    │                          │
    │  Validates:              │
    │  • caller == lastMover   │
    │  • timeout elapsed       │
    │  • pot > 0               │
    │                          │
    │  Transfers:              │
    │  • pot → lastMover       │
    │  • pot = 0               │
    │  • lastMover = 0x0       │
    │                          │
    │  emit Claimed            │
    └──────────┬───────────────┘
               │
               │ Game continues
               ▼
       ┌────────────────┐
       │  RESET STATE   │
       │                │
       │  pot = 0       │
       │  Continue with │
       │  next ticks    │
       └────────────────┘
```

---

## Tick Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TICK N LIFECYCLE                                 │
└─────────────────────────────────────────────────────────────────────────┘

PHASE 1: VOTING WINDOW (3 seconds)
═══════════════════════════════════════════════════════════════════════════

  t=0s                                                           t=3s
   │                                                              │
   ├──────────────────── TICK N ACTIVE ───────────────────────►  │
   │                                                              │
   │  Players submit votes:                                      │
   │  • vote(0)  → Up                                            │
   │  • vote(1)  → Down                                          │
   │  • vote(2)  → Left                                          │
   │  • vote(3)  → Right                                         │
   │                                                              │
   │  Each vote:                                                 │
   │  1. Requires msg.value >= 0.001 ETH                         │
   │  2. Validates direction ∈ [0,3]                             │
   │  3. Increments votes[N][direction]                          │
   │  4. Adds to pot                                             │
   │  5. Emits VoteCast event                                    │
   │                                                              │
   └──────────────────────────────────────────────────────────► t=3s
                                                                  │
                                                         TICK N ENDS


PHASE 2: AGGREGATOR PROCESSING (~500ms after tick ends)
═══════════════════════════════════════════════════════════════════════════

  Aggregator Tick Loop:
  ┌─────────────────────────────────────────────────────────────────────┐
  │  1. Poll blockchain (every 500ms)                                   │
  │     ├─ Read currentTick from contract                               │
  │     ├─ Read tickEndTimestamp                                        │
  │     └─ Check: now > tickEndTimestamp?                               │
  │                                                                      │
  │  2. If tick ended:                                                  │
  │     ├─ Fetch VoteCast events for tick N                             │
  │     │   Query: getContractEvents({                                  │
  │     │     event: 'VoteCast',                                        │
  │     │     args: { tick: N }                                         │
  │     │   })                                                           │
  │     │                                                                │
  │     ├─ Tally votes:                                                 │
  │     │   tallies = { up: 0, down: 0, left: 0, right: 0 }            │
  │     │   for each VoteCast event:                                    │
  │     │       tallies[direction]++                                    │
  │     │                                                                │
  │     ├─ Determine winner:                                            │
  │     │   max = Math.max(...Object.values(tallies))                  │
  │     │   winners = directions.filter(d => tallies[d] === max)       │
  │     │                                                                │
  │     │   if winners.length == 1:                                     │
  │     │       winningDirection = winners[0]                           │
  │     │   else:  // TIE-BREAK                                         │
  │     │       entropy = keccak256(tickN, previousTxHash)              │
  │     │       index = entropy % winners.length                        │
  │     │       winningDirection = winners[index]                       │
  │     │                                                                │
  │     └─ Submit transaction:                                          │
  │         finalizeTick(N, winningDirection)                           │
  │         signed by operator private key                              │
  └─────────────────────────────────────────────────────────────────────┘


PHASE 3: ONCHAIN FINALIZATION
═══════════════════════════════════════════════════════════════════════════

  Contract receives finalizeTick(N, winningDirection):
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Validations:                                                        │
  │  ├─ require(msg.sender == operator, "NotOperator")                  │
  │  ├─ require(!isTickFinalized[N], "AlreadyFinalized")                │
  │  └─ require(hasVotes(N), "NoVotes")                                 │
  │                                                                      │
  │  State Updates:                                                     │
  │  ├─ isTickFinalized[N] = true                                       │
  │  ├─ currentTick = N + 1                                             │
  │  ├─ tickEndTimestamp = now + tickDurationSeconds                    │
  │  ├─ lastMoveTimestamp = now                                         │
  │  └─ lastMover = msg.sender (operator)                               │
  │                                                                      │
  │  Event Emission:                                                    │
  │  emit TickFinalized(                                                │
  │      tick: N,                                                       │
  │      winningDirection: winningDirection,                            │
  │      lastMover: operator,                                           │
  │      pot: currentPotBalance                                         │
  │  )                                                                   │
  └─────────────────────────────────────────────────────────────────────┘


PHASE 4: CLIENT UPDATES
═══════════════════════════════════════════════════════════════════════════

  Client reacts to TickFinalized event:
  ┌─────────────────────────────────────────────────────────────────────┐
  │  useWatchContractEvent({                                            │
  │    event: 'TickFinalized',                                          │
  │    onLogs: (logs) => {                                              │
  │      // Refetch game state                                          │
  │      queryClient.invalidateQueries(['gameState'])                   │
  │                                                                      │
  │      // Update cursor position                                      │
  │      const { winningDirection } = logs[0].args                      │
  │      updateCursorPosition(winningDirection)                         │
  │                                                                      │
  │      // Update visual layer                                         │
  │      p5Canvas.postMessage({                                         │
  │        type: 'UPDATE_POSITION',                                     │
  │        x: newX,                                                     │
  │        y: newY                                                      │
  │      })                                                              │
  │    }                                                                 │
  │  })                                                                  │
  └─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
                           CYCLE REPEATS FOR TICK N+1
═══════════════════════════════════════════════════════════════════════════
```

---

## Vote Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PLAYER VOTE FLOW (vote())                           │
└─────────────────────────────────────────────────────────────────────────┘

   USER INITIATES VOTE
         │
         │  Clicks "UP" button in UI
         │
         ▼
   ┌──────────────────┐
   │  Client (React)  │
   │                  │
   │  const { write } │
   │    = useVote()   │
   │                  │
   │  write({         │
   │    args: [0],    │  // Direction.Up
   │    value:        │
   │     parseEther   │
   │     ('0.001')    │
   │  })              │
   └────────┬─────────┘
            │
            │ Triggers MetaMask popup
            ▼
   ┌──────────────────┐
   │   MetaMask       │
   │   (Wallet)       │
   │                  │
   │  User reviews:   │
   │  • To: Contract  │
   │  • Value: 0.001  │
   │  • Data: vote(0) │
   │  • Gas estimate  │
   │                  │
   │  [Confirm] [Reject]
   └────────┬─────────┘
            │
            │ User confirms
            │ Wallet signs transaction
            ▼
   ┌──────────────────┐
   │  Transaction     │
   │  Mempool         │
   │                  │
   │  Pending...      │
   └────────┬─────────┘
            │
            │ Miner includes in block
            ▼
   ┌─────────────────────────────────────────┐
   │  HitboxPot.vote(0) payable              │
   │                                         │
   │  VALIDATION:                            │
   │  ├─ require(direction <= 3)             │
   │  │   ↓ Pass                             │
   │  └─ require(msg.value >= minFee)        │
   │      ↓ Pass (0.001 ETH >= 0.001 ETH)    │
   │                                         │
   │  STATE CHANGES:                         │
   │  ├─ votes[currentTick][0]++             │
   │  │   (Up votes += 1)                    │
   │  └─ pot += 0.001 ETH                    │
   │                                         │
   │  EVENT EMISSION:                        │
   │  emit VoteCast(                         │
   │      voter: msg.sender,                 │
   │      tick: currentTick,                 │
   │      direction: 0,                      │
   │      amount: 0.001 ETH                  │
   │  )                                      │
   └────────┬────────────────────────────────┘
            │
            │ Transaction confirmed
            │ Event emitted
            ▼
   ┌──────────────────────────────┐
   │  Aggregator Event Listener   │
   │                              │
   │  Receives VoteCast event:    │
   │  • Tick: N                   │
   │  • Direction: 0 (Up)         │
   │  • Amount: 0.001 ETH         │
   │                              │
   │  Updates internal tally:     │
   │  voteCounts[N].up++          │
   └──────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────┐
   │  Client Event Listener       │
   │                              │
   │  useWatchContractEvent({     │
   │    event: 'VoteCast',        │
   │    onLogs: () => {           │
   │      refetchGameState()      │
   │    }                         │
   │  })                          │
   │                              │
   │  UI Updates:                 │
   │  • Pot: 0.004 → 0.005 ETH    │
   │  • Votes[Up]: 2 → 3          │
   │  • Confirmation toast        │
   └──────────────────────────────┘
```

---

## Claim Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TIMEOUT & CLAIM FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

   PRECONDITIONS:
   • Tick N was finalized 60+ minutes ago
   • No subsequent ticks finalized since then
   • lastMover = 0xAlice (from tick N finalization)
   • pot > 0

        TIME: lastMoveTimestamp + 3600 seconds
              │
              │  Timeout reached
              │
              ▼
   ┌────────────────────────────────────────┐
   │  UI Detects Claimable State            │
   │                                        │
   │  const { isClaimable } =               │
   │    useReadContract({                   │
   │      functionName: 'isClaimable'       │
   │    })                                  │
   │                                        │
   │  if (isClaimable &&                    │
   │      address === lastMover) {          │
   │    // Show CLAIM button                │
   │  }                                     │
   └──────────────┬─────────────────────────┘
                  │
                  │  User (0xAlice) clicks CLAIM
                  ▼
   ┌────────────────────────────────────────┐
   │  Client Calls claim()                  │
   │                                        │
   │  const { write } = useClaim()          │
   │  write()  // No args, no value         │
   └──────────────┬─────────────────────────┘
                  │
                  │  MetaMask popup
                  │  User confirms
                  ▼
   ┌─────────────────────────────────────────────────────────┐
   │  HitboxPot.claim() nonReentrant                         │
   │                                                         │
   │  VALIDATION:                                            │
   │  ├─ Check reentrancy guard                             │
   │  │   ↓ Pass (_status != ENTERED)                       │
   │  ├─ require(msg.sender == lastMover)                   │
   │  │   ↓ Pass (0xAlice == 0xAlice)                       │
   │  ├─ require(block.timestamp >                          │
   │  │          lastMoveTimestamp + timeoutSeconds)        │
   │  │   ↓ Pass (now > 60 min ago)                         │
   │  └─ require(pot > 0)                                   │
   │      ↓ Pass (pot = 5 ETH)                              │
   │                                                         │
   │  EFFECTS (before transfer):                            │
   │  ├─ uint256 amount = pot                               │
   │  ├─ pot = 0                                            │
   │  └─ lastMover = address(0)                             │
   │                                                         │
   │  INTERACTION (after effects):                          │
   │  ├─ (bool success, ) =                                 │
   │  │    msg.sender.call{value: amount}("")               │
   │  └─ require(success, "TransferFailed")                 │
   │                                                         │
   │  EVENT EMISSION:                                       │
   │  emit Claimed(                                         │
   │      winner: 0xAlice,                                  │
   │      amount: 5 ETH                                     │
   │  )                                                      │
   └────────────┬────────────────────────────────────────────┘
               │
               │  5 ETH transferred to 0xAlice
               │  Transaction confirmed
               ▼
   ┌─────────────────────────────────────────┐
   │  Alice's Wallet Balance                 │
   │                                         │
   │  Before: 100 ETH                        │
   │  After:  105 ETH - gas fees             │
   │                                         │
   │  ✅ Claim successful                     │
   └─────────────────────────────────────────┘
               │
               ▼
   ┌─────────────────────────────────────────┐
   │  Contract State Reset                   │
   │                                         │
   │  pot = 0                                │
   │  lastMover = 0x0                        │
   │  currentTick continues (e.g., tick 500) │
   │                                         │
   │  Game continues with empty pot          │
   │  New votes start fresh pot              │
   └─────────────────────────────────────────┘
```

---

## Data Flow Between Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   DATA FLOW: READ OPERATIONS                             │
└─────────────────────────────────────────────────────────────────────────┘

   CLIENT REQUESTS GAME STATE:

   Client (useGameState hook)
      │
      │  useReadContract({ functionName: 'getState' })
      │
      ▼
   Viem JSON-RPC call
      │
      │  eth_call to contract.getState()
      │
      ▼
   Smart Contract (HitboxPot.sol)
      │
      │  READ STATE VARIABLES:
      │  • currentTick
      │  • tickEndTimestamp
      │  • timeoutSeconds
      │  • lastMoveTimestamp
      │  • lastMover
      │  • pot
      │  • minFee
      │
      │  RETURN: (uint256, uint256, uint256, uint256, address, uint256, uint256)
      │
      ▼
   Viem decodes return value
      │
      │  Maps to GameState type:
      │  {
      │    currentTick: bigint,
      │    tickEndTimestamp: bigint,
      │    timeoutSeconds: bigint,
      │    lastMoveTimestamp: bigint,
      │    lastMover: Address,
      │    pot: bigint,
      │    minFee: bigint
      │  }
      │
      ▼
   React Query caches result
      │
      │  Cache key: ['gameState', contractAddress]
      │  Stale time: 3000ms
      │  Refetch on: window focus, TickFinalized event
      │
      ▼
   React Component renders
      │
      │  <div>Pot: {formatEther(pot)} ETH</div>
      │  <div>Tick: {currentTick}</div>
      │  <div>Time left: {tickTimeRemaining}s</div>


┌─────────────────────────────────────────────────────────────────────────┐
│                   DATA FLOW: WRITE OPERATIONS                            │
└─────────────────────────────────────────────────────────────────────────┘

   USER SUBMITS VOTE:

   Client (useVote hook)
      │
      │  writeContract({
      │    functionName: 'vote',
      │    args: [direction],
      │    value: parseEther('0.001')
      │  })
      │
      ▼
   Wagmi prepares transaction
      │
      │  Estimates gas
      │  Fetches current nonce
      │  Sets gas price (EIP-1559)
      │
      ▼
   Wallet (MetaMask) prompts user
      │
      │  User reviews & signs transaction
      │
      ▼
   Wagmi submits via JSON-RPC
      │
      │  eth_sendRawTransaction
      │
      ▼
   Transaction enters mempool
      │
      │  Pending...
      │
      ▼
   Miner includes in block
      │
      │  Block N at timestamp T
      │
      ▼
   Smart Contract executes vote()
      │
      │  VALIDATION → STATE CHANGE → EVENT EMISSION
      │
      ▼
   VoteCast event logged
      │
      ├─────────────────────────┬──────────────────────┐
      │                         │                      │
      ▼                         ▼                      ▼
   Aggregator              Client Event          Block Explorer
   detects event           Listener refetches    displays transaction
      │                    game state
      │                         │
      │  Tallies votes          │  UI updates
      │  for finalization       │  Pot: 0.004 → 0.005 ETH
      │                         │  Votes[Up]: 2 → 3
      ▼                         │
   At tick end:                 │
   finalizeTick(tick, dir) ─────┤
      │                         │
      │  Transaction confirms   │
      ▼                         ▼
   TickFinalized event    Client refetches again
                                │
                                │  UI updates
                                │  Tick: 11 → 12
                                │  Last Mover updated
                                ▼
                          User sees result
```

---

## Event Sourcing Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│            EVENT SOURCING: RECONSTRUCTING GAME STATE                     │
└─────────────────────────────────────────────────────────────────────────┘

   PRINCIPLE: All game state can be reconstructed from onchain events

   EVENTS TIMELINE:
   ═══════════════════════════════════════════════════════════════════════

   Block 100: Contract Deployed
              ↓
              Genesis State: tick=0, pot=0, lastMover=0x0

   Block 105: VoteCast(voter=0xAlice, tick=0, direction=0, amount=0.001)
   Block 107: VoteCast(voter=0xBob, tick=0, direction=0, amount=0.001)
   Block 110: VoteCast(voter=0xCarol, tick=0, direction=1, amount=0.001)
              ↓
              Accumulated: tick=0, pot=0.003, votes={up:2, down:1, left:0, right:0}

   Block 115: TickFinalized(tick=0, winningDirection=0, lastMover=0xOperator, pot=0.003)
              ↓
              State: tick=1, pot=0.003, lastMover=0xOperator
              Cursor Position: (0, 0) → (0, -1)  // Moved UP

   Block 120: VoteCast(voter=0xDave, tick=1, direction=2, amount=0.005)
              ↓
              State: tick=1, pot=0.008, votes[1]={left:1}

   Block 125: TickFinalized(tick=1, winningDirection=2, lastMover=0xOperator, pot=0.008)
              ↓
              State: tick=2, pot=0.008, lastMover=0xOperator
              Cursor Position: (0, -1) → (-1, -1)  // Moved LEFT

   ... (60 minutes pass, no new finalizations) ...

   Block 9000: Claimed(winner=0xOperator, amount=0.008)
              ↓
              State: tick=2, pot=0, lastMover=0x0

   ═══════════════════════════════════════════════════════════════════════


   RECONSTRUCTION ALGORITHM:
   ════════════════════════════════════════════════════════════════════════

   function reconstructGameState(fromBlock: number, toBlock: number) {
     let state = {
       currentTick: 0,
       pot: 0n,
       lastMover: '0x0',
       cursorX: 0,
       cursorY: 0,
       exploredTiles: new Set(),
     }

     // Fetch all events
     const voteCastEvents = getEvents('VoteCast', fromBlock, toBlock)
     const tickFinalizedEvents = getEvents('TickFinalized', fromBlock, toBlock)
     const claimedEvents = getEvents('Claimed', fromBlock, toBlock)

     // Sort by block number
     const allEvents = [...voteCastEvents, ...tickFinalizedEvents, ...claimedEvents]
       .sort((a, b) => a.blockNumber - b.blockNumber)

     // Replay events
     for (const event of allEvents) {
       if (event.eventName === 'VoteCast') {
         state.pot += event.args.amount
       }
       else if (event.eventName === 'TickFinalized') {
         state.currentTick = event.args.tick + 1
         state.lastMover = event.args.lastMover

         // Update cursor position
         const direction = event.args.winningDirection
         if (direction === 0) state.cursorY -= 1  // Up
         if (direction === 1) state.cursorY += 1  // Down
         if (direction === 2) state.cursorX -= 1  // Left
         if (direction === 3) state.cursorX += 1  // Right

         // Mark tile as explored
         state.exploredTiles.add(`${state.cursorX},${state.cursorY}`)
       }
       else if (event.eventName === 'Claimed') {
         state.pot = 0n
         state.lastMover = '0x0'
       }
     }

     return state
   }

   ════════════════════════════════════════════════════════════════════════

   BENEFITS OF EVENT SOURCING:
   • Aggregator can restart and rebuild state from events
   • Client can compute cursor position without storing offchain
   • Indexers can create alternative views (leaderboards, heatmaps)
   • Full audit trail of all votes and movements
   • Deterministic replay guarantees same result
```

---

## Key Invariants & Security Properties

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM INVARIANTS                                 │
└─────────────────────────────────────────────────────────────────────────┘

FINANCIAL INVARIANTS:
═══════════════════════════════════════════════════════════════════════════
1. pot == sum(all VoteCast.amount) - sum(all Claimed.amount)
2. contract.balance >= pot (contract may hold dust)
3. claim() can only succeed once per timeout period
4. Every vote increases pot by exactly msg.value
5. Only lastMover can withdraw pot

GAME LOGIC INVARIANTS:
═══════════════════════════════════════════════════════════════════════════
1. currentTick is monotonically increasing
2. Each tick can only be finalized once
3. Finalization requires at least 1 vote in the tick
4. Only operator can finalize ticks
5. direction ∈ {0, 1, 2, 3} for all votes and finalizations

TIMING INVARIANTS:
═══════════════════════════════════════════════════════════════════════════
1. tickEndTimestamp = lastMoveTimestamp + tickDurationSeconds
2. claim() requires: now > lastMoveTimestamp + timeoutSeconds
3. Aggregator waits for: now > tickEndTimestamp before finalizing
4. tickDurationSeconds, timeoutSeconds, minFee are immutable

SECURITY PROPERTIES:
═══════════════════════════════════════════════════════════════════════════
1. No reentrancy in claim() (nonReentrant modifier)
2. No unbounded loops (all loops are over fixed-size arrays)
3. Checks-Effects-Interactions pattern in claim()
4. Operator cannot steal funds (only set by constructor)
5. Failed transfers revert entire transaction
```

---

## Next Steps for Visualization

This document provides:
- ✅ System architecture diagram
- ✅ Game state machine
- ✅ Tick lifecycle flowchart
- ✅ Vote flow sequence
- ✅ Claim flow sequence
- ✅ Data flow diagrams
- ✅ Event sourcing model
- ✅ System invariants

**Future enhancements:**
- [ ] Add UML sequence diagrams for each flow
- [ ] Create interactive Mermaid.js diagrams
- [ ] Add P5.js visual layer integration diagram
- [ ] Document multi-user race conditions and resolutions
- [ ] Add deployment architecture (Anvil → Testnet → Mainnet)

---

**For implementation details, see:**
- `/Users/raulchacon/projects/hitbox_onchain/HANDOFF.md` - Current progress
- `/Users/raulchacon/projects/hitbox_onchain/CLAUDE.md` - Developer guide
- `/Users/raulchacon/projects/hitbox_onchain/PROTOCOL.md` - Protocol specification
- `/Users/raulchacon/projects/hitbox_onchain/.claude/plans/rosy-hopping-nygaard.md` - Testing plan
