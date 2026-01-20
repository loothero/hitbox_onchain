# Contributing to Hitbox Onchain

## Development Setup

```bash
# Clone and install
git clone https://github.com/yourusername/hitbox_onchain.git
cd hitbox_onchain
npm install

# Build packages
npm run build -w @hitbox/core

# Run contract tests
cd contracts && forge test
```

## Project Structure

```
hitbox_onchain/
├── contracts/       # Solidity contracts (Foundry)
├── aggregator/      # Tick resolution service (Node.js)
├── client/          # Web UI (React/Vite/p5.js)
├── packages/core/   # Shared types and utilities
└── docs/            # Documentation
```

## Local Development

```bash
# Terminal 1: Local blockchain
cd contracts && anvil

# Terminal 2: Deploy
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Terminal 3: Aggregator
cd aggregator && npm run dev

# Terminal 4: Client
cd client && npm run dev
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests:
   - Contracts: `cd contracts && forge test`
   - Gas check: `cd contracts && forge snapshot --check`
5. Commit with conventional commits
6. Open a Pull Request

## Code Style

### Solidity
- Run `forge fmt` before committing
- Use custom errors, not require strings
- Document public functions with NatSpec
- Follow checks-effects-interactions pattern

### TypeScript
- Prettier + ESLint (auto-formatted)
- Use explicit types on exports
- Prefer `unknown` over `any`

### Commits
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Keep commits focused and atomic

## Component Guidelines

### Contracts (`/contracts`)
- All changes require tests
- Run gas report: `forge test --gas-report`
- Check for regressions: `forge snapshot --check`
- Security review for any fund-handling changes

### Aggregator (`/aggregator`)
- Must remain stateless (recover from chain on restart)
- Test against local Anvil before submitting

### Client (`/client`)
- Visual changes should work across themes
- Test event reconstruction from fresh state
- Wallet connection tested with multiple providers

### Core (`/packages/core`)
- Changes here affect all components
- Ensure tie-break logic remains deterministic
- Update types carefully (breaking changes)

## Labels

- `good first issue` - Good for newcomers
- `contracts` - Smart contract changes
- `aggregator` - Aggregator service changes
- `client` - UI/visual layer changes
- `docs` - Documentation changes

## Questions?

Open a discussion or issue on GitHub.
