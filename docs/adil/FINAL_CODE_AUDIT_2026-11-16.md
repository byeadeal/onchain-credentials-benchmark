# Final code and research audit - 2026-11-16

**Verdict: the implementations pass the executed checks, but the repository is not yet a unified, fully reproduced submission package.** Resolve the integration, final presentation and claim/provenance gates below. No new benchmark functionality is required. No failure of a measured native operation was found in the available tests or Adil's saved evidence.

This audit started read-only on clean `adil-work`. Git fetch and branch/PR inspection were followed by tests in temporary Git-source exports. A temporary review assembly copied the pairwise-disjoint changed paths onto a main export; it was not a Git merge and changed no branch. Only this report and Adil's context/worklog are new or updated in the working repository. No source, dependency, configuration, CSV, archived evidence, commit, push or PR was changed or created.

## Audited revisions and execution boundary

Remote refs were refreshed on November 16; a final fetch at approximately 07:27 UTC left these revisions unchanged:

| Ref | Commit | Integration state relative to current main |
| --- | --- | --- |
| `origin/main` and local `main` | `967ee598fb6b811423bd1ff9b6470841f4a4d432` | Original contracts, six tests and issuance runner; none of the three later contributions integrated |
| `origin/adil-work` and local `adil-work` | `3bc7348339524826a1060329651cc72f6cfd79e4` | Verification implementation/evidence/docs; implementation commit `322b06d1359e620c459c3c71f953178fbdefff28`; 59 changed paths from main |
| `origin/alikhan/results` | `c07c18ef1d62271c9e8398bf60128caac93b2a6c` | Issuance results, plotter/tests, README and plotting requirements; seven changed paths |
| `origin/azhar/revocation` | `758dd186f74346c31bbd02a9ef870894761fb9e9` | Revocation runner/results, three new tests, methodology and manifest updates; six changed paths |

The direct GitHub open-PR collection lists only [PR #1, issuance results and plots](https://github.com/byeadeal/onchain-credentials-benchmark/pull/1), head Alikhan's revision above, base main. No open Adil/Azhar PR was listed. No PR checks or merge approval are implied by this audit. The November 13 meeting document is historical; its teammate revision identifiers and nine-identical-shared-files statement must not be reused as the current snapshot.

Actual audit environment: Windows; Node 26.13.0; npm 11.20.0; Hardhat 2.29.1; ethers 6.17.0; OpenZeppelin 5.6.1; TypeScript 5.9.3; ts-node 10.9.2; Python 3.13.0. Fresh exports compiled 20 Solidity sources with Solidity 0.8.28, optimizer enabled/200, Cancun target. Direct configuration inspection resolved the local shared Hardhat network to chain 31337 and **Osaka execution**. Adil's isolated configuration explicitly selects the same hardfork. This current observation does not establish the unrecorded historical runtime of another researcher's run.

Exports reused the existing installed Node dependencies and compiler download cache, while generating fresh compilation artifacts in temporary directories. Neither `npm ci` nor any Python dependency installation was performed. Therefore this is a clean-source test, not a verified fresh dependency installation or full clean-clone reproduction of every result and figure. No historical gas series was rerun or overwritten.

## PASS - verified and ready within stated boundaries

### Executed tests and validation

| Check and exact command, run from the corresponding exported repository root | Actual outcome |
| --- | --- |
| Main: `npm.cmd test` | Exit 0; fresh compilation; **6 passing** |
| Azhar: `npm.cmd test` | Exit 0; fresh compilation; **9 passing**, comprising six originals plus three revocation-isolation tests |
| Adil: `node_modules/.bin/hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat test` | Exit 0; fresh compilation; **11 passing** |
| Main and Azhar: `node_modules/.bin/tsc.cmd --noEmit` | Exit 0 on each export after compilation |
| Adil: `node_modules/.bin/tsc.cmd --noEmit --project experiments/adil/tsconfig.json` | Exit 0 |
| Adil: `node -r ts-node/register experiments/adil/validate-run.ts docs/adil/evidence/verification-2026-11-13/pilot` | Exit 0; **24 receipts / 12 estimate rows** |
| Adil: same validator with final path `docs/adil/evidence/verification-2026-11-13/full` | Exit 0; **60 receipts / 24 estimate rows** |
| Review assembly: `npm.cmd test`, followed by the isolated Adil test command | Exit 0 for both; **9 + 11 = 20 distinct tests** |
| Review assembly: both root and isolated TypeScript checks above | Exit 0 for both |
| Alikhan: `python scripts/test_plot_results.py`, using the configured absolute Python 3.13 interpreter | **11 passed, 1 skipped**; 12 discovered, exit 0. Rendering skipped because Matplotlib is absent |
| Review assembly: load all three real CSVs with the plotter's loaders, assemble and build panels, assert grids/series | Exit 0; **24 issuance + 24 verification + 12 revocation rows**, five panels, no coverage notes |
| Explicit combined render with all three CSV flags and a fresh temporary output path | **Not passed:** exit 1, Matplotlib required. No candidate image was produced |

These counts describe overlapping branch checks as well as one assembled test tree. Do not add every run into a fictitious number of distinct tests. Ordinary `npm test` discovers the root tests; it does not discover Adil's isolated test directory.

### Code, data and scientific accounting

- **Issuance:** [Alikhan's runner](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/scripts/benchmark.ts) sums actual mined receipt gas. Deployment and issuance are separate. Registry/token issuance sends N transactions; Merkle issuance is one anchored root. All 24 rows of [his CSV](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/results/issuance.csv) have valid architecture/cohort/operation grids, positive totals, expected transaction counts and correct floor(total/N) issue-only arithmetic. Executable measurement/CSV logic is unchanged from the original runner; edits are reporting/comments.
- **Verification:** [measurement code](../../experiments/adil/verification.ts), [11 tests](../../experiments/adil/test/verification.ts), [team CSV](../../results/verification.csv) and [full archive](./evidence/verification-2026-11-13/full/) agree. An independent read-only audit reconstructed all **60 signed EIP-1559 transaction hashes and senders**, decoded inputs, independently generated fixture hashes/tree roots and checked proof folding for all **20 measured Merkle calls**. The 24 team values are exactly index-0 estimates. All 60 independently collected estimates equal their separate receipt values. All **15 source hashes and six archived-output hashes** match. This establishes internal consistency, not independent block inclusion, receipt re-execution or statistical replication.
- **Revocation:** [Azhar's runner](https://github.com/byeadeal/onchain-credentials-benchmark/blob/758dd186f74346c31bbd02a9ef870894761fb9e9/scripts/benchmarkRevocation.ts) prepares a fresh fully issued/minted/anchored cohort, then sums **N sequential receipts for distinct targets**. Setup, pre/post verification reads and off-chain tree work are excluded. Merkle leaves are flagged individually, not removed through root replacement. The [12-row CSV](https://github.com/byeadeal/onchain-credentials-benchmark/blob/758dd186f74346c31bbd02a9ef870894761fb9e9/results/revocation.csv) has the complete positive-valued grid. New [tests](https://github.com/byeadeal/onchain-credentials-benchmark/blob/758dd186f74346c31bbd02a9ef870894761fb9e9/test/revocation.correctness.ts) verify that revoking one credential leaves a second valid in every architecture. Historical per-transaction sums cannot be independently reconstructed from the aggregate CSV alone.
- **Integration:** changed-path sets are pairwise disjoint, and `git diff --check origin/main...<branch>` passes for all three. Contract/helper/compiler-configuration Git blobs are identical across all four refs. Azhar newly changes the shared package manifest/lockfile to make `@types/mocha` a direct development dependency; **no locked package versions, integrity values or resolved URLs changed**. Existing resolved Mocha types remain 10.0.10. This still needs team review of the shared-file change.
- **Plot compatibility:** [the plotter](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/scripts/plot_results.py) separates issuance totals, amortized issuance, deployment, verification estimates and revocation receipts. Its new documentation correctly says revocation is not divided by N. It rejects detailed evidence without the required `gas` column. The current real inputs assemble into all five expected panels with all three architectures and cohorts 1/10/100/1000.

## CRITICAL - close before submission

### C1. There is no agreed integrated submission tree

**Affected:** `origin/main`; [Adil's CSV](../../results/verification.csv); the remote issuance/revocation CSVs and runners linked above. A default main checkout lacks the published datasets, plotter, isolated verifier and revocation runner/tests. None of their successful branch-local checks proves they were integrated. The committed [figure](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/results/figures/gas_vs_cohort.png) also contains issuance panels only; it was visually inspected.

**Smallest safe correction:** agree the final submission revision. The authorized integrator can review Alikhan's PR, then Adil's and Azhar's changes, including Azhar's manifest diff, and integrate only after approval. Re-run the two test suites and validators on that actual resulting checkout. If integration cannot occur today, provide an explicit three-ref reproduction manifest and describe the artifact as branch-separated, rather than claiming main contains the complete project. No merge is performed by this audit.

**Owners:** Alikhan coordinates the existing issuance/plotting PR and final figure; Adil and Azhar approve their own scopes; all three agree the submission ref.

### C2. The final cross-workstream presentation has not been rendered and checked

**Affected:** the committed issuance-only figure; [plotter verification caption/footer construction](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/scripts/plot_results.py#L432); [verification caption](./REPORT_READY_VERIFICATION_2026-11-13.md#f-figure-caption).

The combined parser/panels pass, but this environment has no Matplotlib, so rendering is unverified. The figure footer takes metadata **only from issuance**, and its bare `cancun` value is a compiler target. The verification panel does not itself state position 0; the revocation panel says not divided by N but needs the explicit sequential-cohort-total interpretation in the paper.

**Smallest safe correction:** in Alikhan's existing plotting environment, render a new candidate from all three saved CSVs, inspect it, and use a caption explicitly stating: verification = one index-0 estimate/query; issuance = separate deployment and cohort publication costs; revocation = sum of N sequential native receipts. Label the footer as issuance metadata/Cancun target, not evidence of a common historical runtime. Separate correct figures/tables are also acceptable; do not present the current issuance-only image as coverage of all workstreams. No benchmark rerun is necessary to render saved data.

**Owners:** Alikhan renders/checks; Adil supplies verification caption; Azhar confirms revocation wording.

### C3. Final paper claims need an evidence-boundary sign-off

**Affected:** [README lines 5 and 13](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/README.md#L5), [native contract predicates](../../contracts/), [Azhar's methodology](https://github.com/byeadeal/onchain-credentials-benchmark/blob/758dd186f74346c31bbd02a9ef870894761fb9e9/docs/azhar/revocation-measurement.md), [Adil's report text](./REPORT_READY_VERIFICATION_2026-11-13.md). No manuscript or bibliography in PDF/TeX/DOCX/BibTeX was found in any inspected branch, so this audit cannot approve the final paper's actual prose or citations.

The README asserts a literature gap without checked original sources and suggests a shared payload makes this an architecture-only comparison. Payload equality does not equalize predicates, calldata, ownership state, transaction counts or off-chain work. Token existence/lock is not academic-content or student-identity verification. A hash status check and a Merkle inclusion/revocation check also prove different predicates. Per-query verification, cohort issuance and sequential cohort revocation cannot be ranked as one workload. Statistical significance, public-network throughput, full standards compliance, measured state-bloat dynamics and end-to-end identity/off-chain costs are not established here.

**Smallest safe correction:** all three researchers review the final Methods/Results/captions/Conclusion against these definitions. Remove unsupported equivalence, novelty, identity, replication and measured-state-growth claims; verify original sources for retained citation-dependent claims. Describe one local synthetic run and deterministic samples without confidence intervals or universal rankings. Runtime provenance missing from historical rows must be disclosed, rather than retrospectively invented. This is a required report review, not a claim that an unseen manuscript contains every listed error.

**Owners:** Adil consolidates methodology/verification qualifications; Alikhan signs off issuance/figure interpretation; Azhar signs off sequential native revocation. All approve final claims and references.

## IMPORTANT - smallest fixes if time permits; mandatory disclosures where noted

| ID / owner | Affected file and concrete issue | Smallest safe correction |
| --- | --- | --- |
| I1 / Alikhan | [README line 78](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/README.md#L78) says Python 3.10+, but [requirements](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/requirements-plot.txt) pin Matplotlib 3.11.2, whose [original PyPI release metadata](https://pypi.org/pypi/matplotlib/3.11.2/json) requires Python **>=3.11**. A documented Python 3.10 install cannot satisfy that pin. | Raise the documented plotting minimum to Python 3.11 without changing the dependency. Use an existing compatible environment for the final render. No install or requirement edit was made here. |
| I2 / Adil, team approval for code | [Runner line 38](../../experiments/adil/run-verification.ts#L38) requires branch name `adil-work`; [line 62](../../experiments/adil/run-verification.ts#L62) invokes Windows `cmd.exe`. An integrated main/tag or Linux/macOS checkout cannot run the published runner unchanged. | For today's artifact, explicitly document verification reproduction on the pinned Adil branch using Windows, and list both root and isolated test commands. If main/cross-platform execution is required, obtain approval for removing the personal-branch assertion while retaining local-network guards and for portable npm-version collection; rerun scoped tests. Do not claim general clean-clone portability before that check. |
| I3 / Alikhan and Azhar | Issuance CSV records compiler/target but the runner hardcodes the Hardhat network label; revocation CSV has only four columns. Neither branch retains Adil-equivalent historical runtime/version/raw-receipt evidence. Current matching source/configuration does not prove settings used for those saved runs. | Attach genuine retained run logs/build/runtime/version records if available. Otherwise mark the missing provenance explicitly in Methods/Limitations, keep the original CSVs, and avoid an unqualified fully controlled cross-run claim. Better archival/repetition is follow-up; disclosure is required today. |
| I4 / Alikhan, Adil | [Issuance CSV](https://github.com/byeadeal/onchain-credentials-benchmark/blob/c07c18ef1d62271c9e8398bf60128caac93b2a6c/results/issuance.csv) has Merkle deployment **332,327**, versus **332,315** in [Adil's baseline](./baseline-report.md), at all four N: +12 gas each. All 12 issuance totals match exactly; 20/24 deployment/issue totals match. Cause is unverified. | Choose/identify the canonical named run for the figure and disclose the small deployment discrepancy. Preserve both datasets. Investigate retained creation-bytecode/build/receipt records if available; no averaging, silent replacement or exact-replication claim. |
| I5 / Adil and Alikhan | [Package engines](../../package.json) and README say Node >=20, while installed Hardhat declares supported Node 20/22/24 ranges. Recorded/audit Node 26 is outside those ranges. [Shared config](../../hardhat.config.ts) pins compiler settings but not runtime hardfork. | Document a supported reproduction runtime (e.g. Node 24), and explicitly retain Node 26/Osaka qualifications for actual saved runs. Do not relabel old results as supported-runtime or Cancun-execution runs. A controlled rerun/configuration change needs approval and separate outputs; it is not required to honestly disclose the present evidence. |
| I6 / Azhar; report review by Adil | [Native revocation implementations](../../contracts/) mark existing registry state, burn/clear token state, or create a global leaf flag. Receipt gas is the charged transaction quantity and reflects storage-refund effects for state deletion; [EIP-3529](https://eips.ethereum.org/EIPS/eip-3529) specifies clearing refunds and their cap. No root/proof-rebuild work is measured. | In Discussion, explain the native state transitions and setup exclusions. Avoid calling these an identical storage operation or describing Merkle flagging as rebuilding/re-anchoring. No contract change is needed. |

Azhar's new direct Mocha-types manifest entry is a shared-file review item, not evidence of changed Solidity settings or runtime gas dependency versions. No locked package version drift was found. Existing documentation already explains much of the native revocation distinction; retain that wording during paper assembly.

## OPTIONAL - safe to postpone

- More independent trials, random/stratified positions, supported-runtime repetitions and broader invalid cases; no significance inference from current deterministic samples.
- Unknown/revoked gas series, common-predicate identity/content adapters, off-chain timing and proof-distribution accounting, state-growth experiments, public networks and root-rebuild revocation. These are new scientific work, outside today's audit.
- More negative-path/authorization tests, duplicate/unsafe-integer cohort-size guards in issuance/revocation runners, stricter saved-validator source/provenance checks, overwrite-proof output options, and CI automation. Current approved grids are complete and valid; do not refactor working experiments under the deadline.

## FINAL CHECKLIST - exact remaining actions today

- [ ] **Adil:** share this audit and the [report-ready verification section](./REPORT_READY_VERIFICATION_2026-11-13.md); retain the verified 60-sample archive and 24 index-0 estimate rows. Add the executed 20-test assembly outcome to the handoff without claiming it is a completed main merge. Document the runner's branch/Windows restriction; request a scoped correction only if the agreed submission entry point requires it.
- [ ] **Azhar:** confirm the saved revocation dataset is a sum of N sequential receipts with preparation excluded; attach retained actual-run provenance or explicitly state what is missing. Retain the three passing isolation tests and review the manifest/lockfile diff with the team. Do not substitute a root-rebuild narrative.
- [ ] **Alikhan:** correct Python minimum documentation, identify the canonical issuance run and disclose/resolve the +12-gas Merkle setup difference. Use an existing compatible plotting environment to run all 12 plot tests without skips and render a fresh candidate with all three CSVs; review values, legends, footers and captions. No data regeneration is needed for this step.
- [ ] **All three / authorized integrator:** agree the submission ref; review updated branch diffs and approve any integration/shared-file changes. After approved integration, verify the actual checkout with the commands below. If no integration is approved, publish exact branch/commit instructions and state that limitation.
- [ ] **All three:** sign off the manuscript's native predicates, gas units, transaction counts, setup/off-chain exclusions, runtime gaps, single-run limitations and verified references. Remove measured state-growth/identity/standards/novelty claims lacking evidence. The final manuscript itself was not available for this audit.

Commands for the approved integrated checkout, using its existing dependencies; no merge or installation command is authorized by this checklist:

```powershell
git status --short --branch
git fetch origin
git diff --check
npm.cmd test
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat test
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\tsc.cmd --noEmit --project experiments/adil/tsconfig.json
node -r ts-node/register experiments/adil/validate-run.ts docs/adil/evidence/verification-2026-11-13/pilot
node -r ts-node/register experiments/adil/validate-run.ts docs/adil/evidence/verification-2026-11-13/full
```

In Alikhan's configured Python >=3.11 plotting environment, where the pinned plotting dependency is already available:

```powershell
python scripts/test_plot_results.py
# Choose a fresh output path; preserve the committed figure and all evidence.
python scripts/plot_results.py --issuance results/issuance.csv --verification results/verification.csv --revocation results/revocation.csv --output results/figures/final-review-2026-11-16.png
```

Expected acceptance: root **9 passing**, isolated **11 passing**, both typechecks/validators succeed, plot tests **12 passing without skip**, all five panels contain the intended saved values and captions, and no unrelated source/result changes. Verify the candidate output path is absent first. Dependency installation, benchmark reruns or source fixes require separate approval under this workspace's rules.

**Final answer:** the repository can support a carefully qualified local pilot comparison once packaging and report sign-off are complete. It is not yet ready to be described as an integrated, freshly reproduced, statistically replicated or end-to-end credential study. The work needed today is integration/reproduction documentation, final figure/paper QA and honest provenance disclosures, not another benchmark or a contract rewrite. Existing academic citations remain unverified. Original technical sources checked in this audit were the specific plotting package's Python requirement and EIP-3529's storage-refund rule; this does not validate the project's academic bibliography.
