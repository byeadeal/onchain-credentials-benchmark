import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateMeasurements, validateRawEvidence, compatibilityRows, validateCompatibility, csv,
  type Measurement, type RawRecord } from "./verification";

const dir = path.resolve(process.argv[2] ?? "");
assert(process.argv[2], "usage: node -r ts-node/register experiments/adil/validate-run.ts <run-directory>");
const metadata = JSON.parse(fs.readFileSync(path.join(dir, "metadata.json"), "utf8"));
assert.equal(metadata.status, "complete");
const rows: Measurement[] = JSON.parse(fs.readFileSync(path.join(dir, "measurements.json"), "utf8"));
const raw: RawRecord[] = fs.readFileSync(path.join(dir, "transactions.jsonl"), "utf8").trimEnd().split(/\r?\n/).map((l) => JSON.parse(l));
validateMeasurements(rows, metadata.cohort_sizes); validateRawEvidence(rows, raw);
const expected = compatibilityRows(rows, metadata.cohort_sizes);
const content = fs.readFileSync(path.join(dir, "verification-estimates.csv"), "utf8");
assert.equal(content, csv(expected, ["architecture", "cohort_size", "scenario", "gas"]));
validateCompatibility(expected, rows, metadata.cohort_sizes);
assert.equal(fs.readFileSync(path.join(dir, "verification-detailed.csv"), "utf8"), csv(rows, Object.keys(rows[0])));
for (const [filename, digest] of Object.entries(metadata.artifact_sha256)) {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, filename))).digest("hex"), digest, filename);
}
const checks = JSON.parse(fs.readFileSync(path.join(dir, "correctness-checks.json"), "utf8"));
assert.equal(checks.length, metadata.cohort_sizes.length * 4);
assert(checks.every((c: { observed: boolean }) => c.observed === false));
console.log(`PASS: ${rows.length} mined receipts, ${expected.length} distinct estimate-only compatibility rows; hashes, CSVs and correctness checks valid.`);
