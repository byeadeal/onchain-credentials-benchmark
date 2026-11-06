# Verification and revocation benchmark extension plan

Authoring scope: Adil's design work only. Date: 2026-11-06. Source revision: `967ee598fb6b811423bd1ff9b6470841f4a4d432`, branch `adil-work`.

**Status: proposed design; no benchmark implementation or methodology change is authorized by this document.** Only this document was created for this task. The [protocol](./experiment-protocol.md) and [baseline report](./baseline-report.md) remain unchanged. All existing academic citations and research-gap claims remain **UNVERIFIED**. Technical API/specification links below support the narrow implementation choices stated here; they do not validate the literature review.

## 1. Ownership and implementation boundary

The inspected [README](../../README.md) names the three researchers and lists verification/revocation roadmap items, but assigns neither experiment to anyone. No ownership/assignment document, CODEOWNERS file, or applicable AGENTS.md was found in the local repository. Names in paper authorship and directory names do not establish experimental responsibility. This search concerns repository contents, not private team discussions or remote issues.

Adil is authorized to produce this plan. Ownership of future verification, revocation, Merkle rebuilding, infrastructure, and analysis work must be confirmed with the team before implementation. There is an **unresolved ownership boundary**, not evidence that a named teammate owns or conflicts with a particular task. An isolated implementation can still duplicate someone else's experiment.

Propose keeping all future implementation, tests, local configuration, and outputs under a new `experiments/adil/` namespace. Shared [contracts](../../contracts), [helpers](../../scripts/lib), [tests](../../test), [benchmark](../../scripts/benchmark.ts), [configuration](../../hardhat.config.ts), [package manifest](../../package.json), and lockfile would be read-only. Do not fill shared TODOs, add package scripts, or integrate an Adil runner into the shared benchmark as part of the isolated version.

## 2. Research questions and measurement definitions

The primary questions are the transaction gas needed for each implementation's **native validity check** and the gas needed to invalidate a known issued credential using its existing revocation API. A separate Merkle policy experiment asks what changes when replacing a batch root after removing a leaf. These are implementation comparisons with explicit differences, not equivalent end-to-end student-identity verification.

| Metric | Definition and unit | Accounting boundary |
| --- | --- | --- |
| `gas_used` | Mined transaction receipt `gasUsed`, integer gas units | Includes intrinsic transaction charges, calldata and execution under the runtime's refund/floor rules; not execution-only gas |
| `transaction_count` | Number of mined transactions in the measured operation | 1 for a native check, individual revoke, or root replacement; N for sequential whole-cohort revocation |
| `total_gas` | Sum of the selected operation's receipt gas, integer gas units | Never includes deployment, issuance, preparation revokes, assertions, or other trials |
| `gas_per_affected_credential` | Exact rational `total_gas / affected_count`, plus a decimal presentation | Use affected credentials as denominator for revocation; do not divide a one-person revocation by cohort size |
| `calldata_bytes`, `zero_bytes`, `nonzero_bytes` | Bytes in the actual submitted transaction `data`, including selector | Excludes the transaction envelope, proofs stored off-chain, compressed L2 sizes, and blob/DA fees |
| `proof_length` | Number of submitted Merkle sibling hashes | `0` for an empty Merkle proof; blank for non-Merkle operations |
| `duration_ns` | Monotonic wall-clock duration of an identified off-chain stage | Host elapsed time, not EVM gas or CPU time; record separately from transaction measurements |
| `gas_estimate` | Optional simulated transaction requirement, integer gas units | Disabled in the primary experiment; any later estimate series must have its own metric label and approval |

Persist all integers as decimal strings without floating-point conversion. Store numerator and denominator for averages, and round only the displayed decimal to six places. Blank means unavailable/not applicable; zero means an observed zero. Unsupported operations must never have fabricated zero-gas observations. No ETH/currency fee, RPC latency, total state bytes, or network delivery measurement is included in the initial extension.

An ordinary local `eth_call` creates no mined transaction and charges no on-chain fee, although it executes computation. It is used as a correctness oracle, not a zero-gas data point. `eth_estimateGas` simulates a transaction and may differ from actual gas use; see the [Ethereum JSON-RPC definitions](https://ethereum.org/developers/docs/apis/json-rpc/#eth_estimategas). A transaction deliberately sent to a `view` function is a different usage model from an ordinary application read.

## 3. Controls, independent variables, and repetitions

The following are concrete proposed defaults requiring methodology approval before execution:

| Parameter | Proposed value |
| --- | --- |
| Cohorts | N = 1, 10, 100, 1000, preserving baseline size coverage |
| Architecture | `hash_registry`, `soulbound`, `merkle_anchor` |
| Operation | `verify_native`, `revoke_one`, `revoke_cohort_sequential`, `replace_root_remove_one` |
| Compiler | Existing Solidity 0.8.28, optimizer enabled/200 runs, compiler target Cancun; import settings read-only |
| Local execution | Hardhat 2.29.1, explicit Osaka runtime to retain the baseline's observed execution rules, chain ID 31337, automine, no fork |
| Node | An agreed installed Node 24 patch version, recorded exactly; no runtime installation is authorized here |
| Initial chain time | Explicit `2026-11-06T00:00:00Z`; one-second increments for setup blocks; measured block time set to pre-state timestamp + 1 |
| Roles | Default local signer 0 issues/revokes; signer 1 performs verification as a non-issuer |
| Transaction form | Direct type-2 calls, value 0, empty access list, explicit fixed gas limit 1,000,000; verify against runtime limits |
| Fee fields | Fixed local max fee 10 gwei / priority 1 gwei, checked against the pre-state base fee; no fee-price analysis |
| Dataset seeds | Integers 1 through 5, identical paired datasets across architectures |
| Replays | 3 exact state-restored replays of every selected input per seed |
| Selection | All issued indices for primary verification cases and independent single revokes; one unknown-ID case per fixture; all N credentials in whole-cohort workflows |

Independent variables are architecture, cohort size, verification case, revocation policy, leaf index/proof length, and seeded input data. Compiler/runtime, caller role, access policy, payload scheme, recipient policy, timestamp procedure, and selected state are controlled. Deployment and setup are outside measured gas but their receipts are retained under `phase=setup`.

Proposed extension payload, implemented only in a future Adil helper: `keccak256(AbiCoder.encode(["string","bytes32","uint256"], ["ADIL-EXT-v1", credentialHash(N,i), seed]))`, where the shared [credentialHash](../../scripts/lib/leaves.ts) is imported unchanged. This defines five reproducible datasets without a 64-byte leaf preimage. Use the identical generated hashes for all architectures. Record this scheme as `adil_ext_v1`; it is a declared input change from the issuance baseline, not a baseline reproduction. The credential still does not cryptographically bind a real student identity.

Derive each recipient from the last 20 bytes of a domain-separated hash of `(seed,N,i,retry)`. Reject zero, duplicate addresses, issuer/verifier/deployed-contract addresses, the low-address range through `0xffff`, and any address with code. Increment retry deterministically and persist final addresses. Recipients do not sign transactions. This replaces the baseline's low numeric recipients, which overlap precompiles, so must be labelled as a separate input policy. The [warm/cold access rules](https://eips.ethereum.org/EIPS/eip-2929) make address selection relevant.

Build and freeze a complete input manifest before measurement. Within each seed use the same ordered leaf list and student mapping across architectures; token ID is `i+1`, batch ID is fixed to 1, unknown batch ID to 2. Preserve original N and original index in every leaf when filtering survivors; never rehash survivors with a reduced N or renumber their payloads.

At the start of each `(seed,N)` fixture, start a fresh in-process local chain, deploy all three contracts in fixed order, then fully issue all N credentials in each design. A fixture snapshot is taken only after setup succeeds. Verification and revocation sample order is shuffled by a recorded deterministic seed, with paired indices across architectures. Never run multiple samples concurrently against a snapshot chain.

Three replays test repeatability, not three independent observations. Gas should be identical for an identical calldata/pre-state/runtime tuple; a mismatch stops publication for investigation. Retain every replay. Reduce replays to their median per input, summarize across all selected indices within each seed, then report median and interquartile range of the five seed-level summaries. For Merkle, also report by proof length. Do not pool leaf indices and replays into a fictitious large independent sample or infer population-level confidence intervals from five synthetic datasets. Use one unreported off-chain warm-up per N/seed before three timed rebuild replays; keep gas replay and off-chain timing interpretations separate.

This all-index design has a substantial evidence budget. The verification grid has `10N + 3` rows per N/seed/replay, including one unsupported corrupted-proof row at N=1. Across the four sizes, five seeds and three replays, that is **166,830 planned rows**, of which 166,815 submit measured transactions and 15 are not applicable. Preparation revokes, fixture deployment/issuance and correctness calls are additional work. These are planned counts, not executed measurements. First validate an explicitly labelled non-publication smoke run with N=1/10, seed 1 and one replay; approve the full run's resource/archive budget before execution. If sampling replaces all-index coverage, amend and version this design before running rather than silently dropping rows.

## 4. Verification case matrix and semantic scope

“Invalid” means an altered claim/content, “unknown” means an absent identifier or batch, and “revoked” means a credential first issued successfully and then explicitly revoked. These need separate case labels even when native execution paths coincide.

| Case and scope | HashRegistry | SoulboundCredential | MerkleCredentialAnchor |
| --- | --- | --- | --- |
| `valid`, all indices | Issued hash; expected native result true | Existing locked token ID; true | Existing batch, issued leaf, original correct proof; true |
| `tampered_payload`, all indices | Flip a deterministic bit of the hash, retry if equal to any issued/other case hash; false | Keep valid token ID but pair it externally with a wrong expected hash; native result remains **true** | Alter leaf as for registry, keep original proof of the original leaf; false |
| `unknown_id`, once per fixture | Deterministic separate never-issued hash; false | Token ID N+1, never minted; false | Batch 2, never anchored, with leaf 0 and its otherwise valid proof; false |
| `revoked`, all indices independently | Issue then revoke selected hash; false | Mint then burn selected token; false | Anchor then set selected leaf's revocation flag; original proof remains mathematically valid but verify returns false |
| `corrupt_proof`, Merkle only | Not applicable | Not applicable | Flip one bit of the first sibling, preserving proof length; false; only when a sibling exists |

For N=1, the correct Merkle proof is empty. There is no same-length nonempty-sibling mutation: emit `corrupt_proof` as `not_applicable_empty_proof`, with no transaction/gas. `tampered_payload` still changes the singleton leaf and returns false. Do not append a sibling and mislabel it a length-preserving corruption. Additional malformed-ABI/out-of-gas cases belong in correctness tests or a separately approved failure-cost study, not in ordinary false-result groups.

Registry tampering and an unknown hash both take the native absent-record path; different case labels do not establish different mechanisms. A Merkle unknown batch returns before proof hashing; revoked leaves also return early. Native soulbound verification only checks token existence/lock, ignoring expected payload and student. Its tampered-claim row is a **semantic negative control**, with `claim_expected_valid=false`, `native_expected_result=true`, `semantic_scope=token_status_only`, and exclusion from summaries of “invalid credentials rejected.” It can still measure the native call's gas, but cannot represent the cost of rejecting tampered content. No result is silently inverted to force equivalence.

HashRegistry and Merkle native checks concern hashes/inclusion, not student ownership or the truth of academic claims. Soulbound ownership is stored but not checked against an externally expected student by its verifier. The primary comparison therefore reports native operation cost alongside semantics. A common payload-and-student predicate would need additional reads or another interface/harness, another output series, and team coordination; it is not part of this proposed first implementation.

### 4.1 Sending view verification as a measured transaction

For each sample:

1. Restore the issued fixture. For the revoked case only, revoke the selected credential and await its receipt as preparation, outside measured gas. Check the intended pre-state.
2. Capture pre-state block number/hash/state root and expected boolean using a fixed-block static call from the intended verifier. Assert the result matches the matrix. Static calls do not carry EVM access warmth into a later transaction.
3. Encode exactly the native `verify` ABI and submit `verifier.sendTransaction({to, data, value:0, gasLimit:1000000, type:2, accessList:[], ...fixedFeeFields})`; alternatively use the explicit ethers method `.send`, never the ordinary implicit view call. The [ethers contract API](https://docs.ethers.org/v6/api/contract/#BaseContractMethod-send) distinguishes send, static call, and estimation.
4. Await mining; save transaction and full receipt. Require status 1 for ordinary true and false verification cases and extract receipt `gasUsed`. A successful receipt does **not** encode the returned boolean; the separate fixed-state call is the correctness oracle.
5. Check the post-state boolean and relevant contract fields remain unchanged by verification. Save the measured block context and receipt before any snapshot restore. Exclude correctness calls/preparation receipts from measured totals.

There is one direct call per transaction; no multicall or wrapper, hence no within-transaction multi-verification warming. If a future wrapper measures internal-call gas, it is a separate experiment with different dispatch/access overhead. Receipt gas must not be converted to “execution gas” by blindly subtracting 21,000; calldata, refunds and runtime floors also contribute. [EIP-7623](https://eips.ethereum.org/EIPS/eip-7623) defines a transaction calldata floor relevant to that distinction. Any unexpected revert/timeout produces an error record and invalidates that sample; do not silently replace it with an estimate or a zero.

### 4.2 Merkle proof length versus N

Use the shared [sorted-pair, odd-node-promotion helper](../../scripts/lib/merkle.ts) unchanged. Maximum sibling count is `ceil(log2(N))` for N>1; some leaves have shorter proofs because unpaired nodes are promoted without a sibling hash. Off-chain enumeration of that helper gives these structural expectations, **not new gas results**:

| N | Proof lengths and leaf counts | Encoded native verification calldata lengths |
| ---: | --- | --- |
| 1 | 1 leaf with 0 siblings | 132 bytes |
| 10 | 2 leaves with 2; 8 with 4 | 196 or 260 bytes |
| 100 | 4 leaves with 4; 96 with 7 | 260 or 356 bytes |
| 1000 | 8 leaves with 8; 992 with 10 | 388 or 452 bytes |

Merkle calldata is `132 + 32k` bytes for k siblings; registry/token verification uses 36 bytes. Count actual transaction bytes and zero/nonzero composition as well as formula checks. Input length alone does not establish calldata fee equality. Report real per-leaf depth and stratified gas, rather than assigning every leaf the maximum depth or assuming every invalid case hashes the complete proof. Rebuilt trees use the survivor count and have their own proof-length distribution.

## 5. Revocation preparation, isolation, and workflows

### 5.1 Snapshot lifecycle and avoiding repeated revocation

Use one mutable issued-fixture snapshot handle per fixture. `restoreIssuedFixture()` must require a successful `evm_revert`, immediately take a new snapshot, replace the handle, and clear local nonce/contract-derived state caches. A consumed snapshot ID must never be reused. Do not use a cached-nonce signer. Before every independent sample/replay, restore that fully issued state, assert the selected registry record is Issued, token exists/locked, and Merkle leaf is unrevoked and verifies true. Restoration includes sender nonces and balances; preflight assertions do not change contract state.

If snapshot restoration fails, abort that fixture. Rebuilding/deploying a replacement fixture must have a new fixture ID and explicit provenance, not silently continue one statistical group. Nested case snapshots are unnecessary: repeat any preparation operation after restoring the issued fixture. Persist evidence before restoring, because later RPC queries may no longer retrieve reverted transactions. A transaction hash may repeat after identical state/nonce replay; key evidence by run/fixture/sample/replay plus hash, not hash alone.

### 5.2 Independent single-credential revocation

For every original index i, seed and replay, restore the issued fixture and measure exactly one issuer transaction: `registry.revoke(hash[i])`, `soulbound.revoke(i+1)`, or `merkle.revoke(leaf[i])`. Require receipt status 1. Record `affected_count=1`, `transaction_count=1`, `revocation_policy=native_one`, original N, index, and gas. Repeat checks after mining: registry status Revoked and retained issuance timestamp; token absent with cleared hash/lock; Merkle flag true with root unchanged. All native verifiers must return false afterward. For the Merkle sample, validate membership before revoking even though the revoke API itself does not enforce it.

Each i begins from the same fully issued cohort state. Do not revoke successive i values on an accumulating state and call the results independent single revokes: in the token design, the recipient balance and other writes can depend on prior revocations. Record status changes and effective receipt gas; no inferred storage-refund decomposition or physical historical-data deletion is claimed.

### 5.3 Whole-cohort revocation

On a separate restored fixture, revoke all N original credentials sequentially in fixed original-index order, one awaited transaction per credential. Run once per seed/replay for each architecture. Record every step with shared `workflow_id`, `step=0..N-1`, `affected_count=1`, plus a workflow summary with `affected_count=N`, `transaction_count=N`, total gas and exact per-affected average. Assert before each step that its credential is still issued, then that it is invalid afterward. Verify all N are invalid at completion. State accumulation and ordering are part of this workload.

This is N sequential native operations, not an atomic `revokeBatch` call. None of the current contracts exposes batch revocation. Do not derive the workflow gas as N times the independent-single mean. At N=1 the workflows coincide semantically but retain distinct operation labels; never count their duplicated observations as extra independent evidence.

### 5.4 Merkle leaf flag versus root replacement

The matched comparison removes **one** original credential at each unique index in `{0, floor(N/2), N-1}` for N=10,100,1000. Use the leaf-flag single-revoke measurements at those same indices and datasets. Restore the original issued fixture before every replacement/replay; no accumulated flags or prior root replacements may leak in.

For `replace_root_remove_one`, remove the selected original leaf from the off-chain ordered list, retaining every survivor's original hash and original identity mapping. Time survivor selection, the existing helper's combined root-and-all-proofs construction, and proof serialization separately using a monotonic timer. Serialize deterministically as UTF-8 JSON without whitespace, lower-case hex, LF-free JSON data, one entry per survivor containing original index, leaf and sibling list. Retain the serialization bytes/hash and count total sibling entries. Do not label the helper's combined work as root-only computation. Storage/download service, network delivery and availability are not timed by this local computation experiment.

Send exactly one `anchor(existingBatchId=1, newRoot)` and measure its receipt. This overwrites an **existing** record, unlike initial issuance's first anchoring. Keep the measured block time later than `anchoredAt` to define the timestamp-write transition consistently. Record original/surviving count, old/new root, calldata and receipt. Check the selected leaf fails with its old proof; every survivor passes with its regenerated proof; the root changed; and **all global revocation flags remain false**. Store old proof results for survivors too, without assuming every old proof must fail.

Interpretation: flags invalidate a leaf globally across batches and cannot be cleared; root replacement excludes it only from this batch's current root. It may remain valid in another batch and can be reintroduced later. Replacing a root requires new off-chain proofs for survivors and changes history/availability expectations. Leaf flags preserve the original root/proofs for unaffected leaves. Report separate on-chain receipt gas and off-chain times/bytes; never add nanoseconds to gas or claim root replacement is a permanent global revoke.

**Empty-survivor boundary:** the helper rejects an empty list and the contract has no batch-invalid flag or empty-batch policy. Removing one leaf at N=1 and replacing a root to revoke an entire cohort at any N are `unsupported_empty_survivor_set`, with no transaction and blank gas. Do not anchor zero or invent a sentinel root as a substitute for an agreed empty-set verifier rule. Whole-cohort revocation remains available through N leaf flags. An empty-batch representation, atomic batch revoke, or contract change is a separate coordinated design.

## 6. Proposed implementation files and interfaces

The tree below is **proposed only**; none of these implementation paths is created by this task. Keeping code and outputs under one namespace avoids edits to existing shared files.

```text
experiments/adil/
  hardhat.config.ts          # local-only config, reads shared compiler settings
  tsconfig.json              # extends repository config, includes this namespace
  parameters.ts              # immutable protocol ID, controls and case enums
  lib/
    inputs.ts                # dataset manifests, addresses, tampering, selection
    fixtures.ts              # deployments, issuance, snapshots, state assertions
    transactions.ts          # encode/send/capture without implicit estimates
    verification.ts          # case matrix and native-result oracles
    revocation.ts            # single, sequential, root-replacement workflows
    offchain.ts              # monotonic timing and deterministic serialization
    output.ts                # schemas, raw evidence, validation and summaries
  run-verification.ts
  run-revocation.ts
  validate-run.ts
  test/
    verification.ts
    revocation.ts
    isolation.ts
    output.ts
  .gitignore                 # ignores only this namespace's generated outputs
  .generated/                # isolated Hardhat cache/artifacts, not committed
  runs/<unique-run-id>/
    manifest.json
    inputs.json
    verification.csv
    revocation.csv
    offchain.csv
    summary.csv
    transactions.jsonl
    errors.jsonl
    proof-packages/           # matched root-replacement proof bytes
    validation.json
```

Expected interfaces, with names provisional but responsibilities fixed:

| File | Expected functions |
| --- | --- |
| `parameters.ts` | `loadApprovedParameters()`, `assertLocalRuntime()`; refuse unapproved protocol ID, remote network, unexpected compiler/hardfork/Node or pre-existing output directory |
| `inputs.ts` | `makeDataset(N,seed)`, `makeTamperedHash(hash,excluded)`, `selectReplacementIndices(N)`, `proofLengthHistogram(proofs)`; stable IDs, collision checks and original-index preservation |
| `fixtures.ts` | `deployIssuedFixture(dataset)`, `restoreIssuedFixture(handle)`, `assertIssued(target)`, `assertRevoked(target)`, `prepareRevokedCase(target)`; expose renewed snapshot handle and pre-state metadata |
| `transactions.ts` | `encodeNativeCall(...)`, `sendMeasuredCall(...)`, `captureReceipt(...)`; explicit gas/fees, archival before revert, decimal-string gas and phase tagging |
| `verification.ts` | `buildVerificationCases(fixture)`, `assertNativeResult(case)`, `measureNativeVerification(case)`; semantic negative controls and applicable-case filtering |
| `revocation.ts` | `measureIndependentRevoke(target)`, `measureCohortRevocation(order)`, `measureRootReplacement(removalSet)`; no silent case substitutions |
| `offchain.ts` | `timeStage(stage,fn)`, `serializeProofPackage(survivors,proofs)`; do not include on-chain waits in computation timing |
| `output.ts` | `openExclusiveRunDirectory()`, `appendRawEvidence()`, `writeSampleRow()`, `validateCompleteGrid()`, `summarizeReplaysThenSeeds()` |
| runners | `main()` validates parameters, archives inputs, runs selected workload, validates output, marks run complete only after acceptance |

The isolated Hardhat config sets an absolute repository root for read-only shared sources, test path to this namespace's tests, and cache/artifacts paths under this namespace's `.generated/`. Import shared compiler constants without editing them; explicitly configure only the local network with approved settings. The namespace's TypeScript config extends the repository config, overrides `include` for these scripts/tests/config, and does not require a package or root TypeScript edit. A new local ignore file excludes only `.generated/` and `runs/`; raw datasets must still be archived deliberately for research handoff. The full raw archive should be referenced by hash in the later results report.

### 6.1 Proposed execution commands

**Examples for the future implementation, not commands executed for this design task.** Run from repository root with existing dependencies, after ownership and parameter approval. No `npm install`, new package scripts, or public-network endpoints are needed.

```powershell
# Use the agreed existing Node runtime first; preserve/restore any prior
# TS_NODE_PROJECT value when running interactively.
$env:TS_NODE_PROJECT = 'experiments/adil/tsconfig.json'
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat compile
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat test
npm.cmd test

# Run parameters come from the approved parameters.ts and are recorded in
# manifest.json. Each invocation creates its own exclusive run directory.
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat run experiments/adil/run-verification.ts
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat run experiments/adil/run-revocation.ts
node -r ts-node/register experiments/adil/validate-run.ts --run experiments/adil/runs/<actual-run-id>
```

Separate process invocations require separate run IDs and complete manifests. Within a runner, fixture resets/snapshots apply only to its own ephemeral local network. No Git reset, stash, clean, merge, branch push, or other destructive repository action is part of these commands.

## 7. Output schemas and evidence rules

Use schema version `adil-extension-v1`, UTF-8 CSV with LF and a real CSV serializer/escaping policy, decimal integers, ISO-8601 UTC timestamps, booleans `true/false`, and empty cells for null. No NaN or scientific notation. Finish raw evidence before writing summaries. Readers join on explicit identifiers rather than row order.

`manifest.json` contains run ID, protocol hash, approval/ownership decision reference, schema version, start/finish/status, exact commands, selected parameters, Node/npm/Hardhat/ethers/OpenZeppelin versions, compiler long version/settings, actual network/runtime/client/chain ID, operating system, Git commit/branch/dirty paths, hashes of all experiment/shared input sources and lockfile, dataset seeds, case schedule, timestamp policy, transaction policy, and SHA-256 for output files. Dirty shared input files cause a preflight stop; pre-existing Adil documentation is recorded rather than silently discarded.

Both `verification.csv` and `revocation.csv` use these common columns, followed by their operation-specific columns:

```text
schema_version,run_id,fixture_id,workflow_id,sample_id,recorded_at_utc,protocol_id,
git_commit,network,chain_id,runtime_hardfork,compiler,optimizer_runs,evm_target,
architecture,operation,case_id,semantic_scope,seed,replay,cohort_size,
credential_index,affected_count,step,sample_status,skip_reason,
pre_block_number,pre_block_hash,pre_state_root,block_number,block_hash,
contract_address,caller,tx_hash,receipt_status,gas_used,transaction_count,
calldata_bytes,zero_bytes,nonzero_bytes,proof_length
```

The line breaks above are for readability; the actual header is one line. `sample_status` is `measured`, `not_applicable`, `unsupported`, or `error`. Only measured rows have receipt gas/count. `step` is zero for a single step or 0..N-1 within a sequential workflow. `affected_count` is blank for verification, which changes no credential state; per-query gas is the row's `gas_used`. Index is absent for identifier-only unknown checks; a submitted proof length is still recorded. `transaction_count=1` on each mined sample row. Pre-state roots anchor the fixture actually used, rather than merely the nominal setup.

Verification-specific columns:

```text
input_hash,token_id,batch_id,claim_expected_valid,native_expected_result,
native_observed_result,post_native_result
```

The native result comes from the recorded fixed-state oracle, not from receipt status. `semantic_scope` is `hash_status`, `token_status_only`, or `batch_inclusion_and_global_leaf_flag`. Negative-control rows retain their actual expected true token result. `input_hash`/IDs identify the query; complete original/tampered payload, proof and expected-claim mapping live in `inputs.json` and the archived transaction record.

Revocation-specific columns:

```text
revocation_policy,removed_indices_ref,surviving_count,old_root,new_root,
post_target_valid,post_invariant_ok,offchain_group_id
```

Policy values are `native_one`, `native_cohort_sequential`, or `replace_root_remove_one`. A reference points to the archived original-index removal list. Roots are blank outside Merkle; off-chain IDs are blank if there is no separately timed work. Merkle single flags leave old/new roots equal. Unsupported empty-survivor cases contain no manufactured transaction.

`offchain.csv` columns:

```text
schema_version,run_id,fixture_id,workflow_id,sample_id,offchain_group_id,
seed,replay,cohort_size,affected_count,surviving_count,stage,duration_ns,
artifact_bytes,artifact_sha256,total_proof_hashes,sample_status
```

Stages are `select_survivors`, `tree_and_all_proofs`, and `serialize_proofs`. Warm-up observations are logged in the manifest, excluded from this table's summaries. Serialization bytes/hash describe the exact retained UTF-8 artifact; duration alone is never evidence of actual proof distribution cost.

`summary.csv` columns:

```text
schema_version,run_id,summary_level,summary_metric,architecture,operation,case_id,
semantic_scope,revocation_policy,cohort_size,seed,replay,workflow_id,
index_scope,proof_scope,proof_length,affected_count,transaction_count,sample_count,replay_count,
total_gas,average_numerator,average_denominator,gas_per_affected_decimal,
gas_min,gas_q1,gas_median,gas_q3,gas_max
```

`summary_level` is `workflow`, `seed`, or `across_seeds`. `summary_metric` is `gas_per_query`, `gas_per_independent_revoke`, `gas_per_cohort_workflow`, or `gas_per_root_replacement`. `index_scope` is `all_issued`, `replacement_subset`, or `unknown_single`; matched flag/replacement comparisons use only `replacement_subset`. `proof_scope` is `exact`, `all_lengths`, or `not_applicable`; exact groups have a numeric depth and explicit all-length groups do not pretend to be depth-controlled.

Raw sequential workflow rows are summed once per workflow/replay. Per-seed verification and independent-single summaries first take the median of three gas replays per selected index, then the arithmetic mean over the selected indices; unknown checks have one query. Per-seed whole-cohort summaries use the median of the three actual workflow totals. Root replacement uses the mean of per-selected-index replay medians. Across-seed quantiles describe these five seed-level values, separately by metric and case. Seed-level min/quantiles describe the input-index replay medians, or actual workflow replay totals for the whole-cohort metric. `sample_count` counts the contributing values at that level and `replay_count` records collapsed replays; neither is a claim of statistical independence.

Fields without a defined interpretation at that level stay blank: across-seed `total_gas` is blank; verification affected-count/affected-average fields are blank. Workflow gas-per-affected uses original N as denominator; independent/replacement revocations use 1. Use sorted-value linear-interpolation quantiles, index `(m-1)*p`; do not change quantile definitions between runs. Exclude setup, skipped/errors, and token tampered-claim controls from invalid-rejection summaries. Never aggregate different architectures, cases, semantic scopes, runtime rules, or proof-length strata without explicit separate labels. Off-chain durations remain in their own table; report stage medians separately, never in gas summary fields.

Archive full submitted transaction/receipt pairs as JSONL, including setup phase, pre-state/static-call results, fees, nonce, calldata, gas limit and runtime context. Archive all input lists/proofs. Put failures in `errors.jsonl` with IDs, attempted call, exception/RPC error and any real receipt. A failed expected-success sample prevents the run from being marked complete; do not discard it or keep rerunning until a favorable result appears. A diagnostic retry gets a new attempt/run identity.

## 8. Tests and acceptance criteria

The existing six contract tests must still pass; retain their output. New tests are confined to the proposed namespace. These tests are requirements for a later implementation, not executed or implemented in this design task.

| Test area | Acceptance criterion |
| --- | --- |
| Input reproducibility | Same N/seed generates byte-identical manifests; five seeds are distinct; leaf sets and tampered/unknown hashes do not collide; paired architectures use identical hashes; recipients satisfy all exclusions |
| Native verification | Every case yields the matrix's expected boolean; token tampering remains a labelled true native result, never a false claim of content checking |
| View transaction method | Real mined status-1 receipt and positive gas for true and false cases; static call creates no receipt; an estimate cannot populate `gas_used`; relevant contract state unchanged |
| Proof shapes | Histogram matches section 4.2; all generated proofs verify at each N; odd-size auxiliary tests N=3 and 5; singleton empty proof valid; length-preserving corrupted proof false; no empty-proof mutation fabricated |
| Single revoke isolation | Every sample prechecks issued state and postchecks revoked state; same target can be measured on all three replays only after restoration; restoring snapshot renews ID and resets nonces/flags/token ownership |
| Negative paths | Non-issuer issue/mint/anchor/revoke rejected; repeated revoke and unknown revoke have the existing architecture-specific behavior, tested as correctness rather than successful-revocation gas |
| Actual API differences | Registry repeat/unknown revoke fails; token repeat/unknown burn fails; Merkle repeat flag fails but unknown unrevoked leaf can be flagged; cross-batch flag and mutable-root effects are demonstrated |
| Cohort workflow | N unique targets, N receipts, correct order, all invalid afterward; workflow total equals raw gas sum exactly; independent-single and sequential summaries are separate |
| Root replacement | Old issued fixture restored per replay; same batch overwritten; original survivor hashes unchanged; removed leaf fails, all survivors pass with new proofs; flags unchanged; actual proof artifact retained |
| Empty survivors | N=1 single-root removal and all-batch root removals are explicit unsupported rows with blank gas; no zero/sentinel-root workaround |
| Evidence and schemas | All expected case/seed/replay/index rows present exactly once under sample IDs; gas/count/byte arithmetic valid; skipped/errors not numeric zero; full receipts archived before restore; repeated tx hashes allowed only under distinct replay IDs |
| Runtime and scope | Preflight matches approved local config and input hashes, stops on remote/mismatched runtime; output directory collision fails; no edits to shared files/dependencies or earlier baseline evidence |
| Repeatability and summaries | Identical input/pre-state replays have identical gas; medians collapse replays before seeds; proof strata and semantic-control exclusions respected; no unsupported independence claims |

For unknown-ID correctness and gas, use never-issued IDs rather than a previously revoked token. Repeated/unknown revocation failures are not mixed into ordinary revocation gas. If measuring their failure gas is later requested, local node throw-on-failure behavior and receipt collection need a separate approved design; no settings change is hidden in the primary runner.

## 9. Scientific limitations and team decisions

The extension measures native API costs and one mutable-root policy, not identical student-identity guarantees. Registry/tokens use per-credential state while Merkle shifts data/proofs off-chain. Seed changes and realistic recipient selection change baseline inputs. Transaction-based view measurement models on-chain submission, not ordinary free reads or internal smart-contract integration. Short-circuit false cases differ from full proof checking. Runtime gas floors/refunds prevent simple execution/calldata decompositions. Local timers are sensitive to JIT, garbage collection, host scheduling and proof serialization; they do not measure delivery latency. Five synthetic datasets and deterministic replays are limited evidence, not broad statistical replication. No public-network fees, chain state growth, availability costs or standards-compliance conclusions are supported.

Decisions requiring coordination before future implementation/execution:

1. **Assign ownership** of verification, revocation, root-rebuild policy, harness and analysis; approve the proposed Adil namespace. No repository ownership mapping currently resolves this.
2. **Approve the scientific comparison:** native semantics and the token negative control, case taxonomy, scoped/global revocation distinctions, sequential cohort interpretation, and unsupported empty-tree cases. A common content/student predicate or permanent root-based revocation is a separate design.
3. **Approve controlled methodology:** explicit Osaka runtime versus any Cancun-runtime alternative, Node patch choice, seeded hashes/ordinary recipients, snapshot/block-time policy, all-index selection, fixed transactions, five datasets/three replays and summary definitions. Preserve original baseline labels rather than replacing them. Installing a runtime/dependency remains separately approval-gated.
4. **Coordinate any shared-interface change:** empty-batch semantics, batch invalidation, an atomic batch revoke, ownership-binding fields, unrevocation/reissue policy, soulbound hash-aware verification, shared compiler/network settings, shared helpers, package scripts/dependencies, or integration into the shared runner all require explicit approval. None is necessary for the proposed native-operation version except that empty-root replacement remains unsupported.
5. **Approve evidence retention and handoff:** archive size/location and how ignored run files will be shared. Commits, pushes, PR creation and public-network deployments remain outside this task's authorization.

## 10. Implementation tasks in dependency order

1. Resolve ownership and record approved protocol parameters/case semantics; select an available supported runtime. This gates all experiment implementation.
2. Create only the approved namespace, isolated Hardhat/TypeScript configuration, parameter validation and exclusive output directory handling. Confirm shared settings/source files remain unchanged.
3. Implement seeded input manifests, recipient exclusions, native-case construction and proof-length tests using read-only shared helpers.
4. Implement issued fixtures, renewable snapshots, pre/post-state assertions and phase-tagged transaction/receipt archival. Prove repeatability before adding workload loops.
5. Implement direct-transaction native verification and semantic controls; validate a small N=1/10 grid before the approved full grid.
6. Implement independent single revocation, then separate sequential whole-cohort workflows, reusing proven fixture isolation and receipt recording.
7. Implement the matched Merkle root-replacement policy, off-chain timing/proof packages and unsupported-empty-set records. It depends on the approved policy and stable native leaf-flag comparison.
8. Complete schemas, complete-grid validation and replay/seed summaries; run isolated and existing tests, then approved full experiments, self-review and produce a new report with exact environment/evidence. Do not overwrite the issuance baseline.

Steps 5 and 6 share infrastructure but need explicit experiment ownership; step 7 may overlap a teammate's Merkle responsibility even when every file is isolated. No such overlap is assigned to a named person without evidence. This document is the reviewable design; no implementation, dependency change or shared-file edit has begun.
