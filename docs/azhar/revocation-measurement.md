
# Revocation Benchmark: Measurement Methodology

## 1. Objective

The experiment compares the gas consumption of credential revocation across three existing smart contract architectures:

- HashRegistry
- SoulboundCredential
- MerkleCredentialAnchor

The benchmark uses cohort sizes of 1, 10, 100, and 1,000 credentials.

## 2. Experimental procedure

For each architecture and cohort size:

1. Deploy a fresh contract on the local Hardhat network.
2. Prepare the credentials before measuring revocation.
3. Execute revocation transactions individually.
4. Record the gas used by each mined transaction.
5. Verify that revoked credentials are no longer valid.

For the Merkle architecture, the benchmark first constructs a Merkle tree, anchors its root, and uses the corresponding proofs for verification.

## 3. Gas measurement

The benchmark measures actual transaction gas consumption using the transaction receipt's `gasUsed` value.

The reported gas value is the cumulative gas consumed by all revocation transactions in a cohort.

For example, a cohort of 10 credentials involves 10 individual revocation transactions. Their gas values are added together.

Credential issuance, minting, and initial Merkle root anchoring are preparation operations and are excluded from the reported revocation total.

## 4. Correctness validation

The benchmark checks that a credential becomes invalid after revocation.

Additional targeted tests check that revoking one credential does not invalidate another credential that has not been revoked.

The tests cover all three architectures.

## 5. Architectural differences

HashRegistry uses a hash-based credential registry.

SoulboundCredential represents credentials as non-transferable tokens and tests revocation through token identifiers.

MerkleCredentialAnchor verifies credentials using a Merkle root and proof, while revocation is tracked separately for individual leaves.

These architectures therefore have different state-management and verification semantics. Their gas measurements should be interpreted as comparisons of the implemented revocation operations, not as proof that their complete credential systems are interchangeable.

## 6. Limitations

- Experiments are executed on a local Hardhat EVM, not a live production network.
- The measurements do not represent transaction fees in a specific currency.
- The reported cohort gas is cumulative, not average gas per credential.
- The Merkle experiment uses the existing per-leaf revocation mapping and does not rebuild the Merkle root after revocation.
- Deployment and credential issuance costs are excluded.
- Network latency, confirmation time, and production throughput are not measured.
- Differences in verification semantics limit direct comparisons between architectures.

## 7. Reproduction

Install dependencies:

    npm ci

Run the full test suite:

    npm test

Run the revocation benchmark:

    $env:COHORT_SIZES="1,10,100,1000"
    npx hardhat run scripts/benchmarkRevocation.ts

The generated dataset is:

    results/revocation.csv
