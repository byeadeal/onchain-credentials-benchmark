# Verification: methods, results and interpretation

Prepared 2026-11-13 for adaptation into the research report. Evidence is the completed Adil contribution at `322b06d1359e620c459c3c71f953178fbdefff28`. The independent pre-meeting audit checked saved data without rerunning or replacing measurements. Integration decisions are recorded in [the meeting checklist](./MEETING_INTEGRATION_QA_2026-11-13.md).

## A. Experimental methodology

We evaluated the existing native verification functions of three credential contracts. [HashRegistry.verify](../../contracts/HashRegistry.sol) accepts a credential hash and tests whether its stored status is Issued. [SoulboundCredential.verify](../../contracts/SoulboundCredential.sol) accepts a token ID and checks that the token exists and is locked. It does not compare an externally supplied academic payload, expected credential hash or student identity. [MerkleCredentialAnchor.verify](../../contracts/MerkleCredentialAnchor.sol) accepts a batch ID, leaf and sorted-pair inclusion proof; it checks batch existence, a global per-leaf revocation flag and membership under the stored root. These functions implement different predicates, so their costs describe native operations rather than equivalent end-to-end credential validation.

The [isolated implementation](../../experiments/adil/verification.ts) prepared fresh contracts for each architecture and cohort size N = 1, 10, 100 and 1000. Registry credentials were individually issued, soulbound credentials individually minted to the original synthetic numeric recipients, and Merkle cohorts constructed off-chain and anchored once. Inputs retained the repository's deterministic `credentialHash(N,index)` convention and sorted-pair tree with odd-node promotion. Deployment, issuance, minting, root anchoring, tree/proof construction, proof distribution and preparation revocations were outside measured verification gas.

For each cohort we selected the distinct positions 0, floor(N/2) and N-1. The singleton therefore supplied one position and the other cohorts three. Each selected position had a valid and an invalid query for each architecture, giving 60 measured transactions in one full run. Invalid registry inputs were unissued hashes at position N+index; invalid token IDs were N+index+1, never minted; invalid Merkle queries substituted an absent leaf while retaining the selected original leaf's proof and the existing batch. An unknown-batch early return was not a measured scenario. Twelve post-revocation and four corrupted-proof checks were additional correctness checks, not gas series. Proof corruption used a modified sibling for non-singletons and a wrong nonempty proof for the singleton.

Each query was first evaluated using a static call to assert the expected boolean. The runner independently requested `eth_estimateGas`, then sent the same encoded native call as a gas-consuming EIP-1559 transaction from a separate verifier account with a 1,000,000 gas limit. This permits execution of an existing `view` function without changing Solidity. It archived the mined transaction and receipt and checked the boolean and relevant state again afterward. Receipt status 1 indicates successful execution; an invalid credential can return false while its transaction succeeds. Static `eth_call` checks do not create mined transactions or fees; estimates are simulated gas requirements; receipt `gasUsed` is actual local mined transaction gas, including transaction/calldata overhead. Gas units are not ETH fees or elapsed time.

The [full run metadata](./evidence/verification-2026-11-13/full/metadata.json) records 2026-11-13 07:22:22.910-07:22:33.822 UTC: local Hardhat chain 31337; Hardhat 2.29.1; Node.js 26.13.0; npm 11.20.0; ethers 6.17.0; OpenZeppelin 5.6.1; Solidity 0.8.28; optimizer enabled with 200 runs; Cancun compiler target; explicitly selected Osaka execution hardfork in the isolated configuration. The recorded parent HEAD is `64c48705cdeacc904d53bec1f9c88246d11cea9c`, because the implementation was uncommitted during measurement. Its 15 archived source hashes match the subsequently published contribution. There were no independent replicated full-run trials; different selected positions are workload samples, not replications.

## B. Results

**Table 1. Native verification gas estimates per query at selected index 0.** All entries are actual saved `eth_estimateGas` values in gas units, taken from [the 24-row plotting CSV](../../results/verification.csv). The proof column counts siblings supplied to the Merkle verifier in both scenarios. Values are neither cohort totals nor cohort averages.

| Cohort N | Registry valid | Registry invalid | Soulbound valid | Soulbound invalid | Merkle valid | Merkle invalid | Merkle siblings |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 24,120 | 24,120 | 25,934 | 23,764 | 29,177 | 29,177 | 0 |
| 10 | 24,120 | 24,120 | 25,934 | 23,764 | 32,163 | 32,163 | 4 |
| 100 | 24,108 | 24,120 | 25,934 | 23,764 | 34,456 | 34,458 | 7 |
| 1000 | 24,120 | 24,120 | 25,934 | 23,776 | 36,665 | 36,675 | 10 |

**Separate receipt evidence:** the [detailed CSV](./evidence/verification-2026-11-13/full/verification-detailed.csv) contains 60 paired `gas_estimate` and `receipt_gas` observations, including the other selected positions. All 60 estimates happened to equal their corresponding mined receipt gas values. This observed equality does not make estimation and receipt measurement interchangeable. The [raw signed transactions and receipts](./evidence/verification-2026-11-13/full/transactions.jsonl) remain separate from the estimate-only plotting input.

## C. Results analysis

At index 0, registry estimates were 24,120 gas except for 24,108 at N=100. Independent inspection of encoded inputs found one additional zero calldata byte in that valid query, accounting for the 12-gas difference under the transaction metering used here. The observed fluctuation therefore does not establish an improvement with cohort size. Across all saved registry samples, subtracting standard intrinsic transaction gas calculated from zero/nonzero calldata bytes leaves the same 2,544 gas. This arithmetic check is not an instruction-level execution trace.

Soulbound valid queries remained at 25,934 gas in the index-0 series. Invalid queries were cheaper because the implementation can return false after finding no owner, without evaluating the lock lookup. The 12-gas increase for the invalid token at N=1000 corresponds to an additional nonzero byte in the encoded token ID. These patterns concern existence/lock checks, not validation of academic content or identity.

Merkle valid-query estimates increased from 29,177 to 36,665 gas as the index-0 proof grew from zero to ten siblings, an absolute increase of 7,488 gas. The selected proof lengths were 0, 4, 7 and 10. Both hashing work and larger calldata contribute; this experiment does not isolate a pure cost per proof sibling. Odd-node promotion also makes position consequential: the last selected leaves at N=10, 100 and 1000 had 2, 4 and 8 siblings, with valid receipt costs of 30,693, 32,207 and 35,205 gas respectively. Thus index 0 does not represent every proof in a cohort.

Invalid scenarios execute different paths. The unissued registry hash still requires its status lookup; the unknown token can short-circuit; and the absent Merkle leaf is tested against an existing batch using a full supplied proof. Small valid/invalid Merkle differences can reflect byte composition and execution paths; without an execution trace their separate contributions should not be asserted. No statistical significance or cross-architecture percentage advantage is inferred from this single run.

## D. Discussion

The measurements demonstrate the cost of the implemented native checks. Registry verification consults an issued-hash record; token verification consults token existence and lock state; Merkle verification additionally processes a supplied inclusion proof. A successful token-status check alone does not show that academic content is correct or that the presenter is the credential subject. Likewise, hash status and proof inclusion require external interpretation and trustworthy input binding. Any comparison must preserve these semantic boundaries rather than declare a universally superior verifier.

Verification here is one query after setup. Issuance measures publishing a cohort, with N individual transactions for registry/token issuance and one root publication for Merkle. Azhar's revocation series sums N sequential native revocations; it is not a single-query verification cost, an atomic batch operation or a root-rebuilding strategy. Combined figures may show these different workloads in separate, explicitly labelled panels; their gas columns must not be treated as a common denominator.

## E. Limitations and threats to validity

- One local full execution run, deterministic positions and synthetic credential/recipient inputs limit workload coverage. The pilot was a development check, not an independent replication of the full experiment. No confidence intervals or population-wide estimates are justified.
- Native predicates and invalid cases differ. Unknown batches and revoked/corrupted inputs were not additional measured gas scenarios. There is no end-to-end identity, academic-content or presenter-authentication experiment.
- Proof length, position, calldata bytes and transaction overhead affect reported costs. Off-chain construction, distribution, retrieval and identity-processing costs were not timed or priced.
- Execution used local Hardhat, not a public network. Cancun denotes the compiler target, while Osaka is the actual execution hardfork. Results should not be described as Cancun-runtime measurements.
- Node.js 26 was outside the installed Hardhat version's declared supported Node ranges. Commands succeeded in this environment; that observation does not remove the compatibility qualification.
- The pre-meeting audit checked source/artifact hashes, signed transaction hashes, inputs, proof calculations and saved arithmetic. It did not recreate the ephemeral chain, re-execute receipt gas or independently establish external block inclusion. Archived tests report 11 verification tests and six original tests passing; no suite or benchmark was rerun for this documentation package.
- No persistent state-growth, public-network fee, data-availability or full lifecycle cost measurement is established by these verification results. Existing academic references remain unverified. If background claims about general EVM metering or credential standards are added to the paper, use **[CITATION NEEDED: check original specification/source]** until actually verified.

## F. Figure caption

**Native verification gas estimates versus cohort size.** Each point is the actual `eth_estimateGas` value for credential position 0 in a prepared cohort of 1, 10, 100 or 1000 credentials, for the specified valid or invalid native query. Points are not cohort means or independently replicated trials. Merkle proofs at this position contain 0, 4, 7 and 10 siblings. The contracts implement different verification predicates. Setup and off-chain work are excluded. Mined receipt measurements are archived separately, although all sampled estimates and receipt values matched in this local run. Solidity 0.8.28, optimizer 200 runs, Cancun compiler target; local Hardhat Osaka execution. A combined figure's issuance-derived metadata footer does not establish other datasets' runtime provenance.

## G. Conclusion

In this local experiment, selected registry and token-status verification costs varied little across the tested cohort sizes, while Merkle verification cost increased with the supplied proof length. The results support a narrow comparison of these native operations under recorded conditions. They do not establish equivalent credential guarantees, replicated performance, total lifecycle cost or a universal architectural ranking.
