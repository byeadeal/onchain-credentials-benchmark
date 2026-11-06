# Adil project context

Last reconciled: 2026-11-06; evidence checks at `2026-11-06T13:29:24.082Z`, with commit-preparation checks at `2026-11-06T13:54:28.558Z`. Read this file and [WORKLOG.md](./WORKLOG.md) at the start of each substantial session. After finishing a work package, update the relevant status here and append its evidence, changed files, outcomes and remaining issues to the worklog.

## Purpose and evidence labels

Project: [On-chain Student Credentials Benchmark](https://github.com/byeadeal/onchain-credentials-benchmark). Paper working title: *Scaling the Cost of On-Chain Student Credentials: Architectural Trade-Offs, Empirical Benchmarks, and State Bloat Dynamics*. Adil, Alikhan and Azhar are university researchers; this is Adil's individual workspace. The semester schedule is behind, so prioritize interpretable experiments and paper evidence over unrelated improvements.

- **VERIFIED:** checked against local code, file contents, Git state or archived command evidence. Verification of an archived outcome does not mean the experiment was independently rerun.
- **REPORTED:** supplied by Adil or earlier session narrative without a retained independent record.
- **OPEN:** unresolved ownership, scientific choice, missing evidence or missing implementation.
- **PROPOSED:** a design/hypothesis or future work item; not approved, implemented or measured merely because it appears in a document.

Goal: compare gas, transaction counts, scalability and architectural trade-offs for issuance, verification and revocation across cohort sizes. State growth is part of the paper's scope but is not currently measured.

**PROPOSED working hypotheses, not established findings:** registry/token cohort issuance costs grow approximately with credential count; one Merkle root publication is approximately constant-size while proof-verification work depends on proof length; revocation policies distribute cost and retained state differently between chain and off-chain systems. Freeze the research questions and relevant operation semantics with the team before interpreting these as formal hypotheses. No hypothesis implies identical identity/credential guarantees or universal architectural superiority.

## Repository, safety and ownership

**VERIFIED:** the [repository root](../../) is the `onchain-credentials-benchmark` child of the VS Code workspace folder. Run Git/npm commands from that repository root. Actual checkout is `adil-work`; the shared-source baseline and local `main` remain at `967ee598fb6b811423bd1ff9b6470841f4a4d432`. UI/user metadata saying “current branch: main” did not match the inspected checkout. Today's approved commit package contains 20 Adil files: 19 documentation/evidence files plus a scoped attributes file. Shared source/configuration files have no differences. Use current Git status/log for commit identity and cleanliness rather than treating this dated snapshot as live state.

**VERIFIED day-end remote check:** `git fetch origin` succeeded; before the documentation commit, `origin/main` matched HEAD with no incoming commits. The subsequently authorized `git pull --ff-only origin main` returned “Already up to date.” GitHub query `repo:byeadeal/onchain-credentials-benchmark is:pr is:open` returned zero open pull requests, and there was no active PR. Adil then explicitly approved the reviewed local commit and pushing `adil-work`. Approved subject: `docs(adil): record methodology audit, baseline evidence, and experiment design`. This authorization applies to this package, not future commits, main-branch changes, force-pushes, PR creation or merges. Git history and remote refs are the authority for the resulting commit/push status.

Before editing, inspect branch, status and existing differences. Work only on `adil-work`; preserve unexpected changes and investigate them. No automatic commits, pushes, PRs, merges, rebases, resets, cleans, stashes or force-pushes. Public deployments, real funds, credentials, dependency/runtime installations and disruptive configuration changes require explicit approval. Do not create root repository-wide agent instructions without proposing them first.

**VERIFIED scope:** Adil-specific documentation is authorized. **OPEN:** neither the [README](../../README.md) nor any discovered ownership/assignment file allocates verification, revocation, Merkle rebuilding, infrastructure or analysis among teammates. No named ownership conflict has been established. Do not infer ownership from authorship, unassigned TODOs, this plan, or an Adil-specific namespace. Shared code/configuration/methodology changes need approval. Future benchmark implementation remains blocked on an explicit assignment; other authorized research/documentation can continue.

## Implemented architecture and scientific boundaries

| VERIFIED implementation | Current native meaning |
| --- | --- |
| [HashRegistry](../../contracts/HashRegistry.sol) | Issuer records hash status/timestamp; verification checks Issued status; revocation retains the record and marks Revoked; previously used hashes cannot be reissued |
| [SoulboundCredential](../../contracts/SoulboundCredential.sol) | Issuer mints locked ERC-721 with stored hash; transfers/approvals blocked; verification checks token existence/lock, not expected hash/student; revocation burns and clears hash/lock |
| [MerkleCredentialAnchor](../../contracts/MerkleCredentialAnchor.sol) | Issuer anchors or replaces a batch root; verification checks inclusion plus global leaf revocation; revoking a leaf does not require membership and affects all batches |

**VERIFIED:** [tests](../../test) contain six lifecycle/negative-path tests, two per contract, with incomplete edge-case/security coverage. [The benchmark](../../scripts/benchmark.ts) measures deployment and issuance receipt gas only; verification/revocation functions remain empty placeholders. No extension implementation directory exists. Proof generation uses the shared [sorted-pair helper](../../scripts/lib/merkle.ts), which promotes odd nodes and rejects empty trees.

Native operations are not scientifically interchangeable. Merkle anchoring excludes leaf/tree/proof construction and distribution; token ownership has no direct registry/Merkle equivalent. Local `eth_call`, transaction receipt gas, gas estimation and off-chain timing must remain distinct. Individual flagging/burning differs from sequential whole-cohort revocation and mutable-root replacement. Root replacement with no survivors has no agreed implementation policy.

## Completed deliverables and reconciled baseline

| Deliverable | Status and evidence |
| --- | --- |
| [experiment-protocol.md](./experiment-protocol.md) | **VERIFIED present/reviewed:** audit, comparison boundaries, missing measurements and validity threats; not an approved extension configuration |
| [baseline-report.md](./baseline-report.md) | **VERIFIED archive consistency:** tests and issuance runs documented, with raw outputs/settings and qualifications |
| [benchmark-extension-plan.md](./benchmark-extension-plan.md) | **VERIFIED design exists:** case matrix, isolation, expected files/tests, commands and schemas; all implementation defaults remain **PROPOSED** |

**VERIFIED archived outcome:** `npm.cmd test` exited 0 with six passing tests on 2026-11-06 at 13:08 UTC; see [test metadata](./evidence/test-run.json) and [raw output](./evidence/tests.txt). Two issuance invocations succeeded for N=1/10/100, then N=1000. Reconciliation rechecked both CSV SHA-256 values, all 24 unique rows against the archived validation data, positive gas totals, transaction counts and truncated per-credential arithmetic. See [CSV validation](./evidence/csv-validation.json), [first run](./evidence/run-1-10-100.json) and [1000 run](./evidence/run-1000.json). The baseline report contains the measurements; do not duplicate or replace its tables here.

**VERIFIED controls unchanged:** Solidity 0.8.28, optimizer enabled/200 runs, compiler target Cancun, default sizes 1/10/100/1000 and local Hardhat. Recorded/current environment: Node 26.13.0, npm 11.20.0, Hardhat 2.29.1, network `hardhat`, chain ID 31337, runtime hardfork **Osaka**. The runtime is a resolved default, not a pinned project setting. Reconciliation matched all 122 baseline-inventory files and all 20 compiled input sources to current files. No test/benchmark rerun was necessary because these checks found no source drift.

**Preliminary measurements:** valid archived arithmetic/source consistency does not provide independent receipt replay, statistical replication or production validation. The original runner did not retain individual receipts or its ephemeral chain. Synthetic numeric recipients overlap precompiles; the magnitude of any gas bias was not isolated. There was one trial per architecture/cohort; no state-size, verification/revocation gas, public-network or DA measurement exists. Academic references and claimed literature gaps remain **UNVERIFIED**.

## Reproducibility and reconciliation clarifications

Use the [environment record](./evidence/environment.json), [compiled-source checks](./evidence/compiled-source-verification.json) and [protocol](./experiment-protocol.md) for exact settings/inputs. Preserve existing outputs before commands that overwrite them. Keep raw data immutable, record commit plus dirty-source hashes, tool versions, compiler target **and** execution hardfork, network, timestamps, transaction counts, workload/seed/case and setup exclusions. Label new conditions separately; raw totals are authoritative over integer-truncated averages.

The scoped [.gitattributes](./.gitattributes) pins LF endings under Adil's documentation directory to preserve archived evidence hashes across Git checkouts. The baseline's source-file hashes remain byte-sensitive records of the original checkout; a different source newline policy requires explaining the difference, not silently replacing those hashes.

The reconciliation found no unexplained source/result drift. Qualifications that must persist:

- “Cancun EVM” in project descriptions denotes the compiler target; it is not evidence of Cancun runtime execution.
- Node 26 ran successfully but is outside this installed Hardhat version's declared Node 20/22/24 support ranges. The plan's Node 24 choice has not been adopted or installed by this work.
- The README's shared payload does not establish equal verification semantics or realistic recipient costs.
- Earlier clean-tree/file-count statements and [scope-verification.json](./evidence/scope-verification.json) describe their original work package. They do not include subsequently added documentation.
- The plan's seeded inputs, recipient policy, pinned runtime, five datasets/three replays and 166,830 planned verification rows are **PROPOSED**, not executed results or approved methodology. Review the budget before a full run.

## Next three work packages, in dependency order

1. **Decision and ownership record — research coordination.** Confirm Adil's exact experiment/files, teammates' overlapping work, native-versus-common verification predicate, revocation scope and empty-tree policy. Approve environment/input controls and a small pilot budget. Record the decision under Adil's documentation; do not silently adopt the full plan. **OPEN owner allocations; no code yet.**
2. **Isolated fixture/verification pilot — after package 1.** If assigned, create the proposed `experiments/adil/` namespace, local config, input manifests, snapshot/receipt infrastructure and verification cases. Run correctness tests plus the proposed N=1/10 smoke run before any larger dataset. **PROPOSED; infrastructure and verification ownership unassigned.**
3. **Revocation pilot and evidence-based scaling — after package 2.** If assigned, add independent single and sequential cohort revocation, then the coordinated Merkle replacement comparison where supported. Validate evidence and agree whether a reduced or full experiment grid is worthwhile before collecting publication results. **PROPOSED; revocation/Merkle/analysis ownership unassigned.**

Literature/reference verification and defining a defensible state-growth metric remain separate open research tasks; do not claim them complete or assign them to a teammate without confirmation. The next required decision is Adil's implementation assignment and the approved pilot boundaries, not a commit or deployment.
