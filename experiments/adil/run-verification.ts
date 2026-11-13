import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import hre from "hardhat";
import { COMPILER_VERSION, EVM_VERSION, OPTIMIZER_RUNS } from "../../scripts/lib/settings";
import { ARCHITECTURES, CORE_SCENARIOS, DEFAULT_SIZES, parseSizes, sampleIndices,
  createFixture, measureVerification, checkRevoked, checkCorruptProof, json, csv,
  compatibilityRows, validateMeasurements, validateRawEvidence, validateCompatibility, writeNew,
  type Measurement, type RawRecord } from "./verification";

const repo = path.resolve(__dirname, "../..");
const git = (...args: string[]): string => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const sha256 = (contents: string | Buffer): string => crypto.createHash("sha256").update(contents).digest("hex");

async function main(): Promise<void> {
  assert.equal(hre.network.name, "hardhat", "remote networks are not allowed");
  const runtime = hre.network.config as { chainId: number; hardfork: string; forking?: unknown };
  assert.equal(runtime.chainId, 31337); assert.equal(runtime.hardfork, "osaka");
  assert(!runtime.forking, "forking is not allowed");
  const sizes = parseSizes(process.env.ADIL_COHORT_SIZES);
  const evidenceBase = path.join(repo, "docs/adil/evidence");
  const output = path.resolve(repo, process.env.ADIL_OUTPUT_DIR ??
    `docs/adil/evidence/verification-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
  const relative = path.relative(evidenceBase, output);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "output must be a new directory inside docs/adil/evidence");
  assert(!fs.existsSync(output), "output directory already exists; preserve it and choose a new run directory");
  const publish = process.env.ADIL_PUBLISH_TEAM_CSV === "1";
  const teamPath = path.join(repo, "results/verification.csv");
  if (publish) {
    assert.deepEqual([...sizes].sort((a, b) => a - b), DEFAULT_SIZES, "only a complete four-cohort run may publish the team CSV");
    assert(!fs.existsSync(teamPath), "team verification CSV already exists; preserve it before publishing a new run");
  }
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.mkdirSync(output);
  const startedAt = new Date().toISOString();
  const runId = path.relative(evidenceBase, output).replaceAll("\\", "/");
  const branch = git("branch", "--show-current"); assert.equal(branch, "adil-work");
  const compiler = hre.config.solidity.compilers[0];
  assert.equal(compiler.version, COMPILER_VERSION);
  assert.deepEqual(compiler.settings.optimizer, { enabled: true, runs: OPTIMIZER_RUNS });
  assert.equal(compiler.settings.evmVersion, EVM_VERSION);
  const sourcePaths = ["contracts/HashRegistry.sol", "contracts/SoulboundCredential.sol", "contracts/MerkleCredentialAnchor.sol",
    "scripts/lib/leaves.ts", "scripts/lib/merkle.ts", "scripts/lib/settings.ts", "hardhat.config.ts", "package.json", "package-lock.json",
    ...fs.readdirSync(__dirname).filter((f) => f.endsWith(".ts") || f.endsWith(".json")).map((f) => `experiments/adil/${f}`),
    "experiments/adil/test/verification.ts"];
  const sourceHashes = Object.fromEntries(sourcePaths.map((p) => [p, sha256(fs.readFileSync(path.join(repo, p)))]));
  const packages = ["hardhat", "ethers", "@openzeppelin/contracts", "typescript", "ts-node", "@nomicfoundation/hardhat-toolbox"];
  const versions = Object.fromEntries(packages.map((p) => [p, JSON.parse(fs.readFileSync(path.join(repo, "node_modules", p, "package.json"), "utf8")).version]));
  const provenance = { runId, sourceCommit: git("rev-parse", "HEAD"), network: hre.network.name,
    chainId: runtime.chainId, runtimeHardfork: runtime.hardfork, compiler: COMPILER_VERSION, optimizerRuns: OPTIMIZER_RUNS, evmTarget: EVM_VERSION };
  const rows: Measurement[] = []; const raw: RawRecord[] = [];
  const checks: object[] = []; const fixtures: object[] = [];
  const metadata: Record<string, unknown> = {
    schema_version: "adil-verification-day1-v1", status: "running", started_at_utc: startedAt,
    ...provenance, branch, initial_git_status: git("status", "--porcelain=v1", "--untracked-files=all"),
    cohort_sizes: sizes, selection: "deduplicated [0, floor(N/2), N-1]; compatibility uses index 0 only",
    repetitions: 1, seed: "none; original credentialHash(N,index) convention", setup_excluded: true,
    command: "node_modules\\.bin\\hardhat.cmd --config experiments/adil/hardhat.config.ts --network hardhat run experiments/adil/run-verification.ts",
    environment: { ADIL_COHORT_SIZES: process.env.ADIL_COHORT_SIZES ?? null, ADIL_OUTPUT_DIR: process.env.ADIL_OUTPUT_DIR ?? null,
      ADIL_PUBLISH_TEAM_CSV: process.env.ADIL_PUBLISH_TEAM_CSV ?? null, node: process.version,
      npm: execFileSync("cmd.exe", ["/d", "/c", "npm.cmd --version"], { encoding: "utf8" }).trim(), versions,
      hardhat_declared_node_support: require("hardhat/internal/cli/constants").SUPPORTED_NODE_VERSIONS },
    runtime: { hardfork: runtime.hardfork, chain_id: runtime.chainId,
      client: await hre.network.provider.send("web3_clientVersion"),
      compiler: compiler.version, optimizer: compiler.settings.optimizer, evm_target: compiler.settings.evmVersion },
    source_sha256: sourceHashes,
    teammate_refs: { alikhan_results: git("rev-parse", "origin/alikhan/results"), azhar_revocation: git("rev-parse", "origin/azhar/revocation"), main: git("rev-parse", "origin/main") },
    scientific_limits: ["Native validity functions have different semantics; soulbound checks token existence/lock, not supplied hash or identity.",
      "Local one-run synthetic data, deterministic selected positions, no statistical generalization.",
      "Compiler Cancun and execution Osaka are distinct. Node 26 is outside installed Hardhat's declared support range if still used.",
      "Gas estimation and mined receipt gas are different measurements, even if numerically equal.",
      "No issuance, revocation-cost, proof-generation cost, RPC fee, DA or storage-growth measurement is claimed."] };
  const saveMetadata = (): void => fs.writeFileSync(path.join(output, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
  saveMetadata();
  try {
    for (const size of sizes) for (const architecture of ARCHITECTURES) {
      console.log(`cohort ${size}: ${architecture}`);
      const fixture = await createFixture(architecture, size);
      fixtures.push({ architecture, cohort_size: size, address: await fixture.contract.getAddress(), batch_id: fixture.batchId,
        root: fixture.root, hashes: fixture.hashes, selected_indices: sampleIndices(size), setup_transaction_count: fixture.setupTransactions });
      for (const index of sampleIndices(size)) for (const scenario of CORE_SCENARIOS) {
        const measured = await measureVerification(fixture, index, scenario, provenance);
        rows.push(measured.row); raw.push(measured.raw);
        fs.appendFileSync(path.join(output, "transactions.jsonl"), json(measured.raw) + "\n");
      }
      // Correctness-only checks after core measurements; no revocation gas series.
      if (architecture === "merkle_anchor") checks.push({ kind: "corrupt_proof", ...await checkCorruptProof(fixture) });
      checks.push({ kind: "revoked", ...await checkRevoked(fixture) });
    }
    validateMeasurements(rows, sizes); validateRawEvidence(rows, raw);
    const compatibility = compatibilityRows(rows, sizes); validateCompatibility(compatibility, rows, sizes);
    const teamCsv = csv(compatibility, ["architecture", "cohort_size", "scenario", "gas"]);
    writeNew(path.join(output, "measurements.json"), JSON.stringify(rows, null, 2) + "\n");
    writeNew(path.join(output, "verification-detailed.csv"), csv(rows, Object.keys(rows[0])));
    writeNew(path.join(output, "verification-estimates.csv"), teamCsv);
    writeNew(path.join(output, "correctness-checks.json"), JSON.stringify(checks, null, 2) + "\n");
    writeNew(path.join(output, "fixtures.json"), JSON.stringify(fixtures, null, 2) + "\n");
    if (publish) { fs.mkdirSync(path.dirname(teamPath), { recursive: true }); writeNew(teamPath, teamCsv); }
    metadata.status = "complete"; metadata.finished_at_utc = new Date().toISOString();
    metadata.sample_rows = rows.length; metadata.compatibility_rows = compatibility.length;
    metadata.correctness_checks = checks.length; metadata.team_csv_published = publish;
    metadata.artifact_sha256 = Object.fromEntries(fs.readdirSync(output).filter((f) => f !== "metadata.json")
      .map((f) => [f, sha256(fs.readFileSync(path.join(output, f)))]));
    saveMetadata();
    console.log(teamCsv); console.log(`validated ${rows.length} mined samples; ${compatibility.length} estimate-only compatibility rows; evidence: ${path.relative(repo, output)}`);
  } catch (error) {
    metadata.status = "failed"; metadata.finished_at_utc = new Date().toISOString(); metadata.completed_samples = rows.length;
    metadata.error = error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
    saveMetadata(); writeNew(path.join(output, "failure-partial-measurements.json"), JSON.stringify(rows, null, 2) + "\n");
    throw error;
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
