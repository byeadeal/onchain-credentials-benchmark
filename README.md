# On-chain student credentials benchmark

Early harness for a controlled gas comparison of three EVM student-credential architectures. The experiment is the one proposed in *Scaling the Cost of On-Chain Student Credentials: Architectural Trade-Offs, Empirical Benchmarks, and State Bloat Dynamics* by Azhar Tashmetova, Alikhan Baiadil, and Adilzhan Oryngali (Nazarbayev University).

The paper finds that published measurements cover these designs separately or in pairs. It does not report one shared run across cohort sizes from 1 to 1,000 students for issuance, verification, and revocation under the same compiler and network settings. This repository is the start of that setup. It is a working skeleton, not a finished benchmark, and the numbers it writes are local Hardhat measurements rather than results from the paper.

## Architectures

1. **HashRegistry.** One storage record per credential hash. `issue`, `verify`, and `revoke` are direct map updates. Revocation keeps the slot and flips the status.
2. **SoulboundCredential.** An ERC-721 credential minted to the student. Transfers and approvals revert, and the token is marked locked (in the spirit of ERC-4973, ERC-5192, and ERC-5484, not a full implementation of those standards). Revocation burns the token.
3. **MerkleCredentialAnchor.** The cohort is hashed off-chain into a sorted-pair Merkle tree. The contract stores one root per batch, checks an inclusion proof, and revokes individual leaves with a flag.

All three use the same credential payload (`NU-BSc-2026`, cohort size, index), so the comparison is about the architecture.

## Layout

```
contracts/    HashRegistry, SoulboundCredential, MerkleCredentialAnchor
test/         lifecycle tests for issue, verify, and revoke
scripts/      issuance benchmark and the shared leaf / Merkle helpers
results/      CSV output, gitignored
```

Solidity is pinned to **0.8.28** with the optimizer on (200 runs) and the Cancun EVM. Those settings live in `scripts/lib/settings.ts` and are what `hardhat.config.ts` compiles with.

## Requirements

Node.js 20 or newer.

## Install

```bash
npm install
```

## Test

```bash
npm test
```

## Benchmark

```bash
npm run benchmark
```

This deploys a fresh copy of each contract per cohort on the in-process Hardhat network and measures deployment gas and issuance gas. Cohort sizes default to 1, 10, 100, and 1000. Issuance for the hash registry and the soulbound token is one transaction per student. Merkle issuance is a single `anchor` of the off-chain root; tree construction is not gas.

Override the sizes with `COHORT_SIZES`:

```bash
COHORT_SIZES=1,10 npm run benchmark
```

The script overwrites `results/issuance.csv`. Each row records the compiler, optimizer runs, EVM target, network, and timestamp next to the gas totals.

Verification gas, revocation gas, calldata size, repeated trials, and runs on a post-Dencun Layer 1 testnet or a Layer 2 rollup are not implemented yet.

## Roadmap

- Verification gas for valid and invalid credentials, for each architecture.
- Revocation gas, including a Merkle comparison of the per-leaf flag against rebuilding the tree and anchoring a new root.
- Calldata size, and a note on data-availability cost where a rollup would publish the batch.
- Repeated runs on the same configuration, then median and spread rather than a single sample.
- The same compiler settings on a post-Dencun Layer 1 testnet and on an EVM Layer 2.
- A short comparison of the measured curves with the architectural estimates cited in the paper (storage writes, soulbound mint overhead, and a flat Merkle root).

## License

MIT. See [LICENSE](LICENSE).
