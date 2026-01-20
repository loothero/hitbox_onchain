# Gas Budget

Maximum allowed gas consumption per function. CI will warn (not fail) if these limits are exceeded by >5%.

## Budgets

| Function | Max Gas (Cold) | Max Gas (Warm) | Tier |
|----------|---------------|----------------|------|
| `vote()` | 80,000 | 55,000 | HOT |
| `finalizeTick()` | 100,000 | 80,000 | Medium |
| `claim()` | 80,000 | 60,000 | Cold |
| `setOperator()` | 30,000 | 10,000 | Admin |

## Notes

- **Cold:** First access to storage slot in transaction
- **Warm:** Subsequent access to same storage slot
- **Tolerance:** 5% regression allowed before warning

## Base L2 Cost Context

At Base gas prices (~0.001-0.01 gwei):
- 80k gas @ 0.01 gwei = ~$0.000002 (sub-cent)
- 100k gas @ 0.01 gwei = ~$0.0000025 (sub-cent)

Gas optimization is about principle and future-proofing, not current cost necessity.

## Updating Budgets

1. Run `forge test --gas-report` to get current measurements
2. Update this file with new targets
3. Run `forge snapshot` to create baseline
4. Commit `.gas-snapshot` file for CI comparison
