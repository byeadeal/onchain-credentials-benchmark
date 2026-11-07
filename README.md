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
scripts/      issuance benchmark, results plot, and the shared leaf / Merkle helpers
results/      issuance.csv, figures/, and optional verification or revocation CSVs
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

The script overwrites `results/issuance.csv`. Each row records the compiler, optimizer runs, EVM target, network, and timestamp next to receipt `gasUsed`. `operation` is `deploy` or `issue`. `total_gas` is the receipt total for that operation. `gas_per_credential` is blank for deployment and `floor(total_gas / cohort_size)` for issuance. That quotient is not `eth_estimateGas`, and deployment gas is not added to the issuance total. Hash-registry and soulbound issuance use one transaction per credential. Merkle issuance is one `anchor` receipt, so its per-credential figure divides that receipt by the cohort size.

Verification gas, revocation gas, calldata size, repeated trials, and runs on a post-Dencun Layer 1 testnet or a Layer 2 rollup are not measured by this script.

## Plot

`scripts/plot_results.py` draws gas against cohort size. It does not measure gas. Deployment, total issuance, and per-credential issuance are separate panels, all from receipt `gasUsed`. The per-credential panel plots the CSV's `floor(total_gas / cohort_size)` column. It does not plot `eth_estimateGas`, and it does not add deployment into the issuance series.

The same script can add panels from optional CSVs. A file that is not there is skipped. Missing rows are not drawn as zeros.

Verification (`results/verification.csv`) uses scenarios `valid` and `invalid`. Its `gas` column is `eth_estimateGas`.

Revocation (`results/revocation.csv`) uses scenario `revoke`. Its `gas` column is receipt `gasUsed`.

Both optional files use this header. Extra columns are ignored. One row per architecture, cohort size, and scenario:

```text
architecture,cohort_size,scenario,gas
```

`architecture` is `hash_registry`, `soulbound`, or `merkle_anchor`.

Install the plotting library, then regenerate the figure from the repository root:

```bash
python3 -m pip install matplotlib
python3 scripts/plot_results.py
```

That reads `results/issuance.csv`, skips `results/verification.csv` and `results/revocation.csv` when they are absent, and writes `results/figures/gas_vs_cohort.png`.

Pass the inputs explicitly:

```bash
python3 scripts/plot_results.py \
  --issuance results/issuance.csv \
  --output results/figures/gas_vs_cohort.png
```

When those optional results exist:

```bash
python3 scripts/plot_results.py \
  --issuance results/issuance.csv \
  --verification results/verification.csv \
  --revocation results/revocation.csv \
  --output results/figures/gas_vs_cohort.png
```

A path passed with `--verification` or `--revocation` has to exist. Omitting the flag uses the default path above and continues when that file is missing.

Check the parser, including a temporary figure, without reading the benchmark CSV:

```bash
python3 scripts/test_plot_results.py
```

## Reproduce the issuance data and the figure

From the repository root:

```bash
npm install
npm test
npm run benchmark
python3 -m pip install matplotlib
python3 scripts/plot_results.py
python3 scripts/test_plot_results.py
```

`npm test` is the Hardhat contract suite. It does not run the gas benchmark. `npm run benchmark` overwrites `results/issuance.csv` for cohort sizes 1, 10, 100, and 1000. `results/*.csv` is gitignored; the issuance file in this tree was recorded from one local run.

## Roadmap

- Verification gas for valid and invalid credentials, for each architecture.
- Revocation gas, including a Merkle comparison of the per-leaf flag against rebuilding the tree and anchoring a new root.
- Calldata size, and a note on data-availability cost where a rollup would publish the batch.
- Repeated runs on the same configuration, then median and spread rather than a single sample.
- The same compiler settings on a post-Dencun Layer 1 testnet and on an EVM Layer 2.
- A short comparison of the measured curves with the architectural estimates cited in the paper (storage writes, soulbound mint overhead, and a flat Merkle root).

## License

MIT. See [LICENSE](LICENSE).
