import assert from "node:assert/strict";
import fs from "node:fs";
import type {} from "@nomicfoundation/hardhat-ethers";
import { ethers, network } from "hardhat";
import type { Contract, TransactionReceipt } from "ethers";
import { credentialHash } from "../../scripts/lib/leaves";
import { merkleTree } from "../../scripts/lib/merkle";

export const ARCHITECTURES = ["hash_registry", "soulbound", "merkle_anchor"] as const;
export const CORE_SCENARIOS = ["valid", "invalid"] as const;
export type Architecture = (typeof ARCHITECTURES)[number];
export type Scenario = (typeof CORE_SCENARIOS)[number];
export const DEFAULT_SIZES = [1, 10, 100, 1000];

export function sampleIndices(size: number): number[] {
  assert(Number.isSafeInteger(size) && size > 0, "cohort size must be a positive safe integer");
  return [...new Set([0, Math.floor(size / 2), size - 1])];
}

export function parseSizes(raw?: string): number[] {
  if (raw === undefined) return [...DEFAULT_SIZES];
  assert(raw.trim() !== "", "ADIL_COHORT_SIZES must not be blank");
  const parts = raw.split(",").map((p) => p.trim());
  assert(parts.every((p) => /^[1-9][0-9]*$/.test(p)), "positive decimal sizes required");
  const sizes = parts.map(Number);
  sizes.forEach(sampleIndices);
  assert(sizes.every((n) => DEFAULT_SIZES.includes(n)), "use approved cohort sizes 1,10,100,1000");
  assert.equal(new Set(sizes).size, sizes.length, "duplicate cohort size");
  return sizes;
}

export type Fixture = {
  architecture: Architecture;
  size: number;
  contract: Contract;
  hashes: string[];
  proofs: string[][];
  root: string | null;
  batchId: number;
  setupTransactions: number;
};

async function mined(pending: Promise<{ wait(): Promise<TransactionReceipt | null> }>): Promise<void> {
  const receipt = await (await pending).wait();
  assert(receipt && receipt.status === 1, "setup transaction did not succeed");
}

export async function createFixture(architecture: Architecture, size: number): Promise<Fixture> {
  sampleIndices(size);
  const name = { hash_registry: "HashRegistry", soulbound: "SoulboundCredential", merkle_anchor: "MerkleCredentialAnchor" }[architecture];
  const contract = await (await ethers.getContractFactory(name)).deploy() as unknown as Contract;
  await contract.waitForDeployment();
  const deployment = contract.deploymentTransaction();
  assert(deployment && (await deployment.wait())?.status === 1);
  const hashes = Array.from({ length: size }, (_, i) => credentialHash(size, i));
  assert.equal(new Set(hashes).size, size);
  let proofs: string[][] = [];
  let root: string | null = null;
  if (architecture === "hash_registry") {
    for (const hash of hashes) await mined(contract.issue(hash));
  } else if (architecture === "soulbound") {
    // Preserve the existing issuance fixture convention; minting is setup only.
    for (let i = 0; i < size; i++) {
      await mined(contract.mint(ethers.getAddress(ethers.toBeHex(i + 1, 20)), hashes[i]));
    }
  } else {
    ({ root, proofs } = merkleTree(hashes));
    await mined(contract.anchor(size, root));
  }
  return { architecture, size, contract, hashes, proofs, root, batchId: size,
    setupTransactions: 1 + (architecture === "merkle_anchor" ? 1 : size) };
}

export function verificationArgs(f: Fixture, index: number, scenario: Scenario): unknown[] {
  assert(index >= 0 && index < f.size);
  const hash = scenario === "valid" ? f.hashes[index] : credentialHash(f.size, f.size + index);
  if (scenario === "invalid") assert(!f.hashes.includes(hash), "unknown hash collides with issued input");
  if (f.architecture === "hash_registry") return [hash];
  if (f.architecture === "soulbound") return [scenario === "valid" ? index + 1 : f.size + index + 1];
  return [f.batchId, hash, f.proofs[index]];
}

async function stateFingerprint(f: Fixture, index: number): Promise<string> {
  let values: unknown;
  if (f.architecture === "hash_registry") values = await f.contract.records(f.hashes[index]);
  else if (f.architecture === "soulbound") {
    values = [await f.contract.ownerOf(index + 1), await f.contract.credentialHash(index + 1), await f.contract.locked(index + 1)];
  } else values = [await f.contract.batches(f.batchId), await f.contract.revoked(f.hashes[index])];
  return json(values);
}

export function json(value: unknown): string {
  return JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v);
}

export type Provenance = {
  runId: string; sourceCommit: string; network: string; chainId: number;
  runtimeHardfork: string; compiler: string; optimizerRuns: number; evmTarget: string;
};
export type Measurement = {
  architecture: Architecture; cohort_size: number; scenario: Scenario; sample_index: number;
  proof_length: number | null; expected_result: boolean; observed_result: boolean; post_result: boolean;
  receipt_gas: string; gas_estimate: string; measurement_type: "paired_separate_columns";
  receipt_measurement: "receipt.gasUsed"; estimate_measurement: "eth_estimateGas";
  receipt_status: number; transaction_count: number; tx_hash: string; contract_address: string;
  calldata_bytes: number; calldata_zero_bytes: number; calldata_nonzero_bytes: number;
  pre_block_number: number; pre_block_hash: string; post_block_number: number;
  recorded_at_utc: string; run_id: string; source_commit: string; network: string; chain_id: number;
  runtime_hardfork: string; compiler: string; optimizer_runs: number; evm_target: string;
};
export type RawRecord = {
  sample_id: string; phase: "measured_verification"; static_result: boolean;
  gas_estimate: string; estimate_measurement: "eth_estimateGas";
  receipt_measurement: "receipt.gasUsed"; data: string; args: unknown[];
  pre_block: unknown; transaction: unknown; receipt: unknown;
};

export async function measureVerification(
  f: Fixture, index: number, scenario: Scenario, provenance: Provenance,
): Promise<{ row: Measurement; raw: RawRecord }> {
  assert.equal(network.name, "hardhat", "only the in-process local hardhat network is allowed");
  const [, verifier] = await ethers.getSigners();
  const args = verificationArgs(f, index, scenario);
  const data = f.contract.interface.encodeFunctionData("verify", args);
  const to = await f.contract.getAddress();
  const expected = scenario === "valid";
  const pre = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
  const blockNumber = Number(BigInt(pre.number));
  const request = { to, data, from: verifier.address, value: 0n, type: 2, accessList: [],
    maxFeePerGas: ethers.parseUnits("10", "gwei"), maxPriorityFeePerGas: ethers.parseUnits("1", "gwei") };
  const result = await ethers.provider.call({ ...request, blockTag: blockNumber });
  const observed = Boolean(f.contract.interface.decodeFunctionResult("verify", result)[0]);
  assert.equal(observed, expected, `${f.architecture}/${f.size}/${scenario}/${index}: wrong static result`);
  const before = await stateFingerprint(f, index);
  // Separate RPC operation: this is an estimate, never copied into receipt_gas.
  const estimate = await ethers.provider.estimateGas(request);
  assert(estimate > 0n);
  const { from: _from, ...sendRequest } = request;
  // Explicit gasLimit prevents the send path from being mistaken for our estimate observation.
  const tx = await verifier.sendTransaction({ ...sendRequest, gasLimit: 1_000_000n });
  const receipt = await tx.wait();
  assert(receipt && receipt.status === 1 && receipt.gasUsed > 0n, "missing successful mined receipt");
  const postCall = await ethers.provider.call({ ...request, blockTag: receipt.blockNumber });
  const post = Boolean(f.contract.interface.decodeFunctionResult("verify", postCall)[0]);
  assert.equal(post, expected);
  assert.equal(await stateFingerprint(f, index), before, "view transaction changed relevant credential state");
  const bytes = ethers.getBytes(data);
  const zeroBytes = bytes.filter((v) => v === 0).length;
  const row: Measurement = {
    architecture: f.architecture, cohort_size: f.size, scenario, sample_index: index,
    proof_length: f.architecture === "merkle_anchor" ? f.proofs[index].length : null,
    expected_result: expected, observed_result: observed, post_result: post,
    receipt_gas: receipt.gasUsed.toString(), gas_estimate: estimate.toString(),
    measurement_type: "paired_separate_columns", receipt_measurement: "receipt.gasUsed",
    estimate_measurement: "eth_estimateGas", receipt_status: receipt.status, transaction_count: 1,
    tx_hash: receipt.hash, contract_address: to, calldata_bytes: bytes.length,
    calldata_zero_bytes: zeroBytes, calldata_nonzero_bytes: bytes.length - zeroBytes,
    pre_block_number: blockNumber, pre_block_hash: pre.hash, post_block_number: receipt.blockNumber,
    recorded_at_utc: new Date().toISOString(), run_id: provenance.runId, source_commit: provenance.sourceCommit,
    network: provenance.network, chain_id: provenance.chainId, runtime_hardfork: provenance.runtimeHardfork,
    compiler: provenance.compiler, optimizer_runs: provenance.optimizerRuns, evm_target: provenance.evmTarget,
  };
  return { row, raw: { sample_id: `${f.architecture}/${f.size}/${scenario}/${index}`,
    phase: "measured_verification", static_result: observed, gas_estimate: estimate.toString(),
    estimate_measurement: "eth_estimateGas", receipt_measurement: "receipt.gasUsed", data, args,
    pre_block: pre, transaction: tx.toJSON(), receipt: receipt.toJSON() } };
}

export async function checkRevoked(f: Fixture, index = 0): Promise<{ architecture: Architecture; cohort_size: number; sample_index: number; expected: false; observed: boolean }> {
  assert.equal(await f.contract.verify(...verificationArgs(f, index, "valid")), true);
  if (f.architecture === "soulbound") await mined(f.contract.revoke(index + 1));
  else await mined(f.contract.revoke(f.hashes[index]));
  const observed = Boolean(await f.contract.verify(...verificationArgs(f, index, "valid")));
  assert.equal(observed, false, "revoked credential still verifies");
  return { architecture: f.architecture, cohort_size: f.size, sample_index: index, expected: false, observed };
}

export async function checkCorruptProof(f: Fixture, index = 0): Promise<{ cohort_size: number; proof_length: number; mutation: string; observed: boolean }> {
  assert.equal(f.architecture, "merkle_anchor");
  const proof = [...f.proofs[index]];
  const mutation = proof.length ? "flip_first_sibling_bit_same_length" : "append_sibling_to_empty_proof";
  if (proof.length) proof[0] = ethers.toBeHex(BigInt(proof[0]) ^ 1n, 32);
  else proof.push(ethers.ZeroHash);
  const observed = Boolean(await f.contract.verify(f.batchId, f.hashes[index], proof));
  assert.equal(observed, false);
  return { cohort_size: f.size, proof_length: proof.length, mutation, observed };
}

export type CompatibilityRow = { architecture: Architecture; cohort_size: number; scenario: Scenario; gas: string };

export function validateMeasurements(rows: Measurement[], sizes: number[]): void {
  const keys = new Set<string>();
  assert.equal(rows.length, sizes.reduce((sum, n) => sum + sampleIndices(n).length * 6, 0), "incomplete sample grid");
  for (const r of rows) {
    assert(ARCHITECTURES.includes(r.architecture)); assert(sizes.includes(r.cohort_size));
    assert(CORE_SCENARIOS.includes(r.scenario)); assert(sampleIndices(r.cohort_size).includes(r.sample_index));
    const key = `${r.architecture}/${r.cohort_size}/${r.scenario}/${r.sample_index}`;
    assert(!keys.has(key), `duplicate sample ${key}`); keys.add(key);
    assert.equal(r.expected_result, r.scenario === "valid");
    assert.equal(r.observed_result, r.expected_result); assert.equal(r.post_result, r.expected_result);
    assert(/^[1-9][0-9]*$/.test(r.receipt_gas) && /^[1-9][0-9]*$/.test(r.gas_estimate));
    assert.equal(r.measurement_type, "paired_separate_columns");
    assert.equal(r.receipt_measurement, "receipt.gasUsed"); assert.equal(r.estimate_measurement, "eth_estimateGas");
    assert.equal(r.receipt_status, 1); assert.equal(r.transaction_count, 1);
    assert.equal(r.network, "hardhat"); assert.equal(r.chain_id, 31337); assert.equal(r.runtime_hardfork, "osaka");
    assert.equal(r.compiler, "0.8.28"); assert.equal(r.optimizer_runs, 200); assert.equal(r.evm_target, "cancun");
    assert(/^0x[0-9a-fA-F]{64}$/.test(r.tx_hash)); assert(r.post_block_number > r.pre_block_number);
    assert.equal(r.calldata_bytes, r.calldata_zero_bytes + r.calldata_nonzero_bytes);
    if (r.architecture === "merkle_anchor") {
      const { proofs } = merkleTree(Array.from({ length: r.cohort_size }, (_, i) => credentialHash(r.cohort_size, i)));
      assert.equal(r.proof_length, proofs[r.sample_index].length);
      assert.equal(r.calldata_bytes, 132 + 32 * r.proof_length!);
    } else { assert.equal(r.proof_length, null); assert.equal(r.calldata_bytes, 36); }
  }
}

export function compatibilityRows(rows: Measurement[], sizes: number[]): CompatibilityRow[] {
  validateMeasurements(rows, sizes);
  // One actual estimate at sample index 0, not an average of unlike proof depths.
  return rows.filter((r) => r.sample_index === 0).map((r) => ({
    architecture: r.architecture, cohort_size: r.cohort_size, scenario: r.scenario, gas: r.gas_estimate,
  }));
}

export function validateRawEvidence(rows: Measurement[], raw: RawRecord[]): void {
  assert.equal(raw.length, rows.length, "missing raw receipt evidence");
  const records = new Map(raw.map((r) => [r.sample_id, r]));
  assert.equal(records.size, raw.length, "duplicate raw evidence");
  for (const row of rows) {
    const r = records.get(`${row.architecture}/${row.cohort_size}/${row.scenario}/${row.sample_index}`);
    assert(r, "missing sample evidence");
    const receipt = r.receipt as Record<string, unknown>;
    const tx = r.transaction as Record<string, unknown>;
    assert.equal(String(receipt.gasUsed), row.receipt_gas, "receipt gas mismatch");
    assert.equal(receipt.status, 1); assert.equal(receipt.hash, row.tx_hash);
    assert.equal(tx.hash, row.tx_hash); assert.equal(tx.data, r.data);
    assert.equal(r.gas_estimate, row.gas_estimate, "estimate mismatch");
    assert.equal(r.static_result, row.observed_result);
    assert.equal(r.receipt_measurement, "receipt.gasUsed"); assert.equal(r.estimate_measurement, "eth_estimateGas");
    assert.equal(ethers.getBytes(r.data).length, row.calldata_bytes);
  }
}

export function validateCompatibility(actual: CompatibilityRow[], detailed: Measurement[], sizes: number[]): void {
  const expected = compatibilityRows(detailed, sizes);
  assert.equal(actual.length, sizes.length * 6, "incomplete compatibility CSV");
  const keys = new Set<string>();
  for (const row of actual) {
    const key = `${row.architecture}/${row.cohort_size}/${row.scenario}`;
    assert(!keys.has(key), "duplicate compatibility row"); keys.add(key);
    const source = expected.find((r) => r.architecture === row.architecture && r.cohort_size === row.cohort_size && r.scenario === row.scenario);
    assert(source, "unexpected compatibility label or cohort");
    assert.equal(row.gas, source.gas, "compatibility gas must be the first sample's estimate");
  }
}

export function csv(rows: object[], columns: string[]): string {
  const cell = (value: unknown): string => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell((r as Record<string, unknown>)[c])).join(","))].join("\n") + "\n";
}

export function writeNew(file: string, content: string): void {
  fs.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
}
