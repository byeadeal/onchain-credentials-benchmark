# Experiment protocol — Adil

Status: methodological audit of the existing implementation, 2026-11-06. This protocol records the reproduced baseline and decisions needed for future work. It does not authorize or implement changes to shared contracts, scripts, dependencies, or settings. New measurements must receive a separate run identity and must not replace the baseline.

Source revision: `967ee598fb6b811423bd1ff9b6470841f4a4d432`, branch `adil-work`. See the [baseline report](./baseline-report.md) for observations and preserved evidence. All existing academic citations, paper claims, and claimed research gaps remain **UNVERIFIED**. The technical specifications linked below support specific API or gas-accounting statements only; they do not validate the project's literature review or standards compliance.

## 1. Research questions and variables

1. For the implemented designs, how do deployment gas, total cohort issuance gas, and issuance transaction count vary with cohort size?
2. What additional verification and revocation work does each design require to satisfy an explicitly defined credential-validity predicate?
3. How do costs move between contract state, transactions, calldata, off-chain computation, proof availability, and credential holders?

The present baseline answers question 1 for one execution of each architecture/cohort pair. Questions 2 and 3 require additional measurements. No significance tests, confidence intervals, state-size estimates, or end-to-end cost claims follow from these runs.

| Variable | Baseline definition | Extension decision |
| --- | --- | --- |
| Architecture | HashRegistry, SoulboundCredential, MerkleCredentialAnchor | Keep implementation version explicit; conclusions concern these implementations |
| Cohort size | 1, 10, 100, 1000 | Freeze sizes and input generation before trials |
| Operation | Deployment; initial cohort issuance | Add separately labelled verification and revocation cases |
| Outcomes | Receipt `gasUsed` totals; transaction count; `floor(totalGas / N)` for issuance | Retain totals; define exact averages, per-call samples, distributions, calldata and storage metrics |
| Future workload variables | Not varied | Credential validity, proof depth/index, recipient type, revocation fraction, batch age, issuer and caller roles |

## 2. Controlled settings and execution boundary

- Compiler: Solidity `0.8.28+commit.7893614a`; optimizer enabled, 200 runs; compiler EVM target `cancun`, as configured in [settings](../../scripts/lib/settings.ts) and [Hardhat configuration](../../hardhat.config.ts).
- Observed runtime: local in-process Hardhat `2.29.1`, network `hardhat`, chain ID 31337, default runtime hardfork `osaka`, automining enabled, no configured fork. **Compiler target and execution hardfork are distinct.** The runtime hardfork is not pinned by the project configuration.
- Installed dependencies, package lock, Node/npm, OS, resolved network settings, and compiled-source checks are recorded in [environment.json](./evidence/environment.json) and [compiled-source-verification.json](./evidence/compiled-source-verification.json). No dependencies were installed or changed.
- Every architecture/cohort pair deploys a fresh contract. The first invocation processes cohorts 1, 10, 100 sequentially on one ephemeral chain; cohort 1000 runs in a second invocation on a new ephemeral chain. Fresh contracts do not imply a chain reset between every pair.
- The issuer is the default local development signer. These are simulated transactions using the existing harness; no public network, external wallet credentials, or real funds are involved.
- Inputs use the shared [credential helper](../../scripts/lib/leaves.ts): `keccak256(solidityPacked([string,uint256,uint256], ["NU-BSc-2026", N, index]))`. The hash does not bind a student address, issuer, chain, or contract. Cohort size changes the payload, so data content is not identical between cohort sizes.
- Soulbound recipients are numeric addresses `index + 1`. They have many zero bytes and include precompile addresses. Do not describe them as representative student wallets. Repeated minting to one recipient, random ordinary addresses, and contract recipients are different workloads.
- Each issuance transaction is submitted and awaited separately. Gas totals include transaction overhead, calldata charges and contract execution; deployment is a separate row. Merkle construction and proof generation happen off-chain and are excluded from gas totals.

## 3. What exists and what the six tests establish

| Component | Implemented behavior | Actually asserted by existing tests |
| --- | --- | --- |
| [HashRegistry](../../contracts/HashRegistry.sol) and [tests](../../test/HashRegistry.ts) | Issuer-only issue/revoke; hash-keyed status and timestamp; duplicate issuance rejected, including previously revoked records | Unknown hash verifies false; issue/revoke events and true/false lifecycle; duplicate issue rejected; unknown revoke rejected; non-issuer revoke rejected |
| [SoulboundCredential](../../contracts/SoulboundCredential.sol) and [tests](../../test/SoulboundCredential.ts) | ERC-721 mint with stored hash and locked flag; transfers and approvals blocked; issuer burn deletes stored hash and lock | Mint/lock event; owner, stored hash, locked and verification state; one `transferFrom` and `approve` rejection; non-issuer revoke rejection; burn event, false verification/lock and missing owner |
| [MerkleCredentialAnchor](../../contracts/MerkleCredentialAnchor.sol) and [tests](../../test/MerkleCredentialAnchor.ts) | Issuer anchors or replaces roots; sorted-pair proof verification; global leaf revocation flag; unknown batches fail closed | All three leaves in an odd-sized tree verify; empty proof fails for one leaf of that tree; unknown batch fails; singleton empty proof succeeds; non-issuer revoke and repeat revoke fail; revoked valid leaf fails |
| [Merkle helper](../../scripts/lib/merkle.ts) | Sorted sibling pairs; odd nodes promoted unchanged; builds root and all proofs; empty input throws | Exercised indirectly for three leaves and a singleton; no dedicated helper test suite |
| [Benchmark](../../scripts/benchmark.ts) | Deployment and issuance receipts, cohort override, CSV generation | No benchmark-specific tests; baseline CSV validation is documented separately |

There are two tests per contract. The suite does not establish complete authorization coverage: non-issuer `issue`, `mint`, and `anchor` are not tested. Other gaps include `setApprovalForAll`, both safe-transfer overloads, contract recipients and callbacks, unknown/repeated burns, hash deletion on burn, reissuance policies, root replacement, cross-batch revocation, arbitrary-leaf revocation, zero roots/hashes, malformed proofs, larger proof trees, and all CSV/error paths. Passing six tests is a basic regression check, not a security audit or proof of standards compliance.

## 4. Operation meanings and comparison boundaries

| Operation | HashRegistry | SoulboundCredential | MerkleCredentialAnchor |
| --- | --- | --- | --- |
| Issuance | One hash status/timestamp per credential; N transactions | One owned, locked ERC-721 plus stored hash per credential; N transactions | One cohort root/timestamp/existence record; 1 anchoring transaction; individual hashes and proofs remain off-chain |
| Verification | Supplied hash currently has Issued status | Supplied token ID exists and is locked; does not compare expected hash or expected student | Supplied leaf belongs to the current batch root and is not globally revoked |
| Revocation | Existing issued hash changes status; record persists; reissue disallowed | Existing token burned; hash/lock removed; same hash can later be minted under a new ID | Any leaf can be flagged without membership proof or prior issuance; flag applies across batches and persists through root replacement |

These operations share a broad lifecycle purpose but differ in guarantees and retained data. HashRegistry and Merkle do not record student ownership; the soulbound design does. None authenticates a real student or the truth of academic claims. The common synthetic payload does not resolve those differences. Duplicate hashes are rejected by the registry but can be minted more than once as soulbound tokens. An existing Merkle batch can be overwritten; this can invalidate old inclusion proofs even without setting a revocation flag.

Fair comparisons at this stage are deployment cost of these exact contracts and transaction gas to publish these particular cohort representations. Report both total gas and transaction counts, with deployment separate. If reporting setup-inclusive gas, explicitly derive `deployment + issuance`; do not silently add it to existing issuance totals. The amortized Merkle cost is root publication gas divided by N, not a measured individual credential transaction or a complete delivery cost.

Verification of a token ID cannot be presented as equivalent to verifying an expected credential payload. Decide whether the question is native validity checking or a common predicate such as “this supplied payload belongs to this student and is currently valid.” The latter requires additional retrieval/checking and potentially a changed interface, subject to shared-scope approval.

For revocation, compare a known issued credential in each native implementation first, and label the different storage effects. Root rebuilding/replacement is a separate Merkle policy involving off-chain reconstruction, new proofs, availability, and possibly unchanged global revocation flags. It is not already implemented as a benchmark alternative and is not automatically equivalent to a single flag or burn. Burning/deleting state does not erase historical transactions or logs; storage refunds and retained state must be reported separately from state growth claims.

## 5. Cost accounting: measured and missing

The [current harness](../../scripts/benchmark.ts) sums `receipt.gasUsed`. It measures no gas price or currency cost, completion latency, persistent state bytes, calldata bytes, fee breakdown, storage-access trace, or off-chain resource consumption. Verification/revocation functions in the script are empty placeholders. No repeated trials, medians/spread, L1 testnet runs, rollup executions, or data-availability fees exist.

The Merkle helper constructs layers and materializes every leaf's proof before anchoring. Pair hashing for a tree and assembling all proofs are distinct work; the current all-proof representation can require order N log N total proof entries. Neither that computation, proof distribution, payload storage, nor the availability service is measured. Only a batch ID and root are passed to `anchor`; proof bytes are passed to `verify`, never to `anchor`.

Derived ABI lengths, **not additional measured baseline columns**: registry `issue` uses 36 bytes; soulbound `mint` and Merkle `anchor` each use 68 bytes. Native hash/token verification uses 36 bytes, while Merkle verification uses `132 + 32k` bytes for k siblings. These include the four-byte selector and ABI arguments, exclude transaction envelopes, and are not L2 compressed sizes. Zero/nonzero byte composition affects gas, so equal lengths need not mean equal calldata charges. [EIP-7623](https://eips.ethereum.org/EIPS/eip-7623) also defines a transaction calldata floor; fee attribution depends on the runtime rules.

One root transaction versus N individual transactions includes the benefit of batching at the chosen API boundary. It does not prove the same gap against a future batched registry or token implementation. Cohort totals spanning many transactions do not need to fit into one block. A constant-size root record is not evidence that total system storage is constant: leaves/proofs remain somewhere, multiple batches accumulate, and revocation flags grow per revoked leaf.

## 6. Measuring verification gas without changing view functions

Normal calls to `view` functions use `eth_call`; they execute code but do not create a transaction receipt or charge the caller an on-chain fee. They must not be reported as zero computational work. [`eth_estimateGas`](https://ethereum.org/developers/docs/apis/json-rpc/#eth_estimategas) simulates a transaction and returns an estimate; that estimate is not an observed receipt measurement.

For a future receipt-based local benchmark, explicitly send encoded verification calldata as a transaction to the existing contract, using ethers `contract.verify.send(...)` or a local signer's `sendTransaction({to, data})`. A `view` ABI does not prevent explicit transaction submission. The [ethers API](https://docs.ethers.org/v6/api/contract/#BaseContractMethod-send) distinguishes send, estimate and static-call operations. Record mined receipt `gasUsed` under a separate verification-transaction operation. Preserve the expected boolean via a separate fixed-state call: receipt success alone does not mean a credential was valid, because these verifiers return false rather than revert for ordinary invalid cases. No verification transactions were executed in this work package.

Keep three metrics separate: observed transaction gas, simulated gas estimates, and off-chain RPC latency. A wrapper contract could measure internal-call gas, but changes call overhead and access warming; that would require an approved separate harness and cannot be mixed with direct transactions. Do not estimate execution-only cost by blindly subtracting 21,000 from receipts: calldata, runtime floors, and call overhead also matter.

Define valid, unknown credential/token/batch, wrong full-length proof, and revoked cases separately. Unknown batches and revoked leaves return early; malformed ABI or out-of-gas errors are different from a boolean false. For odd-sized trees, proof lengths vary by leaf; predefine leaf sampling or measure all leaves and report depth. A singleton needs an empty proof. Use fixed state, caller, block context and transaction access policy. Warm accesses within one transaction differ from cold accesses in separate transactions; see [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929).

## 7. Decisions to fix before adding measurements

1. **Operation semantics:** choose native checks versus a common payload/student predicate; define duplicate/reissue behavior, batch replacement, global versus batch-local revocation, and the root-rebuild alternative. Agree on success and invalid-case labels before comparing gas.
2. **Execution and inputs:** agree on compiler target and explicit runtime hardfork, supported Node version, dependency lock, chain reset policy and ordering, caller, recipient model, cohort payloads, and proof sampling. Preserve this Cancun-target/Osaka-runtime baseline as a separate configuration. The installed Hardhat declares Node 20/22/24 support, while this run uses Node 26.13.0. The recipient generator overlaps precompiles; OpenZeppelin's safe mint checks recipient code, and precompiles start warm under EIP-2929. The potential gas bias needs a controlled investigation; its magnitude was not isolated here.
3. **Measurement and evidence:** decide transaction receipts versus estimates, raw per-transaction evidence, total versus amortized/setup-inclusive costs, fractional-average presentation, calldata/DA/off-chain boundaries, revocation amount and refund accounting, storage-growth metric, trial count and summary statistics, and timestamp/network/version fields. Use unique output files and derive the actual network label; the existing CSV hardcodes `hardhat`.

## 8. Validity threats and allowed conclusions

There is one trial per architecture/cohort pair, not independent replicates. Increasing N also changes payload hashes, recipient byte patterns, token counters and zero-to-nonzero write patterns. Non-random recipients overlap special addresses. The synthetic credentials omit identity binding and real workloads. Unequal verification/revocation semantics and batching create construct-validity limits. Cached compilation was checked against current source inputs, but this was not a clean-install or clean-build reproduction. Local execution omits congestion, finality, network latency, real fee markets, rollup compression/DA, and proof availability failures. No statistical or universal “cheapest architecture” claim is justified.

Any approved future methodology, configuration, contract or input change must be versioned, explained, and measured separately. Do not rewrite this baseline or treat an unverified academic citation as evidence.
