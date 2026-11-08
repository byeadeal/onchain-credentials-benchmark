import fs from "fs";
import path from "path";
import assert from "node:assert/strict";
import { ethers } from "hardhat";
import type { ContractTransactionResponse } from "ethers";

import { credentialHash } from "./lib/leaves";
import { merkleTree } from "./lib/merkle";

const DEFAULT_COHORT_SIZES = [1, 10, 100, 1000];

type Architecture =
  | "hash_registry"
  | "soulbound"
  | "merkle_anchor";

type ResultRow = {
  architecture: Architecture;
  cohort_size: number;
  scenario: "revoke";
  gas: bigint;
};

// Same deterministic student addresses as the issuance benchmark.
function studentAddress(index: number): string {
  return ethers.getAddress(
    ethers.toBeHex(index + 1, 20)
  );
}

// Read the actual gas used from a mined transaction receipt.
async function transactionGas(
  transaction: Promise<ContractTransactionResponse>
): Promise<bigint> {
  const tx = await transaction;
  const receipt = await tx.wait();

  if (receipt === null) {
    throw new Error("Transaction receipt was not found");
  }

  return receipt.gasUsed;
}

// Read cohort sizes from the environment or use defaults.
function cohortSizes(): number[] {
  const raw = process.env.COHORT_SIZES;

  if (!raw || raw.trim() === "") {
    return DEFAULT_COHORT_SIZES;
  }

  const sizes = raw.split(",").map(Number);

  if (
    sizes.some(
      (size) => !Number.isInteger(size) || size < 1
    )
  ) {
    throw new Error(
      "COHORT_SIZES must contain positive integers"
    );
  }

  return sizes;
}

// Architecture 1: HashRegistry
async function benchmarkHashRegistry(
  cohortSize: number
): Promise<ResultRow> {
  console.log("  Preparing HashRegistry credentials...");

  const contract = await (
    await ethers.getContractFactory("HashRegistry")
  ).deploy();

  await contract.waitForDeployment();

  const hashes = Array.from(
    { length: cohortSize },
    (_, i) => credentialHash(cohortSize, i)
  );

  // Issue credentials before measuring revocation.
  for (const hash of hashes) {
    await (await contract.issue(hash)).wait();
  }

  let totalGas = 0n;

  // Measure actual revocation transaction gas.
  for (const hash of hashes) {
    totalGas += await transactionGas(
      contract.revoke(hash)
    );

    // Confirm that the revoked credential is invalid.
    const isValid = await contract.verify(hash);

    assert.equal(
      isValid,
      false,
      "HashRegistry: revoked credential is still valid"
    );
  }

  return {
    architecture: "hash_registry",
    cohort_size: cohortSize,
    scenario: "revoke",
    gas: totalGas
  };
}

// Architecture 2: SoulboundCredential
async function benchmarkSoulbound(
  cohortSize: number
): Promise<ResultRow> {
  console.log("  Preparing Soulbound credentials...");

  const contract = await (
    await ethers.getContractFactory("SoulboundCredential")
  ).deploy();

  await contract.waitForDeployment();

  const tokenIds: number[] = [];

  // Mint all credentials before measuring revocation.
  for (let i = 0; i < cohortSize; i++) {
    await (
      await contract.mint(
        studentAddress(i),
        credentialHash(cohortSize, i)
      )
    ).wait();

    // Contract starts token IDs at 1.
    tokenIds.push(i + 1);
  }

  let totalGas = 0n;

  for (const tokenId of tokenIds) {
    totalGas += await transactionGas(
      contract.revoke(tokenId)
    );

    // Burned token must no longer verify.
    const isValid = await contract.verify(tokenId);

    assert.equal(
      isValid,
      false,
      "Soulbound: revoked credential is still valid"
    );
  }

  return {
    architecture: "soulbound",
    cohort_size: cohortSize,
    scenario: "revoke",
    gas: totalGas
  };
}

// Architecture 3: MerkleCredentialAnchor
async function benchmarkMerkle(
  cohortSize: number
): Promise<ResultRow> {
  console.log("  Preparing Merkle credentials...");

  const contract = await (
    await ethers.getContractFactory("MerkleCredentialAnchor")
  ).deploy();

  await contract.waitForDeployment();

  const leaves = Array.from(
    { length: cohortSize },
    (_, i) => credentialHash(cohortSize, i)
  );

  // Build the same sorted-pair tree used by the repository.
  const { root, proofs } = merkleTree(leaves);

  const batchId = cohortSize;

  // Anchor the cohort before revocation.
  await (
    await contract.anchor(batchId, root)
  ).wait();

  // Ensure all credentials are valid before revocation.
  for (let i = 0; i < cohortSize; i++) {
    const validBefore = await contract.verify(
      batchId,
      leaves[i],
      proofs[i]
    );

    assert.equal(
      validBefore,
      true,
      "Merkle: credential invalid before revocation"
    );
  }

  let totalGas = 0n;

  // Existing per-leaf revoked mapping approach.
  for (let i = 0; i < cohortSize; i++) {
    totalGas += await transactionGas(
      contract.revoke(leaves[i])
    );

    // A revoked leaf must fail verification,
    // even when its original Merkle proof is valid.
    const isValid = await contract.verify(
      batchId,
      leaves[i],
      proofs[i]
    );

    assert.equal(
      isValid,
      false,
      "Merkle: revoked credential is still valid"
    );
  }

  return {
    architecture: "merkle_anchor",
    cohort_size: cohortSize,
    scenario: "revoke",
    gas: totalGas
  };
}

// Write CSV using the agreed team format.
function writeCsv(rows: ResultRow[]): void {
  const resultsDir = path.join(
    process.cwd(),
    "results"
  );

  fs.mkdirSync(resultsDir, { recursive: true });

  const output = path.join(
    resultsDir,
    "revocation.csv"
  );

  const lines = [
    "architecture,cohort_size,scenario,gas"
  ];

  for (const row of rows) {
    lines.push(
      [
        row.architecture,
        row.cohort_size,
        row.scenario,
        row.gas.toString()
      ].join(",")
    );
  }

  fs.writeFileSync(
    output,
    lines.join("\n") + "\n"
  );

  console.log(`\nResults saved to ${output}`);
}

// Main benchmark.
async function main(): Promise<void> {
  const sizes = cohortSizes();
  const results: ResultRow[] = [];

  console.log("====================================");
  console.log("CREDENTIAL REVOCATION GAS BENCHMARK");
  console.log("====================================");

  console.log(`Cohort sizes: ${sizes.join(", ")}`);

  for (const size of sizes) {
    console.log(`\nCohort size: ${size}`);

    console.log("HashRegistry:");
    results.push(
      await benchmarkHashRegistry(size)
    );

    console.log("SoulboundCredential:");
    results.push(
      await benchmarkSoulbound(size)
    );

    console.log("MerkleCredentialAnchor:");
    results.push(
      await benchmarkMerkle(size)
    );
  }

  writeCsv(results);

  console.log("\nREVOCATION GAS RESULTS");
  console.log("------------------------------------");

  console.log(
    "Architecture".padEnd(22) +
    "Cohort".padEnd(10) +
    "Total gas"
  );

  for (const row of results) {
    console.log(
      row.architecture.padEnd(22) +
      String(row.cohort_size).padEnd(10) +
      row.gas.toString()
    );
  }

  console.log("\nAll revocation verification checks passed.");
}

main().catch((error: unknown) => {
  console.error("Revocation benchmark failed:", error);
  process.exitCode = 1;
});
