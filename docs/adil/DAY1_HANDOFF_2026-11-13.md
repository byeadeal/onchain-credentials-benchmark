# Adil Day 1 handoff - 2026-11-13

**Status: verification implementation and experiments COMPLETE.** Commit/push are authorized for this package; the final Git log/remote refs establish publication status. Assignment: Adil owns verification/methodology; Alikhan owns issuance/results/plotting; Azhar owns revocation. No teammate implementation, shared contract, dependency, shared configuration, or original benchmark was edited or merged.

## A. Completed contribution

- Isolated local benchmark: [runner](../../experiments/adil/run-verification.ts), [measurement/validation helpers](../../experiments/adil/verification.ts), [saved-run validator](../../experiments/adil/validate-run.ts), [tests](../../experiments/adil/test/verification.ts), [Hardhat config](../../experiments/adil/hardhat.config.ts), [TypeScript config](../../experiments/adil/tsconfig.json), [local ignore rules](../../experiments/adil/.gitignore), and [LF rules](../../experiments/adil/.gitattributes).
- Team output: [results/verification.csv](../../results/verification.csv), exactly **24 estimate-only rows** with columns `architecture,cohort_size,scenario,gas`.
- Actual mined receipt data: [full/verification-detailed.csv](./evidence/verification-2026-11-13/full/verification-detailed.csv), **60 samples**, with separate `receipt_gas` and `gas_estimate` columns, static-call booleans, proof lengths, calldata byte counts, transaction hashes, runtime and source provenance.
- [Raw transactions/receipts](./evidence/verification-2026-11-13/full/transactions.jsonl), [fixtures](./evidence/verification-2026-11-13/full/fixtures.json), [structured measurements](./evidence/verification-2026-11-13/full/measurements.json), [correctness checks](./evidence/verification-2026-11-13/full/correctness-checks.json) and [environment/source hashes](./evidence/verification-2026-11-13/full/metadata.json) are retained. The [pilot](./evidence/verification-2026-11-13/pilot/) is separate immutable evidence.
- Updated [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) and [WORKLOG.md](./WORKLOG.md). Earlier issuance evidence and the large-grid design document remain historical records; the current task explicitly supersedes that proposed grid and ownership allocation.

The runner uses the original `credentialHash(N,index)` and sorted-pair Merkle helper. It fully prepares each architecture/cohort, then tests unique indices `[0, floor(N/2), N-1]`. N=1 produces one selected index; other agreed cohorts produce three. There is **one run**, not repeated independent trials. The plot-compatible CSV selects **index 0's actual estimate**, not an average across unlike proof depths. All selected samples remain in the detailed data.

Invalid inputs are precise: registry hash `credentialHash(N,N+index)` never issued; soulbound token ID `N+index+1` never minted; Merkle leaf `credentialHash(N,N+index)` absent from the set, with the original selected leaf's proof **against the existing batch**. Static calls assert true for valid and false for invalid inputs. Revoked inputs and proof corruption are correctness-only checks, not revocation gas benchmarks.

## B. Actual verification results

Gas units below are **per query at index 0**. E = independently collected `eth_estimateGas`; R = mined transaction receipt `gasUsed`. They happen to be equal in all 60 observed pairs; equality does not make the two procedures interchangeable. Deployment, issuance, anchoring, proof generation and preparation revokes are excluded.

| Architecture | N | Proof siblings | Valid E | Valid R | Invalid E | Invalid R |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| HashRegistry | 1 | - | 24,120 | 24,120 | 24,120 | 24,120 |
| HashRegistry | 10 | - | 24,120 | 24,120 | 24,120 | 24,120 |
| HashRegistry | 100 | - | 24,108 | 24,108 | 24,120 | 24,120 |
| HashRegistry | 1000 | - | 24,120 | 24,120 | 24,120 | 24,120 |
| SoulboundCredential | 1 | - | 25,934 | 25,934 | 23,764 | 23,764 |
| SoulboundCredential | 10 | - | 25,934 | 25,934 | 23,764 | 23,764 |
| SoulboundCredential | 100 | - | 25,934 | 25,934 | 23,764 | 23,764 |
| SoulboundCredential | 1000 | - | 25,934 | 25,934 | 23,776 | 23,776 |
| MerkleCredentialAnchor | 1 | 0 | 29,177 | 29,177 | 29,177 | 29,177 |
| MerkleCredentialAnchor | 10 | 4 | 32,163 | 32,163 | 32,163 | 32,163 |
| MerkleCredentialAnchor | 100 | 7 | 34,456 | 34,456 | 34,458 | 34,458 |
| MerkleCredentialAnchor | 1000 | 10 | 36,665 | 36,665 | 36,675 | 36,675 |

The singleton uses its correct empty proof. Odd-node promotion makes some later-index proofs shorter: selected last leaves have 2, 4 and 8 siblings at N=10,100,1000, with valid receipt gas 30,693; 32,207; 35,205 respectively. For N=1000, the selected middle leaf has 10 siblings and uses 36,727 gas. This is why the plotting series must disclose its index-0 selection rather than stand for every credential in the cohort. Small byte-pattern differences can change transaction gas; a slight difference is not automatically an architectural scaling effect.

## C. Reproduction and checks

Run from the repository root in Windows PowerShell, using the existing installed dependencies. Do not run installation commands. The isolated configuration reads the shared Solidity settings and explicitly retains **Osaka execution** independently of the **Cancun compiler target**. All generated compilation files go under the ignored isolated `.generated/` directory.

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --project experiments/adil/tsconfig.json
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat test
npm.cmd test

# Pick fresh evidence directories: the runner refuses to overwrite evidence.
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$env:ADIL_COHORT_SIZES = '1,10'
$env:ADIL_OUTPUT_DIR = "docs/adil/evidence/verification-reproduction-$stamp/pilot"
$env:ADIL_PUBLISH_TEAM_CSV = '0'
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat run experiments/adil/run-verification.ts
node -r ts-node/register experiments/adil/validate-run.ts $env:ADIL_OUTPUT_DIR

$env:ADIL_COHORT_SIZES = '1,10,100,1000'
$env:ADIL_OUTPUT_DIR = "docs/adil/evidence/verification-reproduction-$stamp/full"
# Keep the committed team CSV intact during reproduction. A candidate estimate
# CSV is always written inside the new evidence directory.
$env:ADIL_PUBLISH_TEAM_CSV = '0'
.\node_modules\.bin\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat run experiments/adil/run-verification.ts
node -r ts-node/register experiments/adil/validate-run.ts $env:ADIL_OUTPUT_DIR
Remove-Item Env:ADIL_COHORT_SIZES, Env:ADIL_OUTPUT_DIR, Env:ADIL_PUBLISH_TEAM_CSV
```

If those environment variables already had values, save and restore them instead of removing them. The actual initial full run used `ADIL_PUBLISH_TEAM_CSV=1` to create the previously absent team CSV. It deliberately refuses to overwrite an existing team output; compare a reproduced candidate before replacing any own results. Exact executed commands, environment values and UTC intervals are recorded in [pilot-command.json](./evidence/verification-2026-11-13/pilot-command.json), [full-command.json](./evidence/verification-2026-11-13/full-command.json) and [validation-commands.json](./evidence/verification-2026-11-13/validation-commands.json).

Observed full measurement interval: **2026-11-13 07:22:22.910-07:22:33.822 UTC**, parent source commit `64c48705cdeacc904d53bec1f9c88246d11cea9c`. The implementation was uncommitted during measurement; metadata records its exact SHA-256 sources for comparison with the final contribution commit. Versions: Node 26.13.0, npm 11.20.0, Hardhat 2.29.1, ethers 6.17.0, OpenZeppelin 5.6.1; Solidity 0.8.28, optimizer enabled/200; local chain 31337, Osaka runtime, Cancun target. No public network or real funds were used.

| Check | Actual outcome |
| --- | --- |
| Isolated TypeScript check | Exit 0 |
| Adil verification tests | **11 passing** |
| Original `npm.cmd test` | **6 passing** |
| Pilot saved-data validator | Exit 0; 24 receipts / 12 compatibility rows |
| Full saved-data validator | Exit 0; 60 receipts / 24 compatibility rows |
| Full correctness checks | 12 revoked-input checks and 4 corrupted-proof checks passed |

Raw command outputs are in [the evidence directory](./evidence/verification-2026-11-13/). An initial standalone-validator invocation failed because TypeScript's Hardhat ethers augmentation was not loaded; a type-only import fixed it. The final typecheck/tests/validators passed. This was a tooling issue, not a failed gas experiment; it is disclosed in [development-checks.json](./evidence/verification-2026-11-13/development-checks.json). Pilot metadata retains pre-fix hashes; the full run records final hashes.

## D. Scientific limitations

- Native semantics differ: registry checks hash status; soulbound checks token existence/lock, **not an externally expected payload or student identity**; Merkle checks inclusion plus a global leaf flag. An invalid token is not the same semantic object as a tampered academic claim.
- The same static query checks expected booleans before/after each transaction. Receipt status 1 proves successful execution, not a true credential result. A static read has no mined receipt or on-chain fee. Estimates are separately simulated; receipt gas includes transaction/calldata overhead, not just verifier execution.
- Proof depth and zero/nonzero calldata patterns affect the data. Invalid Merkle queries use an existing batch and full supplied proof, not an unknown-batch early return. Corruption at N=1 is a wrong nonempty proof; at larger N it is a same-length sibling-bit mutation.
- One local run and three deterministic positions are limited workload coverage, not statistical validation. Setup uses the original synthetic payloads and numeric recipient convention; recipient preparation costs are excluded. No off-chain CPU/distribution, persistent state, fees/DA, public-chain behavior, or revocation-cost series is measured here.
- Node 26 remains outside the installed Hardhat version's declared Node 20/22/24 support ranges. We preserved the working environment rather than installing or changing runtimes under the deadline. A controlled supported-runtime repetition remains useful follow-up.
- All existing academic citations and literature-gap claims remain **UNVERIFIED**. These local values are preliminary experiment evidence, not results attributed to a paper or proof of universal superiority.

## E. Integration for Alikhan and Azhar

Remote work was read without switching to, editing or merging teammate branches. [Alikhan's open PR #1](https://github.com/byeadeal/onchain-credentials-benchmark/pull/1) points to `alikhan/results` at `c1b6fb23ac95965511cb23758f7c0b3916847f74`. Its plotter explicitly defines verification `gas` as `eth_estimateGas`; the 24-row team CSV matches those labels/units and uses exactly index 0. [Remote-status evidence](./evidence/verification-2026-11-13/remote-status.json) also records Azhar's inspected branch revision. Shared contract/helper/config versions match across these workstreams.

**Alikhan:** after the team reviews and integrates the branches, use the team CSV as the optional verification input to his unchanged plotter. On a checkout containing his existing plotter and plotting environment:

```powershell
python scripts/plot_results.py --verification results/verification.csv
```

This is an integration instruction, **not a command executed on Adil's branch**: the plotter is not present here and no Python dependencies were installed or teammate files copied. We verified compatibility against the remote parser's schema, label and uniqueness rules; we did not claim a rendered combined figure. Receipt-based detailed data must be a separately labelled analysis/figure; feeding it into the estimate-labelled plotting column would misrepresent it.

**Azhar:** his revocation branch sums N actual receipt costs to revoke a fully issued cohort using the existing per-credential APIs. Adil's revoked-input checks only establish that verification returns false after native revoke; they do not reproduce or replace his gas series. Joint report text must distinguish per-query verification estimates/receipts from cohort-wide revocation totals, and root replacement remains separate policy work.

**Team integration:** review branch diffs and choose the main-branch integration order. No teammate branch, main merge, automatic PR creation, force-push, or public deployment is part of the attached task's authorization. The short chat message also mentioned a PR; that clarification is pending separately unless Adil explicitly answers it.

## F. Remaining actions and meeting explanation

1. Alikhan regenerates the combined plot in his established plotting environment after team integration, keeping the estimate label and sampling note.
2. Azhar confirms that his report describes sequential cohort-total revocation and the runtime/environment used, so joint tables do not imply identical units or semantics.
3. Team reviews the contribution, integration/PR decision, supported-runtime repeat, and only the additional research needed for the report. References and any state-growth claims still need their own evidence.

**Adil's verbal handoff:** “I implemented verification for all three designs and measured cohorts 1, 10, 100 and 1000. Each query was checked for the expected boolean, estimated separately, and sent as a real local transaction. The team CSV has 24 gas-estimate rows for your plotter; the 60 receipt samples and proof lengths are archived separately. All 17 tests passed. These are native checks with different guarantees, especially the token-ID check, and the local single run is preliminary.”

## Exact changed-file inventory

Implementation files and the team CSV are linked in section A. The only updated existing documents are the context and worklog. Additional evidence files below are all under `docs/adil/evidence/verification-2026-11-13/`:

- [remote-status.json](./evidence/verification-2026-11-13/remote-status.json)
- [development-checks.json](./evidence/verification-2026-11-13/development-checks.json)
- [pilot-command.json](./evidence/verification-2026-11-13/pilot-command.json), [pilot-command.txt](./evidence/verification-2026-11-13/pilot-command.txt)
- [full-command.json](./evidence/verification-2026-11-13/full-command.json), [full-command.txt](./evidence/verification-2026-11-13/full-command.txt)
- [typecheck.txt](./evidence/verification-2026-11-13/typecheck.txt), [verification-tests.txt](./evidence/verification-2026-11-13/verification-tests.txt), [original-tests.txt](./evidence/verification-2026-11-13/original-tests.txt)
- [validate-pilot.txt](./evidence/verification-2026-11-13/validate-pilot.txt), [validate-full.txt](./evidence/verification-2026-11-13/validate-full.txt), [validation-commands.json](./evidence/verification-2026-11-13/validation-commands.json)
- [final-review.json](./evidence/verification-2026-11-13/final-review.json)
- Pilot: [metadata.json](./evidence/verification-2026-11-13/pilot/metadata.json), [fixtures.json](./evidence/verification-2026-11-13/pilot/fixtures.json), [correctness-checks.json](./evidence/verification-2026-11-13/pilot/correctness-checks.json), [measurements.json](./evidence/verification-2026-11-13/pilot/measurements.json), [transactions.jsonl](./evidence/verification-2026-11-13/pilot/transactions.jsonl), [verification-detailed.csv](./evidence/verification-2026-11-13/pilot/verification-detailed.csv), [verification-estimates.csv](./evidence/verification-2026-11-13/pilot/verification-estimates.csv).
- Full: [metadata.json](./evidence/verification-2026-11-13/full/metadata.json), [fixtures.json](./evidence/verification-2026-11-13/full/fixtures.json), [correctness-checks.json](./evidence/verification-2026-11-13/full/correctness-checks.json), [measurements.json](./evidence/verification-2026-11-13/full/measurements.json), [transactions.jsonl](./evidence/verification-2026-11-13/full/transactions.jsonl), [verification-detailed.csv](./evidence/verification-2026-11-13/full/verification-detailed.csv), [verification-estimates.csv](./evidence/verification-2026-11-13/full/verification-estimates.csv).
