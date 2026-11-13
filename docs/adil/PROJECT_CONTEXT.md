# Adil project context

Last updated: 2026-11-13, after the assigned Day 1 verification implementation and experiments. The 2026-11-06 baseline remains preserved separately. Read this file and [WORKLOG.md](./WORKLOG.md) at the start of each substantial session. After finishing a work package, update the relevant status here and append its evidence, changed files, outcomes and remaining issues to the worklog.

## Purpose and evidence labels

Project: [On-chain Student Credentials Benchmark](https://github.com/byeadeal/onchain-credentials-benchmark). Paper working title: *Scaling the Cost of On-Chain Student Credentials: Architectural Trade-Offs, Empirical Benchmarks, and State Bloat Dynamics*. Adil, Alikhan and Azhar are university researchers; this is Adil's individual workspace. The semester schedule is behind, so prioritize interpretable experiments and paper evidence over unrelated improvements.

- **VERIFIED:** checked against local code, file contents, Git state or archived command evidence. Verification of an archived outcome does not mean the experiment was independently rerun.
- **REPORTED:** supplied by Adil or earlier session narrative without a retained independent record.
- **OPEN:** unresolved ownership, scientific choice, missing evidence or missing implementation.
- **PROPOSED:** a design/hypothesis or future work item; not approved, implemented or measured merely because it appears in a document.

Goal: compare gas, transaction counts, scalability and architectural trade-offs for issuance, verification and revocation across cohort sizes. State growth is part of the paper's scope but is not currently measured.

**PROPOSED working hypotheses, not established findings:** registry/token cohort issuance costs grow approximately with credential count; one Merkle root publication is approximately constant-size while proof-verification work depends on proof length; revocation policies distribute cost and retained state differently between chain and off-chain systems. Freeze the research questions and relevant operation semantics with the team before interpreting these as formal hypotheses. No hypothesis implies identical identity/credential guarantees or universal architectural superiority.

## Repository, safety and ownership

**VERIFIED:** the [repository root](../../) is the `onchain-credentials-benchmark` child of the VS Code workspace folder. Run Git/npm commands from that repository root. Actual checkout is `adil-work`; the shared-source baseline and local `main` remain at `967ee598fb6b811423bd1ff9b6470841f4a4d432`. UI/user metadata saying “current branch: main” did not match the inspected checkout. The November 6 documentation commit `64c48705cdeacc904d53bec1f9c88246d11cea9c` was published to `origin/adil-work`. The November 13 verification run used that parent HEAD plus the exact new source hashes recorded in its metadata. Use current Git status/log for the contribution commit identity and cleanliness.

**VERIFIED day-end remote check:** `git fetch origin` succeeded; before the documentation commit, `origin/main` matched HEAD with no incoming commits. The subsequently authorized `git pull --ff-only origin main` returned “Already up to date.” GitHub query `repo:byeadeal/onchain-credentials-benchmark is:pr is:open` returned zero open pull requests, and there was no active PR. Adil then explicitly approved the reviewed local commit and pushing `adil-work`. Approved subject: `docs(adil): record methodology audit, baseline evidence, and experiment design`. This authorization applies to this package, not future commits, main-branch changes, force-pushes, PR creation or merges. Git history and remote refs are the authority for the resulting commit/push status.

Before editing, inspect branch, status and existing differences. Work only on `adil-work`; preserve unexpected changes and investigate them. No automatic commits, pushes, PRs, merges, rebases, resets, cleans, stashes or force-pushes. Public deployments, real funds, credentials, dependency/runtime installations and disruptive configuration changes require explicit approval. Do not create root repository-wide agent instructions without proposing them first.

The November 13 task explicitly authorizes one scoped commit and normal push of the validated Day 1 verification contribution. It does not authorize a main merge or automatic PR creation. Remote branches and Alikhan's existing PR were inspected read-only; no teammate work was merged or edited.

**VERIFIED assignment from Adil's November 13 instructions:** Adil owns verification benchmarking and methodology; Alikhan owns issuance/results/plotting on `alikhan/results`; Azhar owns revocation on `azhar/revocation`. This supersedes the earlier unresolved ownership question and authorizes [experiments/adil/](../../experiments/adil), the verification CSV and Adil-specific evidence/documentation. Shared contract, dependency and teammate files remain protected. Broader common-predicate contracts, root-rebuild policy or unrelated infrastructure still need coordination.

## Implemented architecture and scientific boundaries

| VERIFIED implementation | Current native meaning |
| --- | --- |
| [HashRegistry](../../contracts/HashRegistry.sol) | Issuer records hash status/timestamp; verification checks Issued status; revocation retains the record and marks Revoked; previously used hashes cannot be reissued |
| [SoulboundCredential](../../contracts/SoulboundCredential.sol) | Issuer mints locked ERC-721 with stored hash; transfers/approvals blocked; verification checks token existence/lock, not expected hash/student; revocation burns and clears hash/lock |
| [MerkleCredentialAnchor](../../contracts/MerkleCredentialAnchor.sol) | Issuer anchors or replaces a batch root; verification checks inclusion plus global leaf revocation; revoking a leaf does not require membership and affects all batches |

**VERIFIED:** [original tests](../../test) contain six lifecycle/negative-path tests. [The shared benchmark](../../scripts/benchmark.ts) remains issuance-only with its original verification/revocation placeholders. The new isolated [verification implementation](../../experiments/adil/verification.ts) measures static correctness, estimates and actual receipt gas for valid/unissued cases. Its [11 tests](../../experiments/adil/test/verification.ts) cover correctness, revocation/corruption checks, receipt provenance and output validation. Proof generation reuses the shared [sorted-pair helper](../../scripts/lib/merkle.ts), which promotes odd nodes and rejects empty trees. Azhar's revocation implementation/results exist on his remote branch, not in Adil's local checkout.

Native operations are not scientifically interchangeable. Merkle anchoring excludes leaf/tree/proof construction and distribution; token ownership has no direct registry/Merkle equivalent. Local `eth_call`, transaction receipt gas, gas estimation and off-chain timing must remain distinct. Individual flagging/burning differs from sequential whole-cohort revocation and mutable-root replacement. Root replacement with no survivors has no agreed implementation policy.

## Completed deliverables and reconciled baseline

| Deliverable | Status and evidence |
| --- | --- |
| [experiment-protocol.md](./experiment-protocol.md) | **VERIFIED present/reviewed:** audit, comparison boundaries, missing measurements and validity threats; not an approved extension configuration |
| [baseline-report.md](./baseline-report.md) | **VERIFIED archive consistency:** tests and issuance runs documented, with raw outputs/settings and qualifications |
| [benchmark-extension-plan.md](./benchmark-extension-plan.md) | **VERIFIED design exists:** case matrix, isolation, expected files/tests, commands and schemas; all implementation defaults remain **PROPOSED** |
| [DAY1_HANDOFF_2026-11-13.md](./DAY1_HANDOFF_2026-11-13.md) | **VERIFIED implementation/results:** small assigned verification experiment, tests, exact file inventory, actual values and team integration instructions |

**VERIFIED November 13 results:** pilot N=1/10 produced 24 mined samples; the full N=1/10/100/1000 run produced **60 mined samples and 24 estimate-only compatibility rows**. Unique first/middle/last indices were measured; the team CSV uses index 0 only. Estimates and receipt values were independently collected and happened to match in all samples. [results/verification.csv](../../results/verification.csv) feeds Alikhan's estimate-labelled plotter; [detailed receipt data](./evidence/verification-2026-11-13/full/verification-detailed.csv) stays separate. See [metadata](./evidence/verification-2026-11-13/full/metadata.json) for version/source hashes and [validation commands](./evidence/verification-2026-11-13/validation-commands.json) for successful 11-new/6-original tests, typecheck and both saved-run validators. The full run passed 16 revoked/corrupted-proof correctness checks; these are not revocation-cost measurements.

**VERIFIED archived outcome:** `npm.cmd test` exited 0 with six passing tests on 2026-11-06 at 13:08 UTC; see [test metadata](./evidence/test-run.json) and [raw output](./evidence/tests.txt). Two issuance invocations succeeded for N=1/10/100, then N=1000. Reconciliation rechecked both CSV SHA-256 values, all 24 unique rows against the archived validation data, positive gas totals, transaction counts and truncated per-credential arithmetic. See [CSV validation](./evidence/csv-validation.json), [first run](./evidence/run-1-10-100.json) and [1000 run](./evidence/run-1000.json). The baseline report contains the measurements; do not duplicate or replace its tables here.

**VERIFIED controls unchanged:** Solidity 0.8.28, optimizer enabled/200 runs, compiler target Cancun, default sizes 1/10/100/1000 and local Hardhat. Recorded/current environment: Node 26.13.0, npm 11.20.0, Hardhat 2.29.1, network `hardhat`, chain ID 31337, runtime hardfork **Osaka**. The runtime is a resolved default, not a pinned project setting. Reconciliation matched all 122 baseline-inventory files and all 20 compiled input sources to current files. No test/benchmark rerun was necessary because these checks found no source drift.

**Preliminary measurements:** the November 6 issuance runner did not archive individual receipts or its ephemeral chain. The November 13 verification runner now archives real transaction/receipt pairs, but that still does not provide statistical replication or production validation. Synthetic numeric recipients and original payload conventions were retained; setup costs are excluded from verification gas. There is one local run per dataset, with deterministic position sampling. No Adil state-growth, revocation-cost, public-network or DA measurement is claimed. Academic references and claimed literature gaps remain **UNVERIFIED**.

## Reproducibility and reconciliation clarifications

Use the [environment record](./evidence/environment.json), [compiled-source checks](./evidence/compiled-source-verification.json) and [protocol](./experiment-protocol.md) for exact settings/inputs. Preserve existing outputs before commands that overwrite them. Keep raw data immutable, record commit plus dirty-source hashes, tool versions, compiler target **and** execution hardfork, network, timestamps, transaction counts, workload/seed/case and setup exclusions. Label new conditions separately; raw totals are authoritative over integer-truncated averages.

The scoped [.gitattributes](./.gitattributes) pins LF endings under Adil's documentation directory to preserve archived evidence hashes across Git checkouts. The baseline's source-file hashes remain byte-sensitive records of the original checkout; a different source newline policy requires explaining the difference, not silently replacing those hashes.

The reconciliation found no unexplained source/result drift. Qualifications that must persist:

- “Cancun EVM” in project descriptions denotes the compiler target; it is not evidence of Cancun runtime execution.
- Node 26 ran successfully but is outside this installed Hardhat version's declared Node 20/22/24 support ranges. The plan's Node 24 choice has not been adopted or installed by this work.
- The README's shared payload does not establish equal verification semantics or realistic recipient costs.
- Earlier clean-tree/file-count statements and [scope-verification.json](./evidence/scope-verification.json) describe their original work package. They do not include subsequently added documentation.
- The earlier plan's seeded inputs, changed recipient policy, five datasets/three replays and 166,830 proposed rows were **not executed**. The November 13 assignment explicitly replaced that grid with the smaller original-input sampling experiment. Osaka is now explicit in the isolated local configuration; shared configuration remains unchanged.
- One initial standalone validator failed due to a missing TypeScript-only Hardhat ethers declaration import. That type-only fix was applied, and all final checks passed; pilot and full metadata preserve their respective source hashes. See [development checks](./evidence/verification-2026-11-13/development-checks.json).

## Next three work packages, in dependency order

1. **Team integration/review.** Use the handoff to review Adil's branch alongside Alikhan's open issuance/plotting PR and Azhar's revocation branch. Alikhan can consume the 24-row estimate CSV unchanged; a combined figure was not generated on Adil's branch because his plotter/environment is separate. Team decides PR/integration order; no automatic merge.
2. **Joint results interpretation.** Keep per-query verification estimates/receipts distinct from issuance totals and Azhar's sequential cohort-total revocation receipts. Confirm runtime/input/denominator qualifications in the paper. Root-rebuild revocation policy remains coordinated work, not an Adil extension by default.
3. **Targeted report evidence.** Agree whether a controlled supported-Node repetition, additional sampling or reference checking is needed for the deadline. Do not run the old enormous grid. Reference validation and defensible state-growth claims still require evidence and an explicit owner.

Literature/reference verification and defining a defensible state-growth metric remain separate open research tasks. The immediate next action is team review/integration of the completed verification contribution and its documented limitations.
