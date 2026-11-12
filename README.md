Educational project for the course Introduction to Finance. Not a real product, service or investment offer. Do not use with real funds.

# EduChain prototype (CertificateRegistry)

Team 2 - Astana IT University, Introduction to Finance, 2026-2027. Supervisor: Nurkhat Ibadildin, Associate Professor.

Demo video: (https://drive.google.com/file/d/1KD-BRJS-CRU0MKyA4rARiXe8j7AJqmJW/view?usp=sharing) |  Testnet contract address: none (local Hardhat network only)

## What it does
A smart contract that registers the SHA-256 hash of a **synthetic** academic certificate, lets anyone verify a hash, and lets the issuing university revoke its own records. Original files and personal data stay off-chain; only a hash and an opaque reference ID are stored.

| Role | Rights |
|---|---|
| Admin (DEFAULT_ADMIN_ROLE) | Grant/revoke issuer role, pause/unpause registration. Cannot register or revoke certificates. |
| Issuer (ISSUER_ROLE) | Register hashes; revoke only the hashes it registered. |
| Anyone | `verifyCertificate(hash)` (read-only) returns None / Active / Revoked. |

Interface: `registerCertificate(bytes32, string)`, `verifyCertificate(bytes32)`, `revokeCertificate(bytes32)`, `pause()`, `unpause()`.

## Run it (local network only)
Requires Node.js 18+ (LTS).

```bash
npm install
npx hardhat compile
npx hardhat test            # 12 unit tests
npx hardhat run scripts/demo.js   # step-by-step demo of the main use case
```
Hardhat Network is an in-memory local chain with test accounts created by the tool. No wallet, key, `.env` file, public network or real funds are needed or used. `.env` is listed in `.gitignore`.

## Security notes (threats and mitigations)
| Threat | Mitigation in this prototype |
|---|---|
| Broken access control | OpenZeppelin AccessControl roles; issuer-specific revocation; negative tests (2, 9, 10, 11, 12) |
| Reentrancy | Contract holds no ether/tokens and makes no external calls; state changes before events |
| Loss/theft of admin key | Admin has least privilege (no register/revoke); production design: multisignature admin |
| Duplicate / empty / conflicting records | Reverts on zero hash and any existing hash, including revoked ones (tests 7, 8) |

## Credits
Built on [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) v5 (MIT licence). AI tools used: see the AI Disclosure Statement in the report.

## Test data
All certificates are synthetic. No personal data of real people is used anywhere.
