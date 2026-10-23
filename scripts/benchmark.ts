import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import type { BaseContract, ContractTransactionResponse } from "ethers";
import { credentialHash } from "./lib/leaves";
import { merkleTree } from "./lib/merkle";
import { COMPILER_VERSION, EVM_VERSION, OPTIMIZER_RUNS } from "./lib/settings";

const DEFAULT_COHORT_SIZES = [1, 10, 100, 1000];

type Architecture = "hash_registry" | "soulbound" | "merkle_anchor";

type Row = {
  architecture: Architecture;
  cohortSize: number;
  operation: "deploy" | "issue";
  totalGas: bigint;
  transactions: number;
};

function cohortSizes(): number[] {
  const raw = process.env.COHORT_SIZES;
  if (!raw || raw.trim() === "") return DEFAULT_COHORT_SIZES;

  const sizes = raw.split(",").map((part) => Number(part.trim()));
  if (sizes.some((size) => !Number.isInteger(size) || size < 1)) {
    throw new Error("COHORT_SIZES must be a comma-separated list of positive integers");
  }
  return sizes;
}

function studentAddress(index: number): string {
  return ethers.getAddress(ethers.toBeHex(index + 1, 20));
}

async function spentGas(pending: Promise<ContractTransactionResponse>): Promise<bigint> {
  const receipt = await (await pending).wait();
  if (!receipt) throw new Error("transaction was dropped");
  return receipt.gasUsed;
}

async function deploymentGas(contract: BaseContract): Promise<bigint> {
  const pending = contract.deploymentTransaction();
  if (!pending) throw new Error("missing deployment transaction");
  const receipt = await pending.wait();
  if (!receipt) throw new Error("missing deployment receipt");
  await contract.waitForDeployment();
  return receipt.gasUsed;
}

async function measureHashRegistry(cohortSize: number): Promise<Row[]> {
  const contract = await (await ethers.getContractFactory("HashRegistry")).deploy();
  const gas = await deploymentGas(contract);
  let total = 0n;
  for (let i = 0; i < cohortSize; i++) {
    total += await spentGas(contract.issue(credentialHash(cohortSize, i)));
  }
  return [
    { architecture: "hash_registry", cohortSize, operation: "deploy", totalGas: gas, transactions: 1 },
    { architecture: "hash_registry", cohortSize, operation: "issue", totalGas: total, transactions: cohortSize },
  ];
}

async function measureSoulbound(cohortSize: number): Promise<Row[]> {
  const contract = await (await ethers.getContractFactory("SoulboundCredential")).deploy();
  const gas = await deploymentGas(contract);
  let total = 0n;
  for (let i = 0; i < cohortSize; i++) {
    total += await spentGas(contract.mint(studentAddress(i), credentialHash(cohortSize, i)));
  }
  return [
    { architecture: "soulbound", cohortSize, operation: "deploy", totalGas: gas, transactions: 1 },
    { architecture: "soulbound", cohortSize, operation: "issue", totalGas: total, transactions: cohortSize },
  ];
}

async function measureMerkle(cohortSize: number): Promise<Row[]> {
  const contract = await (await ethers.getContractFactory("MerkleCredentialAnchor")).deploy();
  const gas = await deploymentGas(contract);
  const leaves = Array.from({ length: cohortSize }, (_, index) => credentialHash(cohortSize, index));
  const { root } = merkleTree(leaves);
  const anchorGas = await spentGas(contract.anchor(cohortSize, root));
  return [
    { architecture: "merkle_anchor", cohortSize, operation: "deploy", totalGas: gas, transactions: 1 },
    { architecture: "merkle_anchor", cohortSize, operation: "issue", totalGas: anchorGas, transactions: 1 },
  ];
}

// TODO: verification gas for a valid credential and for an invalid one, per architecture.
async function measureVerification(): Promise<Row[]> {
  return [];
}

// TODO: revocation gas. For Merkle, compare a per-leaf flag with rebuilding and re-anchoring the root.
async function measureRevocation(): Promise<Row[]> {
  return [];
}

function toCsv(rows: Row[]): string {
  const recordedAt = new Date().toISOString();
  const header = [
    "recorded_at",
    "network",
    "compiler",
    "optimizer_runs",
    "evm_version",
    "architecture",
    "cohort_size",
    "operation",
    "total_gas",
    "transactions",
    "gas_per_credential",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    const perCredential = row.operation === "issue" ? row.totalGas / BigInt(row.cohortSize) : "";
    lines.push(
      [
        recordedAt,
        "hardhat",
        COMPILER_VERSION,
        OPTIMIZER_RUNS,
        EVM_VERSION,
        row.architecture,
        row.cohortSize,
        row.operation,
        row.totalGas.toString(),
        row.transactions,
        perCredential,
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const sizes = cohortSizes();
  console.log(
    `issuance benchmark on hardhat, solc ${COMPILER_VERSION}, optimizer ${OPTIMIZER_RUNS}, ${EVM_VERSION}`,
  );
  console.log(`cohort sizes: ${sizes.join(", ")}`);

  const rows: Row[] = [];
  for (const cohortSize of sizes) {
    console.log(`cohort ${cohortSize}: hash registry`);
    rows.push(...(await measureHashRegistry(cohortSize)));
    console.log(`cohort ${cohortSize}: soulbound token`);
    rows.push(...(await measureSoulbound(cohortSize)));
    console.log(`cohort ${cohortSize}: merkle anchor`);
    rows.push(...(await measureMerkle(cohortSize)));
  }

  rows.push(...(await measureVerification()));
  rows.push(...(await measureRevocation()));

  const resultsDir = path.join(process.cwd(), "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const output = path.join(resultsDir, "issuance.csv");
  fs.writeFileSync(output, toCsv(rows));

  console.log("");
  console.log("architecture      cohort  operation   total_gas  txs  gas/credential");
  for (const row of rows) {
    const perCredential = row.operation === "issue" ? (row.totalGas / BigInt(row.cohortSize)).toString() : "-";
    console.log(
      [
        row.architecture.padEnd(17),
        String(row.cohortSize).padStart(6),
        row.operation.padEnd(11),
        row.totalGas.toString().padStart(10),
        String(row.transactions).padStart(4),
        perCredential.padStart(14),
      ].join("  "),
    );
  }
  console.log("");
  console.log(`wrote ${output}`);
  console.log("verification and revocation rows are not measured yet");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
