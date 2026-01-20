# Security

## Reporting Vulnerabilities

If you discover a security vulnerability in Hitbox Onchain, please report it responsibly:

1. **DO NOT** open a public issue
2. Open a private security advisory via GitHub's Security tab
3. Or email the maintainers directly (check repository settings)
4. Include a detailed description and steps to reproduce

## Response Timeline

- Initial response: 48 hours
- Status update: 7 days
- Resolution target: 30 days

## Bug Bounty

Bug bounty program details TBD for mainnet deployment.

## Security Measures

### Smart Contracts

- Reentrancy guard on claim function
- Custom errors (no string storage costs)
- Input validation on all external functions
- Checks-effects-interactions pattern
- Single finalization per tick enforcement
- Storage packing to minimize attack surface

### Infrastructure

- Operator key should be a dedicated hot wallet with limited funds
- Use multisig for treasury and admin functions
- Regular key rotation recommended
- Aggregator is stateless - crashes don't lose funds

### Known Trust Assumptions

- **Operator trust**: MVP uses operator-controlled finalization
- Operator can technically submit incorrect winning directions
- Mitigation: Aggregator source is public, anyone can verify
- Future: Move to permissionless finalization with proofs

## Audit Status

- [x] Internal review
- [ ] External audit (planned for mainnet)

## Contact

For security concerns, use GitHub's private security advisory feature or contact the maintainers through the repository.
