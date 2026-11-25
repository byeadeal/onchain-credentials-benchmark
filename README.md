# On-chain student credentials benchmark

This repository benchmarks three EVM student-credential architectures using local Hardhat experiments. The research project is *Scaling the Cost of On-Chain Student Credentials: Architectural Trade-Offs, Empirical Benchmarks, and State Bloat Dynamics* by Azhar Tashmetova, Alikhan Baiadil, and Adilzhan Oryngali (Nazarbayev University).

The repository includes issuance, verification, and revocation measurements for cohort sizes 1, 10, 100, and 1000. They use synthetic credentials on a local Hardhat network. The recorded results are single runs and require the methodological qualifications described below.

## Architectures

1. **HashRegistry.** One storage record per credential hash. Issuance and revocation update its status, and verification reads it. Revocation keeps the slot and flips the status.
2. **SoulboundCredential.** An ERC-721 credential minted to the student. Transfers and approvals revert, and the token is marked locked (in the spirit of ERC-4973, ERC-5192, and ERC-5484, not a full implementation of those standards). Revocation burns the token.
3. **MerkleCredentialAnchor.** The cohort is hashed off-chain into a sorted-pair Merkle tree. Leaves are hashed once more before they enter the tree. The contract stores one root per batch and refuses to replace it. Revocation is one flag per leaf, shared by every batch.

The experiments derive credential hashes from the same payload (`NU-BSc-2026`, cohort size, index). Native verification checks differ: the registry checks a hash's status, the soulbound contract checks whether a token exists, and the Merkle contract checks inclusion and the leaf's revocation flag. These are not equivalent end-to-end identity or academic-content checks.

## Layout

```
contracts/    HashRegistry, SoulboundCredential, MerkleCredentialAnchor
test/         lifecycle tests for issue, verify, and revoke
scripts/      issuance and revocation benchmarks, results plot, and shared helpers
experiments/adil/  verification benchmark, validator, and isolated tests
docs/adil/    verification documentation and archived evidence
docs/azhar/   revocation methodology
results/      benchmark CSVs, earlier archived CSVs, environment, and figures
```

Solidity is pinned to **0.8.28** with the optimizer on (200 runs) and the Cancun EVM. The Hardhat network hardfork is also Cancun. Those settings live in `scripts/lib/settings.ts` and `hardhat.config.ts`.

## Requirements

Node.js 20, 22, or 24 is supported by the installed Hardhat version. The recorded combined run used Node.js 22.23.5. Plotting requires Python 3.11 or newer and the packages in `requirements-plot.txt`.

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

### Verification and revocation

The verification benchmark prepares fresh credentials and samples the distinct positions 0, floor(N/2), and N-1 for valid and invalid queries. It records separate `eth_estimateGas` values and mined transaction receipts, excluding setup and off-chain proof construction. The plotting CSV selects index 0; the [detailed evidence](docs/adil/evidence/verification-2026-11-25T00-27-21-185Z/) contains the other samples, proof lengths, calldata sizes, and receipts. The runner requires Windows, the `adil-work` branch, and a local Hardhat network. It creates a new evidence directory and preserves the existing team CSV unless explicitly configured to publish.

```powershell
npx hardhat --config experiments/adil/hardhat.config.ts test
npx hardhat --config experiments/adil/hardhat.config.ts run experiments/adil/run-verification.ts
```

The revocation benchmark prepares a fresh cohort and sums N individual revocation receipts. It excludes setup and uses a per-leaf flag for Merkle revocation. This command overwrites `results/revocation.csv`; preserve the existing file before running it. See [revocation methodology](docs/azhar/revocation-measurement.md).

```bash
npx hardhat run scripts/benchmarkRevocation.ts
```

The committed results were produced in one GitHub Actions run with Node.js 22 and Cancun execution. [Environment details](results/environment.txt) identify the source commit and run; [results/archive/](results/archive/) retains earlier CSVs. Verification estimates per query, issuance totals, and sequential cohort revocation totals measure different workloads.

## Plot

`scripts/plot_results.py` draws gas against cohort size. It does not measure gas. Deployment, total issuance, and per-credential issuance are separate panels, all from receipt `gasUsed`. The per-credential panel plots the CSV's `floor(total_gas / cohort_size)` column. It does not plot `eth_estimateGas`, and it does not add deployment into the issuance series.

The same script can add panels from optional CSVs. A file that is not there is skipped. Missing rows are not drawn as zeros.

Verification (`results/verification.csv`) uses scenarios `valid` and `invalid`. Its `gas` column is `eth_estimateGas`. That is the four-column file, including the compatibility export that stores one estimate per architecture, cohort size, and scenario. A detailed evidence table that has `receipt_gas` and `gas_estimate` instead of `gas` is not an input. Receipt gas from that table is not copied into the verification panel.

Revocation (`results/revocation.csv`) uses scenario `revoke`. Its `gas` column is receipt `gasUsed` as recorded. The revocation benchmark stores the sum of the cohort's revoke receipts in that cell. The plot draws the cell. It does not divide it by cohort size, and it does not treat it as `eth_estimateGas`.

Both optional files use this header. Extra columns are ignored. One row per architecture, cohort size, and scenario:

```text
architecture,cohort_size,scenario,gas
```

`architecture` is `hash_registry`, `soulbound`, or `merkle_anchor`.

Plotting uses Python 3.11 or newer and the packages in `requirements-plot.txt`. From the repository root:

```bash
python3 -m pip install -r requirements-plot.txt
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
npm ci
npm test
npx hardhat run scripts/benchmark.ts
python3 -m pip install -r requirements-plot.txt
python3 scripts/test_plot_results.py
python3 scripts/plot_results.py
```

`npm test` is the Hardhat contract suite. It does not run the gas benchmark. `npx hardhat run scripts/benchmark.ts` is the same command as `npm run benchmark`. It overwrites `results/issuance.csv` for cohort sizes 1, 10, 100, and 1000, including `recorded_at`; preserve the current file before running it. New files matching `results/*.csv` are gitignored.

## Roadmap

- Compare Merkle per-leaf revocation against rebuilding the tree and anchoring a new root.
- Account for data-availability cost where a rollup would publish the batch.
- Repeated runs on the same configuration, then median and spread rather than a single sample.
- The same compiler settings on a post-Dencun Layer 1 testnet and on an EVM Layer 2.
- A short comparison of the measured curves with the architectural estimates cited in the paper (storage writes, soulbound mint overhead, and a flat Merkle root).

## License

MIT. See [LICENSE](LICENSE).
