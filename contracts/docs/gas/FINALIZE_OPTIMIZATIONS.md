# finalizeTick() Gas Optimizations

## Function Profile
- **Tier:** Medium (reasonable overhead acceptable)
- **Caller:** Aggregator operator
- **Frequency:** Once per tick (every 3 seconds in production)

## Current Gas Usage
| Scenario | Gas (Pre-optimization) | Gas (Post-optimization) |
|----------|------------------------|------------------------|
| Standard finalization | TBD | TBD |

## Optimizations Applied

### 1. Storage Packing (Implemented)
Same benefit as `vote()` - updating `lastMover`, `lastMoveTimestamp`, and `tickEndTimestamp` in a single SSTORE.

### 2. Custom Errors (Already present)
All reverts use custom errors: `NotOperator`, `InvalidDirection`, `InvalidTick`, `TickNotActive`, `TickAlreadyFinalized`, `NoVotesInTick`.

## Future Optimization Opportunities

### Medium Potential
1. **Unchecked currentTick increment** - `currentTick += 1` cannot overflow
   - Would need 2^256 ticks (at 3 seconds per tick, ~10^69 years)
   - Estimated savings: ~20-40 gas

2. **Cache vote counts differently** - Currently uses memory array
   - Already reasonably optimized for fixed-size array

### Low Potential (Not recommended)
3. **Skip totalVotes calculation** - Require caller to prove vote exists
   - Adds complexity, marginal gain
   - Increases trust assumptions

## Gas Breakdown (Conceptual)

| Operation | Approx Gas |
|-----------|------------|
| Function entry + calldata | ~2k |
| Operator check (SLOAD) | ~100-2100 |
| Direction validation | ~50 |
| Tick validation | ~100 |
| Timestamp check (SLOAD) | ~100-2100 |
| tickFinalized check (SLOAD mapping) | ~100-2100 |
| Load vote counts (SLOAD x4) | ~400-8400 |
| Sum calculation | ~50 |
| Mark finalized (SSTORE mapping) | ~5k-20k |
| Update lastMover + timestamps (SSTORE) | ~5k-20k |
| Update currentTick (SSTORE) | ~5k-20k |
| Event emission | ~3k |

## Design Notes

finalizeTick is called by the aggregator once per tick. At Base L2 gas prices, even 100k gas costs ~$0.00001. Optimizing this function is lower priority than `vote()`, but the storage packing benefits both.
