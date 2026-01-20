# Gas Optimization Scope

This document defines gas optimization priorities for HitboxPot.sol functions based on caller type, call frequency, and optimization tier.

## Function Classification

| Function | Caller | Frequency | Target Tier | Rationale |
|----------|--------|-----------|-------------|-----------|
| `vote()` | User | High | **HOT** | Called every vote. Sub-cent cost critical for UX. Minimize aggressively. |
| `finalizeTick()` | Aggregator | Per-tick | **Medium** | Called once per tick by operator. Reasonable overhead acceptable. |
| `claim()` | User | Rare | **Cold** | Called only on timeout (game over). Higher gas acceptable. |
| `setOperator()` | Admin | Once | **Admin** | One-time setup. Don't optimize. |
| View functions | Any | High | **N/A** | Free calls. No onchain gas. |

## Optimization Tiers

### HOT (Minimize)
- Target: Lowest possible gas
- Applies to: `vote()`
- Strategy: Storage packing, minimal SSTOREs, no unnecessary reads

### Medium (Reasonable)
- Target: Under 100k gas
- Applies to: `finalizeTick()`
- Strategy: Efficient but readable, avoid unnecessary complexity

### Cold (Acceptable)
- Target: Under 150k gas
- Applies to: `claim()`
- Strategy: Prioritize security and clarity over micro-optimizations

### Admin (Don't optimize)
- No target
- Applies to: `setOperator()`
- Strategy: Focus on correctness only

## Current Gas Costs (Baseline)

| Function | Cold (first call) | Warm (subsequent) |
|----------|-------------------|-------------------|
| `vote()` | ~73k | ~50k |
| `finalizeTick()` | TBD | TBD |
| `claim()` | TBD | TBD |

## Cost Analysis on Base

At Base L2 gas prices (~0.001-0.01 gwei):
- 73k gas @ 0.01 gwei = ~$0.000002 per vote
- Already sub-cent, but every reduction improves margin

## Optimization Opportunities

### High Impact
1. **Storage packing** - Combine related writes into same slot
2. **Custom error for reentrancy** - Remove string from require

### Medium Impact
1. Unchecked math where overflow impossible
2. Calldata over memory for read-only params

### Low Impact (Don't pursue unless free)
1. Assembly for trivial gains
2. Micro-optimizations that hurt readability
