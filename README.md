# Hitbox Onchain

A collaborative, explorable artwork where a single shared cursor navigates a procedurally generated fog-of-war world. Movement is controlled by paid directional votes batched into discrete ticks. Inspired by Twitch Plays Pokemon, but designed as an infinite exploration rather than a game to be beaten.

## Features

- **Collective Control** - One cursor, many players voting on direction
- **Paid Votes** - ETH fees create economic coordination and fund the pot
- **Fog-of-War** - World revealed through collective exploration
- **Deterministic Replay** - Full game state reconstructable from onchain events
- **Timeout Claims** - Last mover claims pot if activity stops

## Quick Start

### Prerequisites

- Node.js 18+
- [Foundry](https://getfoundry.sh) for smart contracts

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/hitbox_onchain.git
cd hitbox_onchain

# Install dependencies
npm install

# Build packages
npm run build -w @hitbox/core
```

### Local Development

```bash
# Terminal 1: Start local blockchain
cd contracts && anvil

# Terminal 2: Deploy contract
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Terminal 3: Start aggregator (update CONTRACT_ADDRESS in aggregator/.env first)
cd aggregator && npm run dev

# Terminal 4: Start client
cd client && npm run dev
```

Open http://localhost:5173 to play.

### Run Tests

```bash
cd contracts
forge test              # Run all tests
forge test --gas-report # With gas reporting
forge test -vvv         # Verbose output
```

## Architecture

```
hitbox_onchain/
├── contracts/           # Solidity (Foundry)
│   └── src/HitboxPot.sol
├── aggregator/          # Tick resolution service (Node.js/Express)
├── client/              # Web UI (React/Vite/p5.js)
│   └── src/game/        # World generation, themes
└── packages/
    └── core/            # Shared types and utilities
```

### Components

| Component | Tech | Purpose |
|-----------|------|---------|
| **HitboxPot** | Solidity | Escrow, voting, timeouts, claims |
| **Aggregator** | Node.js/Viem | Watch votes, finalize ticks onchain |
| **Client** | React/p5.js | Visual layer, wallet connection, voting UI |
| **Core** | TypeScript | Shared types, tie-break logic |

### Data Flow

```
Player votes (ETH) → Contract stores vote → Aggregator watches events
                                                    ↓
Client renders ← Aggregator API ← Aggregator finalizes tick onchain
```

## Configuration

### Environment Variables

**Aggregator** (`aggregator/.env`):
```bash
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
OPERATOR_PRIVATE_KEY=0x...
PORT=3001
```

**Contract Deployment** (optional):
```bash
TICK_DURATION=5        # Seconds per tick
TIMEOUT_SECONDS=60     # Inactivity before claim allowed
MIN_FEE=100000000000000  # 0.0001 ETH in wei
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service status, chain ID |
| `/state` | GET | Current tick, pot, timeout |
| `/votes/current` | GET | Vote counts for active tick |

## Protocol

- **Ticks**: Fixed time windows (default 5s) for vote collection
- **Directions**: Up(0), Down(1), Left(2), Right(3)
- **Tie-break**: Deterministic using `keccak256(tick, prevTxHash)`
- **Timeout**: Last mover claims pot after inactivity period

See [PROTOCOL.md](PROTOCOL.md) for full specification.

## Gas Optimization

Contract uses storage packing for efficient votes:
- Cold vote: ~67k gas
- Warm vote: ~34k gas

At Base L2 prices (~0.01 gwei), votes cost < $0.00001.

## Security

- Reentrancy guard on claims
- Checks-effects-interactions pattern
- Input validation on all functions

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT - see [LICENSE](LICENSE)
