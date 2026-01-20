# vote() Gas Optimizations

## Function Profile
- **Tier:** HOT (minimize aggressively)
- **Caller:** Users
- **Frequency:** Every vote (~many per tick)

## Current Gas Usage
| Scenario | Gas (Pre-optimization) | Gas (Post-optimization) |
|----------|------------------------|------------------------|
| Cold (first vote) | ~73k | TBD after measurement |
| Warm (subsequent) | ~50k | TBD after measurement |
| After 100 skipped ticks | ~73k | TBD after measurement |

## Optimizations Applied

### 1. Storage Packing (Implemented)
**Before:**
```solidity
// Slot 2: tickEndTimestamp (256 bits)
// Slot 3: lastMoveTimestamp (256 bits)
// Slot 4: lastMover (160 bits, 96 wasted)
```

**After:**
```solidity
// Slot 2: lastMover (160) + lastMoveTimestamp (48) + tickEndTimestamp (48) = 256 bits
address public lastMover;
uint48 public lastMoveTimestamp;
uint48 public tickEndTimestamp;
```

**Impact:** Reduces from 3 SSTORE to 1 SSTORE for updating last mover info.

**Safety Notes:**
- `uint48` timestamps are good until year 8,921,556 (block.timestamp will exceed max uint48 in ~8.9M years)
- No overflow risk for practical use cases

### 2. Custom Error for Reentrancy (Implemented)
**Before:** `require(_status != ENTERED, "ReentrancyGuard: reentrant call");`
**After:** `if (_status == ENTERED) revert ReentrantCall();`

**Impact:** ~200 gas saved (string storage vs custom error selector)

## Future Optimization Opportunities

### High Potential
1. **Unchecked arithmetic** - `pot += msg.value` and `tickVotes[currentTick][direction] += 1` cannot overflow in practice
   - Pot: Would need 2^256 wei (~10^59 ETH, impossible)
   - Vote count: Would need 2^256 votes per tick (impossible)
   - Estimated savings: ~40-60 gas

### Medium Potential
2. **Cache currentTick in memory** - Avoid repeated SLOAD
   - Estimated savings: ~100 gas if accessed multiple times

### Low Potential (Not recommended)
3. **Assembly for storage packing** - Manual slot writes
   - Marginal gains, significantly reduced readability
   - Increased audit complexity

## Gas Breakdown (Conceptual)

| Operation | Approx Gas |
|-----------|------------|
| Function entry + calldata | ~2k |
| Direction validation | ~50 |
| Fee validation | ~50 |
| `_advanceTickIfNeeded` check | ~100-2100 |
| Timestamp comparison | ~100 |
| Vote storage write (SSTORE) | ~5k-20k |
| Pot update (SSTORE) | ~5k-20k |
| lastMover + timestamps (SSTORE) | ~5k-20k |
| Event emission | ~2k |

SSTORE costs depend on cold vs warm storage access.
