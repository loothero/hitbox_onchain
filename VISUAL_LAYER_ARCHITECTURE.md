# Visual Layer Architecture Recommendation

## Recommended Approach: Hybrid Onchain/Offchain

### Core Principle
**Store minimal seed onchain, generate world offchain deterministically**

---

## 🎯 Recommended Solution

### 1. **Onchain: Single `seasonSeed` State Variable**

```solidity
/// @notice Seed for current season's world generation
uint256 public seasonSeed;
```

**Gas Cost:** ~20,000 gas to set once per season (SSTORE operation)

**Benefits:**
- ✅ Single source of truth
- ✅ Verifiable by anyone
- ✅ Enables multiple seasons
- ✅ Minimal gas (set once per season, not per tick)

### 2. **Offchain: Deterministic World Generation**

- World generation happens **client-side** using the seed
- All clients generate the same world (deterministic algorithm)
- No contract calls needed for world data
- Scales infinitely (no gas cost per tile)

### 3. **Season Management**

```solidity
/// @notice Start a new season with a new world seed
function startNewSeason(uint256 newSeed) external {
    require(msg.sender == operator, "NotOperator");
    seasonSeed = newSeed;
    // Optionally reset pot, tick, etc. for new season
}
```

---

## 📊 Comparison of Approaches

| Approach | Gas Cost | Scalability | Verifiability | Flexibility |
|----------|----------|------------|---------------|--------------|
| **Store seed onchain** ✅ | ~20k per season | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Derive from address | 0 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Store world onchain | ~100k+ per tile | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Offchain only | 0 | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |

---

## 🏗️ Implementation Plan

### Phase 1: MVP (Current)
- Derive seed from `contractAddress + genesisTimestamp`
- No contract changes needed
- Works immediately

### Phase 2: Add Season Support
- Add `seasonSeed` to contract (one-time gas cost)
- Add `startNewSeason()` function
- Update client to read seed from contract

### Phase 3: Advanced Features
- Multiple concurrent seasons (if needed)
- Season-specific leaderboards
- World evolution over seasons

---

## 💰 Gas Analysis

### Current Contract State Variables
- `pot`: uint256 (1 SSTORE = ~20k gas)
- `currentTick`: uint256 (updates frequently)
- `tickEndTimestamp`: uint256 (updates frequently)
- `lastMoveTimestamp`: uint256 (updates frequently)
- `lastMover`: address (updates frequently)
- `genesisTimestamp`: uint256 (immutable, set in constructor)

### Adding Season Seed
- **One-time cost:** ~20,000 gas to set `seasonSeed`
- **Read cost:** 0 gas (view function)
- **Per-season cost:** 20,000 gas (only when starting new season)

**Total impact:** Negligible - one SSTORE per season vs. thousands of ticks

---

## 🔒 Security & Verifiability

### Deterministic Generation
```typescript
// All clients generate identical world
const seed = await contract.seasonSeed()
const world = generateWorld(seed) // Same result everywhere
```

### Verification
- Anyone can verify world generation matches seed
- No trust required in aggregator or clients
- World can be regenerated from onchain seed

---

## 📈 Scalability Benefits

1. **No per-tile gas costs** - World generation is free
2. **Infinite world size** - Generate 128×128, 256×256, or larger
3. **Client-side caching** - Generate once, cache forever
4. **Parallel generation** - Multiple clients can generate simultaneously

---

## 🎨 Theme System (Offchain)

Themes are **completely offchain** and **client-side only**:
- No gas cost
- Unlimited themes
- User-selectable
- Community-driven

---

## ✅ Final Recommendation

**Add `seasonSeed` to contract with these benefits:**

1. **Gas Optimized:** One-time cost per season (~20k gas)
2. **Scalable:** World generation is free and client-side
3. **Verifiable:** Anyone can verify world matches seed
4. **Sustainable:** Supports multiple seasons
5. **Best Practice:** Follows "store minimal, compute maximum" principle

**Implementation Priority:**
1. ✅ **Now:** Use derived seed (contract address + genesis) - works immediately
2. 🔄 **Phase 2:** Add `seasonSeed` to contract when ready for multi-season support
3. 🚀 **Future:** Add season management UI and advanced features

---

## Code Example

### Contract Addition (Phase 2)
```solidity
uint256 public seasonSeed;

constructor(...) {
    // ... existing code ...
    seasonSeed = uint256(keccak256(abi.encodePacked(address(this), block.timestamp)));
}

function startNewSeason(uint256 newSeed) external {
    require(msg.sender == operator, "NotOperator");
    seasonSeed = newSeed;
    emit SeasonStarted(newSeed);
}
```

### Client Usage
```typescript
// Read seed from contract (free view call)
const seed = await contract.seasonSeed()

// Generate world deterministically
const world = generateWorld(Number(seed))

// All clients see the same world!
```

---

## Summary

**Best approach:** Store minimal seed onchain, generate world offchain

- **Gas:** Minimal (20k per season)
- **Scalability:** Infinite (client-side generation)
- **Verifiability:** Perfect (deterministic from seed)
- **Flexibility:** Maximum (themes, seasons, evolution)

This follows the **"onchain settlement, offchain computation"** pattern used by modern blockchain games.
