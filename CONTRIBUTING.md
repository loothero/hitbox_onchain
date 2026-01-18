# Contributing to Hitbox Onchain

## Development Setup

```bash
# Clone and install
git clone <repo>
cd hitbox_onchain
npm install

# Build packages
npm run build -w @hitbox/core

# Run tests
cd contracts && forge test
```

## Project Structure

- `/contracts` - Solidity contracts (Foundry)
- `/aggregator` - Tick resolution service
- `/packages/core` - Shared types and utilities
- `/docs` - Documentation

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`forge test` for contracts)
5. Commit with conventional commits
6. Open a Pull Request

## Code Style

- **Solidity**: `forge fmt`
- **TypeScript**: Prettier + ESLint
- Use explicit types
- Document public functions

## Labels

- `good first issue` - Good for newcomers
- `contracts` - Smart contract changes
- `aggregator` - Aggregator service changes
- `docs` - Documentation changes
