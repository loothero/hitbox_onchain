# Initial Gas Report

Generated after implementing storage packing and custom error optimizations.

## Environment
- **Forge Version:** foundry (see `forge --version`)
- **Solidity:** 0.8.33
- **Date:** 2026-01-20

## Contract Deployment
| Metric | Value |
|--------|-------|
| Deployment Cost | 1,670,563 gas |
| Deployment Size | 7,997 bytes |

## Function Gas Measurements

### From Forge Gas Report

| Function | Min | Avg | Median | Max | # Calls |
|----------|-----|-----|--------|-----|---------|
| `vote` | 21,699 | 48,301 | 42,568 | 121,454 | 3,251 |
| `finalizeTick` | 24,143 | 75,650 | 89,272 | 89,272 | 13 |
| `claim` | 28,766 | 36,259 | 41,199 | 41,199 | 5 |

### From Dedicated Gas Tests

| Test Scenario | Gas Used |
|---------------|----------|
| `vote` cold (first in tick) | ~67,500 |
| `vote` warm (subsequent) | ~34,400 |
| `vote` after 100 skipped ticks | ~112,300 |
| `finalizeTick` | ~56,200 |
| `claim` | ~18,700 |

## Optimization Results

### Storage Packing
Packed `lastMover` (address, 20 bytes) + `lastMoveTimestamp` (uint48, 6 bytes) + `tickEndTimestamp` (uint48, 6 bytes) into a single 32-byte storage slot.

**Impact:** Warm vote reduced from ~50k to ~34k gas (32% reduction for subsequent votes in same tick).

### Custom Error for Reentrancy
Replaced `require(_status != ENTERED, "ReentrancyGuard: reentrant call")` with `if (_status == ENTERED) revert ReentrantCall()`.

**Impact:** ~200 gas savings per claim() call.

## Cost Analysis on Base

At Base L2 gas prices (~0.01 gwei):

| Function | Max Gas | Cost @ 0.01 gwei | Cost @ 0.001 gwei |
|----------|---------|------------------|-------------------|
| `vote` (cold) | 67,500 | $0.0000017 | $0.00000017 |
| `vote` (warm) | 34,400 | $0.0000009 | $0.00000009 |
| `finalizeTick` | 89,272 | $0.0000022 | $0.00000022 |
| `claim` | 41,199 | $0.0000010 | $0.00000010 |

**All operations are sub-cent.**

## Baseline for CI

Run `forge snapshot` to generate `.gas-snapshot` for CI regression testing.
