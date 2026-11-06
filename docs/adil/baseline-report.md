# Baseline reproduction report — Adil

Date: 2026-11-06. Source commit: `967ee598fb6b811423bd1ff9b6470841f4a4d432`. Branch: `adil-work`.

The existing six tests passed. The unmodified issuance benchmark completed for **1, 10, 100 and 1000** students. All **24 CSV rows** passed consistency checks. These are newly reproduced local measurements, not results from the paper or earlier observations. All existing academic citations and research-gap claims remain **UNVERIFIED**.

## 1. Git state and scope

The working tree was clean on `adil-work` before this package. `main` was not checked out or changed. There were no existing files under `docs/adil/` and no benchmark CSVs; `results/` contained only its tracked placeholder. No earlier measurements were overwritten.

The existing script necessarily writes `results/issuance.csv`. After each successful invocation, that newly generated file was moved intact to a unique file under [evidence/](./evidence/), before another invocation could overwrite it. The original results-directory contents were restored by moving the generated output; no existing file was removed. The shared script was not edited to redirect output.

A before/after SHA-256 inventory verifies file contents outside `docs/adil/`, including tracked files and existing generated artifacts/cache/types, excluding `.git` and `node_modules`. The final [scope check](./evidence/scope-verification.json) records the result. No dependency command, install, compiler-setting change, feature implementation, commit, push, merge, or deployment to an external network was performed. Ordinary local simulated deployments were performed by the existing tests and benchmark.

## 2. Reproducibility settings

| Item | Observed value |
| --- | --- |
| Node.js / npm | `v26.13.0` / `11.20.0` |
| Hardhat / toolbox | `2.29.1` / `6.1.2` |
| OpenZeppelin / ethers | `5.6.1` / `6.17.0` |
| TypeScript / ts-node | `5.9.3` / `10.9.2` |
| Solidity build | `0.8.28+commit.7893614a` |
| Optimizer | Enabled; 200 runs |
| Compiler EVM target | Cancun |
| Execution hardfork | **Osaka**, resolved Hardhat default; not pinned in shared configuration |
| Network | In-process `hardhat`, chain ID 31337, no configured fork |
| Mining / block gas limit | Auto, interval 0 / 60,000,000 |
| RPC client string | `HardhatNetwork/2.29.1/@nomicfoundation/edr/0.3.8` |
| Host | Windows `10.0.26200`, x64 |
| Time zone | `Asia/Qyzylorda`; evidence timestamps use UTC |
| Source commit | `967ee598fb6b811423bd1ff9b6470841f4a4d432` |
| Package-lock SHA-256 | `bbe232d92e7fc77abc02d775615ccf5357c94ec2d8bdae706d3058c0f80ccae9` |

[Environment evidence](./evidence/environment.json) records the resolved configuration and installed versions. [Compiled-source verification](./evidence/compiled-source-verification.json) confirms all build-input sources, including imported installed dependencies, match the existing build. The initial environment snapshot resolves repository paths directly; the separate verification also resolves library imports under `node_modules`. The normal test/benchmark commands enabled Hardhat's compilation check, but reused matching cached outputs. This was not a clean build or dependency installation.

Node 26 is outside the installed Hardhat version's declared `^20`, `^22`, `^24` support ranges. Its CLI suppresses warnings for newer even-numbered Node versions. Successful local execution does not certify that runtime combination. Cancun in the CSV is the compiler target, not the execution hardfork; this distinction is material when comparing future gas measurements.

## 3. Commands and timing

Commands ran from the repository root using the existing npm scripts. `npm.cmd` selects the Windows npm launcher without changing PowerShell execution policy. `COHORT_SIZES` was supplied only to the benchmark child process; the parent environment was not modified. `HARDHAT_NETWORK` was unset; the resolved default was verified as local `hardhat`.

| Command | Child environment | UTC start | UTC finish | Exit |
| --- | --- | --- | --- | --- |
| `npm.cmd test` | No cohort override | 2026-11-06 13:08:05.748 | 2026-11-06 13:08:08.358 | 0 |
| `npm.cmd run benchmark` | `COHORT_SIZES=1,10,100` | 2026-11-06 13:08:19.615 | 2026-11-06 13:08:23.758 | 0 |
| `npm.cmd run benchmark` | `COHORT_SIZES=1000` | 2026-11-06 13:08:37.998 | 2026-11-06 13:08:44.434 | 0 |

CSV recording times are `2026-11-06T13:08:23.681Z` and `2026-11-06T13:08:44.303Z`. These are file-generation times near the end of each invocation, not individual transaction timestamps. There were no test or benchmark command failures in this package. The 1000-student attempt followed successful completion of the smaller cohorts.

For reproduction on the same installed environment, run the three commands above with their listed cohort overrides. The Windows PowerShell equivalent is `$env:COHORT_SIZES='1,10,100'` followed by `npm.cmd run benchmark`, then change the override to `'1000'` for the second invocation. Preserve any existing output before running, archive each new CSV before the next run, and restore the previous environment value afterward if using that interactive form. Use a new evidence directory; do not overwrite the files attached to this report. A clean-install reproduction is separate work requiring dependency-install authorization.

Each architecture/cohort pair has a new deployment. Cohorts 1, 10 and 100 share one invocation's chain; cohort 1000 starts another. There are no repeated trials. Elapsed command time includes process startup and compilation checks and is not measured issuance latency.

## 4. Test outcome

**6 passing**, reported test duration 711 ms; exit code 0. [Raw output](./evidence/tests.txt) and [timing/exit metadata](./evidence/test-run.json) are retained. There are two lifecycle/negative-path tests per architecture. They cover the assertions listed in the [protocol](./experiment-protocol.md#3-what-exists-and-what-the-six-tests-establish); they do not establish full access-control coverage, all transfer paths, root-replacement correctness, or benchmark correctness.

## 5. Actual deployment results

Deployment is a distinct operation with one transaction per fresh contract. Each value below was observed at all four cohort sizes; it is not an average across repeated trials.

| Architecture / CSV label | Deployment gas | Transactions per deployment |
| --- | ---: | ---: |
| HashRegistry / `hash_registry` | 276,954 | 1 |
| SoulboundCredential / `soulbound` | 1,084,575 | 1 |
| MerkleCredentialAnchor / `merkle_anchor` | 332,315 | 1 |

## 6. Actual issuance results

Totals below exclude deployment and include receipt gas for every issuance transaction. The final column reproduces the CSV's **integer truncation**, not a rounded fractional mean. Merkle rows measure root anchoring, with off-chain leaf/tree/proof work excluded.

| N | Architecture | Total issuance gas | Issuance transactions | CSV gas per credential |
| ---: | --- | ---: | ---: | ---: |
| 1 | HashRegistry | 47,895 | 1 | 47,895 |
| 1 | SoulboundCredential | 139,397 | 1 | 139,397 |
| 1 | MerkleCredentialAnchor | 70,037 | 1 | 70,037 |
| 10 | HashRegistry | 478,902 | 10 | 47,890 |
| 10 | SoulboundCredential | 1,240,022 | 10 | 124,002 |
| 10 | MerkleCredentialAnchor | 70,037 | 1 | 7,003 |
| 100 | HashRegistry | 4,789,368 | 100 | 47,893 |
| 100 | SoulboundCredential | 12,454,168 | 100 | 124,541 |
| 100 | MerkleCredentialAnchor | 70,037 | 1 | 700 |
| 1000 | HashRegistry | 47,893,320 | 1000 | 47,893 |
| 1000 | SoulboundCredential | 124,776,324 | 1000 | 124,776 |
| 1000 | MerkleCredentialAnchor | 70,049 | 1 | 70 |

For example, `478902 / 10 = 47890.2`, stored as `47890`; `70037 / 100 = 700.37`, stored as `700`. The exact Merkle average at N=1000 is `70.049`, while the CSV reports `70`. Deployment averages are blank. Totals, rather than the truncated average, are the authoritative data.

The Merkle anchor is almost constant in this run, rather than exactly constant. An off-chain reconstruction of its ABI input found 68 bytes at every N, with 37 nonzero bytes for N=1/10/100 and 38 for N=1000. The extra nonzero byte in batch ID 1000 is consistent with the observed 12-gas increase under the standard calldata schedule. This is a source/input-based explanation, not a transaction-trace attribution. See [anchor-input-analysis.json](./evidence/anchor-input-analysis.json); no extra on-chain measurement was performed. Calldata byte values affect gas as described in [EIP-7623](https://eips.ethereum.org/EIPS/eip-7623).

The N=1000 soulbound total exceeds the configured block gas limit because it sums 1000 separate transactions; the harness does not attempt a single transaction containing the whole cohort. Across all cohorts, the expected harness transaction count is 2,238: 12 deployments plus 2,226 issuance transactions. This is derived from row counts, not an independently archived receipt census.

## 7. CSV validation and evidence

[Validation evidence](./evidence/csv-validation.json) records **PASS** for 18 rows from the first invocation and 6 from the second. Checks included exact schema/column count, unique and complete architecture × cohort × operation coverage, permitted labels, positive integer totals, one deployment transaction, N registry/token issuance transactions, one Merkle issuance transaction, compiler/optimizer/EVM/network fields, timestamps within each run, blank deployment averages, `BigInt(totalGas) / BigInt(N)` for issue rows, and agreement with console totals. Deployment gas is identical across the four observed cohort sizes for each architecture.

| Preserved CSV | Rows | SHA-256 |
| --- | ---: | --- |
| [issuance-1-10-100.csv](./evidence/issuance-1-10-100.csv) | 18 | `b658d8933f3b1c853d8610477afc1eced97fb6f948f4794b57308b78fb4b4d2b` |
| [issuance-1000.csv](./evidence/issuance-1000.csv) | 6 | `280563503a4014365342c7354d2a18703692a93884db7b3403ea4ec19352e9d3` |

The shared script obtains gas totals from receipts, but does not persist transaction hashes, individual receipts, or a chain snapshot. The ephemeral processes have ended. CSV/console agreement is therefore an internal consistency check; it is **not independent receipt replay**. Transaction counts were checked against the harness loops and expected grid, not recovered independently from a saved chain. No verification, revocation, calldata-cost breakdown, off-chain timings, or state-growth measurements are claimed.

## 8. Three priorities before extending experiments

1. **Agree on equivalent outcomes.** Native soulbound verification checks token existence/lock, not an expected hash or student. Registry status, token burn, and a global Merkle leaf flag have different revocation/reissue semantics. Root replacement must have an explicit policy.
2. **Fix execution and input controls.** Explicitly choose the runtime hardfork independently of the Cancun compiler target, use an agreed supported Node runtime, and define realistic recipients. The present numeric recipients overlap precompiles; OpenZeppelin's safe mint checks recipient code, so warm-address behavior can bias comparisons. Its magnitude was not isolated here. Any change requires a separately labelled run and the relevant shared-scope approval.
3. **Fix measurement boundaries and evidence.** Choose receipt-based verification versus estimates, distinguish success/invalid early-return cases and proof lengths, separate calldata/DA and off-chain work, retain raw transaction evidence, and predefine trials/statistics. Preserve exact totals and avoid overwriting outputs or hardcoding network identities in future datasets.

The [protocol](./experiment-protocol.md) details these decisions and validity threats. This baseline supports statements about the cost of these specific local implementations under the recorded conditions. It does not establish end-to-end equivalence, security, standards compliance, production pricing, rollup cost, statistically stable effects, or universal architectural superiority.

## 9. Created-file inventory

All new deliverables and evidence are within `docs/adil/`:

- [experiment-protocol.md](./experiment-protocol.md)
- [baseline-report.md](./baseline-report.md)
- [evidence/initial-inventory.json](./evidence/initial-inventory.json)
- [evidence/environment.json](./evidence/environment.json)
- [evidence/compiled-source-verification.json](./evidence/compiled-source-verification.json)
- [evidence/test-run.json](./evidence/test-run.json)
- [evidence/tests.txt](./evidence/tests.txt)
- [evidence/run-1-10-100.json](./evidence/run-1-10-100.json)
- [evidence/benchmark-1-10-100.txt](./evidence/benchmark-1-10-100.txt)
- [evidence/issuance-1-10-100.csv](./evidence/issuance-1-10-100.csv)
- [evidence/run-1000.json](./evidence/run-1000.json)
- [evidence/benchmark-1000.txt](./evidence/benchmark-1000.txt)
- [evidence/issuance-1000.csv](./evidence/issuance-1000.csv)
- [evidence/csv-validation.json](./evidence/csv-validation.json)
- [evidence/anchor-input-analysis.json](./evidence/anchor-input-analysis.json)
- [evidence/scope-verification.json](./evidence/scope-verification.json)

No unexpected repository changes were found. No work was committed or pushed.
