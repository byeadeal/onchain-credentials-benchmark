# Team integration and research QA - 2026-11-13

Purpose: integrate reviewed evidence and report text without confusing workloads or editing teammates' contributions. The [report-ready verification section](./REPORT_READY_VERIFICATION_2026-11-13.md) supplies Adil's Methods/Results text. No merge, new PR, experiment rerun, dependency change or archived-result replacement was performed for this package.

## 1. Current branch and review snapshot

Remote metadata was fetched on 2026-11-13. Before this documentation package, the checkout was clean on `adil-work`, synchronized with its remote. Exact inspected revisions:

| Ref | Commit |
| --- | --- |
| Local `adil-work` and `origin/adil-work` | `322b06d1359e620c459c3c71f953178fbdefff28` |
| Local `main` and `origin/main` | `967ee598fb6b811423bd1ff9b6470841f4a4d432` |
| `origin/alikhan/results` | `c1b6fb23ac95965511cb23758f7c0b3916847f74` |
| `origin/azhar/revocation` | `0d865f1aaf722cb9b8265adeb2b2f870e6c78b2b` |

GitHub's open-PR collection returned one open PR: [#1, Issuance results and plots](https://github.com/byeadeal/onchain-credentials-benchmark/pull/1), head `alikhan/results`, base `main`, at the revision above. There was no open Adil or Azhar PR. This is a timestamped review snapshot, not a promise that remote refs will remain unchanged. The new documentation commit is identified by Git history after publication; it contains these two new documents and the context/worklog updates only.

## 2. Contribution inventory and ownership

| Owner, established by Adil's assignment | Reviewed contribution | Evidence and boundary |
| --- | --- | --- |
| Adil: verification/methodology | [Isolated implementation and 11 tests](../../experiments/adil/), [24-row estimate CSV](../../results/verification.csv), [60-sample archive](./evidence/verification-2026-11-13/full/), protocols/baseline/handoff and this QA package | Native verification only; archived six original tests also pass. Receipt and estimate data are separate. No shared contract/configuration/dependency edits. |
| Alikhan: issuance/results/plotting | [Issuance CSV](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c1b6fb23ac95965511cb23758f7c0b3916847f74/results/issuance.csv), [plotter](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c1b6fb23ac95965511cb23758f7c0b3916847f74/scripts/plot_results.py), [plotter tests](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c1b6fb23ac95965511cb23758f7c0b3916847f74/scripts/test_plot_results.py), [benchmark reporting changes](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c1b6fb23ac95965511cb23758f7c0b3916847f74/scripts/benchmark.ts), README and existing figure | Six changed paths relative to main. Issuance has 24 deploy/issue rows. Python tests/rendering were inspected, not executed in this QA package. |
| Azhar: revocation | [Revocation runner](https://github.com/byeadeal/onchain-credentials-benchmark/blob/0d865f1aaf722cb9b8265adeb2b2f870e6c78b2b/scripts/benchmarkRevocation.ts), [12-row CSV](https://github.com/byeadeal/onchain-credentials-benchmark/blob/0d865f1aaf722cb9b8265adeb2b2f870e6c78b2b/results/revocation.csv) | Two changed paths. Code sums N sequential native revocation receipts; setup is excluded. No equivalent raw-receipt/environment archive was found in this branch diff. |

The original [six lifecycle tests](../../test/) and shared contracts are existing team infrastructure, not newly authored Adil tests. Reference verification and state-growth evidence have no established individual owner in the inspected assignment; the team must agree ownership if pursuing them.

## 3. Independent evidence checks

The read-only numerical/cryptographic audit completed at 2026-11-13 08:26:10 UTC using the existing Node/ethers environment. It independently recomputed inputs/proofs rather than importing the benchmark's measurement helper.

- All 60 structured measurements agree with the 60 detailed CSV rows and 60 unique raw transaction/receipt pairs. Reconstructed EIP-1559 signed transaction hashes and recovered senders match the archive; ABI-decoded arguments match the deterministic scenarios.
- Independently recomputed credential hashes, tree roots and sorted-pair proof folding agree for all 20 measured Merkle calls. Valid queries include the original leaf; invalid queries substitute a nonmember while preserving the selected proof.
- All 24 team rows equal the index-0 `gas_estimate` observations; all 60 separately collected estimates equal receipt gas. Calldata byte counts and gas-limit/intrinsic-bound checks pass. Registry and token small differences described in the report are consistent with independently counted zero/nonzero bytes.
- All 15 full-run source hashes and six metadata-listed artifact hashes match. Static pre/post booleans and state checks agree; all measured receipts have status 1. The 16 extra correctness checks return false as expected.
- The retained final command records show exit 0 for typechecking, 11 Adil tests, six original tests and both saved-run validators. These are checked archived outcomes, not a fresh test run. No implementation drift was found to justify rerunning experiments or suites.

Limits: a matching signed transaction hash does not independently authenticate its receipt's block inclusion or reproduce its gas usage. The local ephemeral chain was not reconstructed. This audit strengthens internal consistency, not statistical replication or public-network validation. The original [baseline CSV validation](./evidence/csv-validation.json) remains intact.

## 4. Compatibility decisions and exact recommended resolutions

All datasets use `hash_registry`, `soulbound`, `merkle_anchor` and N = 1, 10, 100, 1000. Matching names and cohorts do not establish matching metrics:

| Dataset | Meaning of saved gas | Transaction count / denominator | Required report/figure interpretation |
| --- | --- | --- | --- |
| Alikhan issuance | `total_gas`: mined cohort total for issue; one receipt for deploy | Issue: N transactions for registry/token, one anchor for Merkle. `gas_per_credential` is integer floor(total/N); deployment average blank | Distinguish deploy, total issuance and amortized issuance. Merkle off-chain preparation/distribution excluded. |
| Adil verification | `gas`: actual estimate for one index-0 query, valid or invalid | One simulated query per row; detailed archive separately contains sampled mined transactions | Label `eth_estimateGas`, selected position 0, gas units/query. Not a cohort total, mean or trial average. |
| Azhar revocation | `gas`: sum of N mined receipt `gasUsed` values | N sequential transactions on distinct prepared credentials | Label total gas to revoke N credentials sequentially. Not one revoke, one atomic batch or root replacement. |

### Findings requiring an explicit resolution

1. **Deployment mismatch, confined to Merkle setup.** Alikhan records 332,327 deployment gas at every N; [Adil's November 6 baseline](./baseline-report.md) records 332,315: **+12 gas in each of four rows**. All 12 issuance totals match exactly; registry/token deployment totals also match, so 20 of 24 total-gas rows agree. Preserve both named runs. Alikhan's issuance dataset can remain the canonical figure input if the team agrees, but do not claim exact deployment replication. Compare retained build-info/creation bytecode and transaction inputs/runtime if available; the cause is unverified. Do not average away or silently edit the difference.
2. **Runtime provenance is incomplete across workstreams.** Nine shared files (three contracts, three helpers, Hardhat configuration, package manifest and lockfile) have identical Git blobs across the four inspected revisions. The configured compiler is 0.8.28, optimizer 200, target Cancun. This does not prove identical installed dependencies, build outputs or execution hardforks during teammates' runs. Alikhan's CSV records compiler/optimizer/target and a Hardhat label; Azhar's four-column CSV has no environment/timestamp metadata. Obtain actual retained runtime/build records if available; otherwise explicitly disclose missing provenance and qualify cross-run comparisons. Do not infer Cancun runtime from `evm_version=cancun` or assert Osaka for runs without records.
3. **Figure provenance and denominators need captions.** Alikhan's verification panel correctly labels `eth_estimateGas` and distinguishes it from mined receipts. Keep Adil's detailed receipt series out of that input. Add the supplied index-0 caption. The revocation panel's `receipt gasUsed` label needs a caption explicitly saying summed N sequential transactions. The figure's metadata footer is built from issuance rows only: describe it as issuance metadata, not verified common runtime provenance. Separate panels and explicit units are acceptable; a shared numerical ranking of these different workloads is not.
4. **Native semantics need joint wording.** The token predicate checks existence/lock, not an expected academic hash or presenter identity. Merkle revocation writes a global per-leaf flag without rebuilding a tree; registry marks status and token revocation burns. Azhar's runner uses each cohort target once after preparation, so it does not reuse already-revoked credentials. Its Merkle series is not re-anchoring or an atomic batch. Retain these definitions in Methods and Discussion; do not normalize them into an unmeasured common predicate.

**Issuance runner review:** Alikhan's changes to the [shared benchmark](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c1b6fb23ac95965511cb23758f7c0b3916847f74/scripts/benchmark.ts) add comments and console reporting. An AST comparison after removing comments and console-log expression statements found identical executable deployment/measurement/CSV logic. No benchmark-method change was identified there; those reporting edits do not establish a cause for the 12-gas deployment discrepancy.

## 5. Safe integration sequence and commands

1. Team reviews the snapshot/diffs and agrees metric definitions, provenance disclosures and canonical figure inputs.
2. Authorized integrator reviews Alikhan's existing PR first, bringing in issuance data and the plotter/test framework.
3. Review and integrate Adil's verification contribution and this documentation, then Azhar's revocation contribution. The latter two may be exchanged by agreement; both need the plotting inputs/labels reviewed.
4. On the approved integrated checkout, run existing tests and render a fresh candidate figure in the established plotting environment. Inspect all panels/captions before using the image in the paper.

No merges are performed or authorized by this document. At the inspected revisions, changed-path sets from their common main are pairwise disjoint. No branch changes the shared contracts, dependencies or Hardhat configuration; Alikhan does change the shared issuance runner's reporting. Disjoint paths reduce filename-conflict risk but do not prove a merge has succeeded or settle scientific compatibility. Refresh reviews if any ref moves.

Read-only review commands, from the repository root in PowerShell:

```powershell
git status --short --branch
git fetch origin
git for-each-ref --format='%(refname:short) %(objectname)' refs/heads refs/remotes/origin
git rev-list --left-right --count HEAD...origin/adil-work
git diff --name-status origin/main...origin/alikhan/results
git diff --name-status origin/main...origin/adil-work
git diff --name-status origin/main...origin/azhar/revocation
git diff --check origin/main...origin/alikhan/results
git diff --check origin/main...origin/adil-work
git diff --check origin/main...origin/azhar/revocation
git diff origin/main...origin/alikhan/results -- scripts/benchmark.ts hardhat.config.ts package.json package-lock.json contracts scripts/lib
git show origin/azhar/revocation:scripts/benchmarkRevocation.ts
git show origin/azhar/revocation:results/revocation.csv
```

Available Adil/source checks on a checkout containing the contribution (these commands are provided for review, not newly executed here):

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --project experiments/adil/tsconfig.json
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat test
npm.cmd test
node -r ts-node/register experiments/adil/validate-run.ts docs/adil/evidence/verification-2026-11-13/full
```

After approved integration, in the team's existing Python plotting environment, run the following. Confirm the candidate output path is absent first; use a new path if it already exists. No installation or benchmark rerun is required by these instructions.

```powershell
python -m unittest discover -s scripts -p test_plot_results.py
python scripts/plot_results.py --issuance results/issuance.csv --verification results/verification.csv --revocation results/revocation.csv --output docs/adil/evidence/meeting-2026-11-13/gas_vs_cohort-candidate.png
```

The plotter and revocation files are not present in the inspected Adil checkout. Running these prematurely would not validate the integrated repository. Do not run issuance/revocation scripts merely to draw the figure: they overwrite their result paths. Preserve all original CSVs/evidence and make any repetition a separately identified run.

## 6. Report assembly and priorities

| Report section | Existing usable evidence | Required boundary |
| --- | --- | --- |
| Methods | [Protocol](./experiment-protocol.md), [verification Methods](./REPORT_READY_VERIFICATION_2026-11-13.md#a-experimental-methodology), runners and actual metadata | Describe performed workloads; the [extension plan](./benchmark-extension-plan.md) is proposed historical design, not executed methodology. |
| Results | Three owned CSVs above, [verification table](./REPORT_READY_VERIFICATION_2026-11-13.md#b-results), [baseline](./baseline-report.md) | Separate estimates, receipt totals, amortized costs and setup; retain named-run deployment difference. |
| Discussion | Native contract predicates, tree helper, revocation runner and sampled proof lengths | Compare guarantees and included work before costs; no universal ranking or token/content identity claim. |
| Limitations | [Verification limitations](./REPORT_READY_VERIFICATION_2026-11-13.md#e-limitations-and-threats-to-validity), baseline and provenance findings above | Single run, synthetic inputs, sample positions, runtime/Node qualifications, unmeasured off-chain/state-growth costs. |
| Conclusion | Observed issuance totals and native verification/revocation trends | Restrict conclusions to measured implementations/workloads. State-bloat dynamics in the working title are not yet empirical findings. |

**Must fix before submission:** resolve misleading units/denominators/captions; choose and identify canonical run inputs; remove claims of identical runtime without evidence; disclose the deployment difference; remove unsupported equivalence, statistical, identity or measured state-growth claims; verify cited original sources or remove/mark unsupported citation-dependent claims. These can largely be wording/provenance resolutions rather than new experiments.

**Important qualifications that can be disclosed:** one local run, deterministic sampling, synthetic inputs, unequal predicates, proof/calldata dependence, excluded setup/off-chain costs, Cancun target versus recorded Osaka execution, unsupported Node 26 range, missing teammate runtime provenance, and no independent receipt re-execution.

**Optional future improvements:** supported-runtime replicated runs with fresh archives, broader random/stratified proof positions, extra invalid/unknown cases, common-predicate identity/content checks, full off-chain accounting, state-growth measurement and root-rebuild revocation. These require appropriate ownership/methodology agreement; they are not prerequisites for honestly reporting the present limited experiment.

**References:** existing academic references remain **UNVERIFIED**. No external references were validated in this package. Use explicit citation-needed placeholders during drafting; the submitted bibliography and claims must refer to checked original sources. Do not describe standards compliance or literature novelty as established from contract comments alone.

## 7. Meeting speaking notes (approximately 60-90 seconds)

> My verification contribution is pushed and has 17 passing tests in the saved validation record. I measured the native functions for cohorts of 1, 10, 100 and 1000, using deterministic first, middle and last positions. We have 60 mined transaction samples and a separate 24-row plotting CSV containing index-zero gas estimates. Every estimate matched its corresponding receipt in this local run, and the independent audit checked signed transaction hashes, inputs, proofs and CSV arithmetic.
>
> Registry and token-status costs changed little across cohort sizes; Merkle costs increased as the selected proof grew. These are different guarantees: a token-status check does not validate academic content or student identity. Our verification plot is per query, while issuance and revocation report cohort workloads; revocation is N sequential transactions.
>
> Before integrating, we need to agree captions, canonical datasets and runtime disclosures. All issuance totals match the earlier baseline, but Merkle deployment differs by 12 gas. The branches currently have no overlapping changed paths. We can review the existing issuance PR, then verification and revocation, test the integrated checkout and generate the final labelled figure. References and any state-growth claims still need evidence.

## 8. Final meeting acceptance checklist

- [ ] Recheck refs/PR state and review all changes since the snapshot; authorized integrator chosen.
- [ ] All three researchers agree operation meanings, denominators, runtime qualifications and canonical CSV run identities.
- [ ] Three architecture names and all four cohort sizes retained; no duplicate/missing architecture/cohort/scenario rows.
- [ ] Verification input remains the 24 index-0 estimates; detailed receipts remain separately labelled and archived.
- [ ] Issuance distinguishes deploy/total/amortized gas and transaction counts; Merkle +12-gas setup discrepancy disclosed or resolved with evidence.
- [ ] Revocation caption states total of N sequential native transactions, with setup excluded and no root rebuild.
- [ ] Final figure labels and issuance-only metadata footer do not imply shared units or unrecorded common runtime settings.
- [ ] Approved integrated checkout passes the original six tests, Adil's 11 tests/typecheck/saved-run validator and plotter tests; candidate figure visually reviewed.
- [ ] Methods describe actual runs only; conclusions avoid identity equivalence, statistical generalization, universal superiority and unmeasured state-growth findings.
- [ ] Submitted references checked against original sources; unsupported citation-dependent statements removed or revised.
- [ ] Original evidence preserved, final report/figure provenance recorded, and each researcher approves the interpretation of their contribution.
