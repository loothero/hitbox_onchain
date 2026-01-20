# Hitbox Contracts

Solidity smart contracts for Hitbox Onchain, built with [Foundry](https://book.getfoundry.sh/).

## Overview

**HitboxPot.sol** - Core escrow and settlement contract:
- Accept paid votes for cursor direction
- Track vote counts per tick
- Operator-controlled tick finalization
- Timeout-based pot claims

## Development

### Build

```bash
forge build
```

### Test

```bash
forge test                    # All tests
forge test -vvv               # Verbose
forge test --gas-report       # With gas metrics
forge test --match-path test/gas/Gas.t.sol  # Gas tests only
```

### Gas Snapshots

```bash
forge snapshot        # Create baseline
forge snapshot --check  # Check for regressions
```

### Deploy

```bash
# Local (Anvil)
anvil  # In separate terminal
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# With custom params
TICK_DURATION=5 TIMEOUT_SECONDS=60 forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Contract Architecture

```
src/
├── HitboxPot.sol    # Main contract

test/
├── HitboxPot.t.sol  # Unit & fuzz tests
└── gas/
    └── Gas.t.sol    # Gas measurement tests

script/
└── Deploy.s.sol     # Deployment script

docs/
├── GAS_SCOPE.md     # Optimization priorities
└── gas/             # Per-function gas analysis
```

## Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `vote(direction)` | Public (payable) | Submit paid vote |
| `finalizeTick(tick, direction)` | Operator | Finalize winning direction |
| `claim()` | Last mover | Claim pot after timeout |
| `getState()` | View | Current game state |

## Gas Optimization

Storage layout optimized for minimal SSTOREs:
- Slot 0: `pot` (256 bits)
- Slot 1: `currentTick` (256 bits)
- Slot 2: `lastMover` (160) + `lastMoveTimestamp` (48) + `tickEndTimestamp` (48)
- Slot 3: `operator` (160 bits)

Results:
- Cold vote: ~67k gas
- Warm vote: ~34k gas

## Security

- Reentrancy guard on `claim()`
- Checks-effects-interactions pattern
- Custom errors (no string reverts)
- Input validation on all external functions

## License

MIT
