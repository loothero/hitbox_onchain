# Hitbox Onchain

A collaborative, explorable artwork and game with onchain economic coordination. A single shared cursor navigates a fog-of-war world, controlled by paid directional votes that are batched into discrete ticks.

## Quick Start

### Prerequisites
- Node.js 18+
- [Foundry](https://getfoundry.sh) (for smart contracts)

### Setup

```bash
# Install dependencies
npm install

# Build core package
npm run build -w @hitbox/core

# Build contracts
cd contracts && forge build

# Run contract tests
forge test

# Run aggregator (dev mode)
npm run dev:aggregator
```

## Architecture

```
hitbox_onchain/
├── contracts/           # Solidity contracts (Foundry)
│   └── src/HitboxPot.sol
├── aggregator/          # Tick resolution service (Node.js)
├── packages/
│   └── core/            # Shared types and utilities
└── docs/                # Documentation
```

### Components

| Component | Purpose |
|-----------|---------|
| **HitboxPot Contract** | Escrow pot, enforce fees, track timeout/last mover |
| **Aggregator Service** | Watch votes, compute tick winner, submit finalizeTick |
| **Core Package** | Shared types, tie-break logic |

## How It Works

1. Players pay to vote on cursor direction (Up/Down/Left/Right)
2. Votes are batched into discrete **ticks** (3 second windows)
3. At tick end, aggregator selects winning direction and finalizes onchain
4. If no move occurs before **timeout**, last mover can claim the pot

## Configuration

Environment variables for aggregator:

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | RPC endpoint | Base Sepolia |
| `CONTRACT_ADDRESS` | Deployed HitboxPot address | - |
| `OPERATOR_PRIVATE_KEY` | Operator wallet key | - |
| `PORT` | API server port | 3001 |

## API Endpoints

- `GET /health` - Service health check
- `GET /state` - Current game state
- `GET /votes/current` - Vote counts for current tick

## License

MIT
