import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ethers } from "hardhat";
import { ARCHITECTURES, CORE_SCENARIOS, sampleIndices, parseSizes, createFixture, verificationArgs,
  measureVerification, checkRevoked, checkCorruptProof, validateMeasurements, validateRawEvidence,
  validateCompatibility, compatibilityRows, csv, writeNew,
  type Fixture, type Measurement, type RawRecord, type Provenance } from "../verification";

describe("Adil verification measurements", function () {
  const fixtures: Fixture[] = [];
  const rows: Measurement[] = [];
  const raw: RawRecord[] = [];
  const provenance: Provenance = { runId: "test", sourceCommit: "0".repeat(40), network: "hardhat",
    chainId: 31337, runtimeHardfork: "osaka", compiler: "0.8.28", optimizerRuns: 200, evmTarget: "cancun" };

  before(async function () {
    for (const architecture of ARCHITECTURES) {
      const f = await createFixture(architecture, 1); fixtures.push(f);
      for (const scenario of CORE_SCENARIOS) {
        const measured = await measureVerification(f, 0, scenario, provenance);
        rows.push(measured.row); raw.push(measured.raw);
      }
    }
  });

  it("selects deterministic unique positions and rejects unapproved or malformed sizes", function () {
    assert.deepEqual(sampleIndices(1), [0]); assert.deepEqual(sampleIndices(10), [0, 5, 9]);
    assert.deepEqual(sampleIndices(1000), [0, 500, 999]);
    assert.deepEqual(parseSizes(), [1, 10, 100, 1000]); assert.deepEqual(parseSizes("1,10"), [1, 10]);
    for (const bad of ["", "1,1", "0", "-1", "1.5", "1,", "3", "Infinity"]) assert.throws(() => parseSizes(bad));
  });

  it("all architectures accept issued and reject the specified unissued native input", function () {
    assert.equal(rows.length, 6);
    for (const r of rows) assert.equal(r.observed_result, r.scenario === "valid");
    const merkle = fixtures.find((f) => f.architecture === "merkle_anchor")!;
    assert.equal(verificationArgs(merkle, 0, "invalid")[0], merkle.batchId, "invalid case must use an existing batch");
    assert.notEqual(verificationArgs(merkle, 0, "invalid")[1], merkle.hashes[0]);
  });

  it("archives actual mined receipts rather than static calls or estimates", async function () {
    for (const row of rows) {
      const receipt = await ethers.provider.getTransactionReceipt(row.tx_hash);
      assert(receipt && receipt.status === 1);
      assert.equal(receipt.gasUsed.toString(), row.receipt_gas);
      const tx = await ethers.provider.getTransaction(row.tx_hash);
      assert(tx && tx.gasLimit === 1_000_000n);
    }
    validateRawEvidence(rows, raw);
  });

  it("keeps receipt and estimate labels separate and exports only genuine estimates", function () {
    const compatibility = compatibilityRows(rows, [1]);
    for (let i = 0; i < rows.length; i++) {
      assert.equal(rows[i].receipt_measurement, "receipt.gasUsed");
      assert.equal(rows[i].estimate_measurement, "eth_estimateGas");
      assert.equal(compatibility[i].gas, rows[i].gas_estimate);
    }
    // An independently changed receipt column must not drive the export.
    const changed = rows.map((r) => ({ ...r, receipt_gas: "999999" }));
    assert.deepEqual(compatibilityRows(changed, [1]), compatibility);
    assert.throws(() => validateRawEvidence(changed, raw));
  });

  it("handles the singleton's valid empty proof and rejects a wrong nonempty proof", async function () {
    const f = fixtures.find((v) => v.architecture === "merkle_anchor")!;
    assert.deepEqual(f.proofs[0], []);
    assert(rows.filter((r) => r.architecture === "merkle_anchor").every((r) => r.proof_length === 0 && r.calldata_bytes === 132));
    assert.equal((await checkCorruptProof(f)).observed, false);
  });

  it("validates odd-sized tree proofs and rejects same-length sibling corruption", async function () {
    const f = await createFixture("merkle_anchor", 3);
    for (let i = 0; i < 3; i++) assert.equal(await f.contract.verify(...verificationArgs(f, i, "valid")), true);
    const result = await checkCorruptProof(f);
    assert.equal(result.mutation, "flip_first_sibling_bit_same_length"); assert.equal(result.observed, false);
    assert.equal(result.proof_length, f.proofs[0].length);
  });

  it("all architectures reject a credential after its native revocation", async function () {
    for (const f of fixtures) assert.equal((await checkRevoked(f)).observed, false);
  });

  it("documents that a valid soulbound token does not validate an externally claimed hash", async function () {
    const f = await createFixture("soulbound", 1);
    const wrongClaim = ethers.id("tampered academic claim");
    assert.notEqual(await f.contract.credentialHash(1), wrongClaim);
    assert.equal(await f.contract.verify(1), true);
  });

  it("rejects incomplete, duplicate, mislabelled and zero-gas measurement data", function () {
    validateMeasurements(rows, [1]);
    assert.throws(() => validateMeasurements(rows.slice(1), [1]));
    assert.throws(() => validateMeasurements([rows[0], rows[0], ...rows.slice(2)], [1]));
    assert.throws(() => validateMeasurements(rows.map((r, i) => i ? r : { ...r, receipt_gas: "0" }), [1]));
    assert.throws(() => validateMeasurements(rows.map((r, i) => i ? r : { ...r, estimate_measurement: "receipt.gasUsed" as never }), [1]));
    const valid = compatibilityRows(rows, [1]); validateCompatibility(valid, rows, [1]);
    assert.throws(() => validateCompatibility([valid[0], valid[0], ...valid.slice(2)], rows, [1]));
    assert.throws(() => validateCompatibility(valid.map((r, i) => i ? r : { ...r, gas: "0" }), rows, [1]));
  });

  it("writes the exact plotting schema and escapes CSV fields", function () {
    const text = csv(compatibilityRows(rows, [1]), ["architecture", "cohort_size", "scenario", "gas"]);
    assert.equal(text.trimEnd().split("\n").length, 7);
    assert.equal(text.split("\n")[0], "architecture,cohort_size,scenario,gas");
    for (const line of text.trimEnd().split("\n").slice(1)) assert(/^[a-z_]+,1,(valid|invalid),[1-9][0-9]*$/.test(line));
    assert.equal(csv([{ note: 'quote " and, comma' }], ["note"]), 'note\n"quote "" and, comma"\n');
  });

  it("refuses to overwrite existing evidence", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adil-verification-test-"));
    const file = path.join(dir, "evidence.txt");
    try { writeNew(file, "original"); assert.throws(() => writeNew(file, "replacement")); assert.equal(fs.readFileSync(file, "utf8"), "original"); }
    finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
  });
});
