# Security

## Reporting Vulnerabilities

If you discover a security vulnerability in Hitbox Onchain, please report it responsibly:

1. **DO NOT** open a public issue
2. Email security concerns to [security email TBD]
3. Include a detailed description and steps to reproduce

## Response Timeline

- Initial response: 48 hours
- Status update: 7 days
- Resolution target: 30 days

## Bug Bounty

Bug bounty program details TBD for mainnet deployment.

## Security Measures

### Smart Contracts
- Reentrancy guard on claim function
- Input validation on all functions
- Checks-effects-interactions pattern
- Single finalization per tick enforcement

### Infrastructure
- Operator key should be a dedicated hot wallet
- Use multisig for treasury and admin functions
- Regular key rotation recommended

## Audit Status

- [ ] Internal review
- [ ] External audit (pending for mainnet)
