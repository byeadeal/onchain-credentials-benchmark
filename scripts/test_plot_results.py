#!/usr/bin/env python3
"""Parser checks for scripts/plot_results.py.

The gas numbers in this file are fixtures for the parser. They are not benchmark measurements.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "plot_results.py"


def load_plot_results():
    spec = importlib.util.spec_from_file_location("plot_results", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["plot_results"] = module
    spec.loader.exec_module(module)
    return module


plot_results = load_plot_results()

HEADER = (
    "recorded_at,network,compiler,optimizer_runs,evm_version,"
    "architecture,cohort_size,operation,total_gas,transactions,gas_per_credential\n"
)


def issuance_csv() -> str:
    """Synthetic receipt rows. Deploy gas is deliberately different from issuance gas."""
    lines = [HEADER]
    specs = (
        ("hash_registry", 1, "deploy", 5000, 1, ""),
        ("hash_registry", 1, "issue", 100, 1, "100"),
        ("hash_registry", 10, "deploy", 5000, 1, ""),
        ("hash_registry", 10, "issue", 1000, 10, "100"),
        ("soulbound", 1, "deploy", 8000, 1, ""),
        ("soulbound", 1, "issue", 200, 1, "200"),
        ("soulbound", 10, "deploy", 8000, 1, ""),
        ("soulbound", 10, "issue", 2000, 10, "200"),
        ("merkle_anchor", 1, "deploy", 3000, 1, ""),
        ("merkle_anchor", 1, "issue", 80, 1, "80"),
        ("merkle_anchor", 10, "deploy", 3000, 1, ""),
        ("merkle_anchor", 10, "issue", 80, 1, "8"),
    )
    for architecture, cohort, operation, total, transactions, per in specs:
        lines.append(
            "2026-01-01T00:00:00Z,hardhat,0.8.28,200,cancun,"
            f"{architecture},{cohort},{operation},{total},{transactions},{per}\n"
        )
    return "".join(lines)


def write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


class IssuanceParserTest(unittest.TestCase):
    def test_splits_deploy_issue_and_per_credential(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = write(Path(tmp) / "issuance.csv", issuance_csv())
            rows = plot_results.load_issuance(path)
        self.assertEqual(len(rows), 12)
        issue = next(row for row in rows if row.architecture == "hash_registry" and row.cohort_size == 10 and row.operation == "issue")
        deploy = next(row for row in rows if row.architecture == "hash_registry" and row.cohort_size == 10 and row.operation == "deploy")
        merkle = next(row for row in rows if row.architecture == "merkle_anchor" and row.cohort_size == 10 and row.operation == "issue")
        self.assertEqual(issue.total_gas, 1000)
        self.assertEqual(issue.gas_per_credential, 100)
        self.assertIsNone(deploy.gas_per_credential)
        self.assertEqual(deploy.total_gas, 5000)
        self.assertEqual(merkle.transactions, 1)
        self.assertEqual(merkle.gas_per_credential, 8)

    def test_rejects_per_credential_that_is_not_floor_division(self) -> None:
        text = issuance_csv().replace(",1000,10,100\n", ",1000,10,99\n")
        with tempfile.TemporaryDirectory() as tmp:
            path = write(Path(tmp) / "issuance.csv", text)
            with self.assertRaises(ValueError) as caught:
                plot_results.load_issuance(path)
        self.assertIn("floor(total_gas / cohort_size)", str(caught.exception))

    def test_rejects_deploy_per_credential_and_bad_transaction_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            deploy_zero = issuance_csv().replace(",5000,1,\n", ",5000,1,0\n", 1)
            with self.assertRaises(ValueError) as caught:
                plot_results.load_issuance(write(root / "deploy.csv", deploy_zero))
            self.assertIn("blank for deploy", str(caught.exception))

            merkle_txs = issuance_csv().replace("merkle_anchor,10,issue,80,1,8\n", "merkle_anchor,10,issue,80,10,8\n")
            with self.assertRaises(ValueError) as caught:
                plot_results.load_issuance(write(root / "merkle.csv", merkle_txs))
            self.assertIn("transactions must be 1", str(caught.exception))

    def test_rejects_duplicate_and_unknown_architecture(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            duplicated = issuance_csv() + issuance_csv().splitlines()[-1] + "\n"
            with self.assertRaises(ValueError) as caught:
                plot_results.load_issuance(write(root / "dup.csv", duplicated))
            self.assertIn("duplicate", str(caught.exception))

            unknown = issuance_csv().replace("hash_registry", "registry", 1)
            with self.assertRaises(ValueError) as caught:
                plot_results.load_issuance(write(root / "unknown.csv", unknown))
            self.assertIn("architecture", str(caught.exception))


class ScenarioParserTest(unittest.TestCase):
    def test_verification_and_revocation_keep_measurement_kind(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            verification = write(
                root / "verification.csv",
                "architecture,cohort_size,scenario,gas,note\n"
                "hash_registry,1,valid,11,estimate\n"
                "hash_registry,1,invalid,12,estimate\n",
            )
            revocation = write(
                root / "revocation.csv",
                "architecture,cohort_size,scenario,gas\nsoulbound,10,revoke,42\n",
            )
            valid = plot_results.load_scenario(
                verification,
                source="verification",
                measurement="estimate",
                allowed_scenarios=plot_results.VERIFICATION_SCENARIOS,
            )
            revoke = plot_results.load_scenario(
                revocation,
                source="revocation",
                measurement="receipt",
                allowed_scenarios=plot_results.REVOCATION_SCENARIOS,
            )
        self.assertEqual([row.gas for row in valid], [11, 12])
        self.assertTrue(all(row.measurement == "estimate" for row in valid))
        self.assertEqual(revoke[0].measurement, "receipt")
        self.assertEqual(revoke[0].gas, 42)

    def test_blank_gas_and_wrong_scenario_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            blank = write(root / "blank.csv", "architecture,cohort_size,scenario,gas\nhash_registry,1,valid,\n")
            with self.assertRaises(ValueError) as caught:
                plot_results.load_scenario(
                    blank,
                    source="verification",
                    measurement="estimate",
                    allowed_scenarios=plot_results.VERIFICATION_SCENARIOS,
                )
            self.assertIn("not plotted as zero", str(caught.exception))

            wrong = write(root / "wrong.csv", "architecture,cohort_size,scenario,gas\nhash_registry,1,revoke,7\n")
            with self.assertRaises(ValueError) as caught:
                plot_results.load_scenario(
                    wrong,
                    source="verification",
                    measurement="estimate",
                    allowed_scenarios=plot_results.VERIFICATION_SCENARIOS,
                )
            self.assertIn("scenario", str(caught.exception))

            header_only = write(root / "empty.csv", "architecture,cohort_size,scenario,gas\n")
            rows = plot_results.load_scenario(
                header_only,
                source="revocation",
                measurement="receipt",
                allowed_scenarios=plot_results.REVOCATION_SCENARIOS,
            )
            self.assertEqual(rows, ())

    def test_missing_optional_default_is_skipped_and_explicit_path_is_not(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "verification.csv"
            path, note = plot_results.resolve_optional(None, missing)
            self.assertIsNone(path)
            self.assertIsNotNone(note)
            self.assertIn("not present", note or "")
            with self.assertRaises(FileNotFoundError):
                plot_results.resolve_optional(missing, missing)


class PanelSeparationTest(unittest.TestCase):
    def setUp(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            self.rows = plot_results.load_issuance(write(Path(tmp) / "issuance.csv", issuance_csv()))
        self.verification = (
            plot_results.ScenarioRow("hash_registry", 1, "valid", 11, "estimate", "verification"),
            plot_results.ScenarioRow("hash_registry", 10, "invalid", 12, "estimate", "verification"),
        )
        self.revocation = (plot_results.ScenarioRow("soulbound", 10, "revoke", 42, "receipt", "revocation"),)

    def test_issuance_panels_do_not_include_deploy_or_estimates(self) -> None:
        data = plot_results.assemble(self.rows)
        panels = plot_results.build_panels(data)
        self.assertEqual([panel.title for panel in panels], [
            "Total issuance gas",
            "Issuance gas per credential",
            "Deployment overhead",
        ])
        self.assertTrue(all(panel.measurement == "receipt" for panel in panels))
        totals = panels[0].series
        hash_total = next(series for series in totals if series.architecture == "hash_registry")
        self.assertEqual(hash_total.gas, (100, 1000))
        self.assertNotIn(5000, hash_total.gas)
        merkle_per = next(series for series in panels[1].series if series.architecture == "merkle_anchor")
        self.assertEqual(merkle_per.gas, (80, 8))
        hash_deploy = next(series for series in panels[2].series if series.architecture == "hash_registry")
        self.assertEqual(hash_deploy.gas, (5000, 5000))

    def test_optional_series_stay_on_their_own_panels(self) -> None:
        data = plot_results.assemble(self.rows, self.verification, self.revocation)
        panels = plot_results.build_panels(data)
        self.assertEqual(panels[3].title, "Verification gas")
        self.assertEqual(panels[3].measurement, "estimate")
        self.assertEqual(panels[3].ylabel, "eth_estimateGas")
        self.assertEqual(panels[4].title, "Revocation gas")
        self.assertEqual(panels[4].measurement, "receipt")
        verification_gas = {gas for series in panels[3].series for gas in series.gas}
        revocation_gas = {gas for series in panels[4].series for gas in series.gas}
        issuance_gas = {gas for panel in panels[:3] for series in panel.series for gas in series.gas}
        self.assertEqual(verification_gas, {11, 12})
        self.assertEqual(revocation_gas, {42})
        self.assertTrue(verification_gas.isdisjoint(issuance_gas))
        self.assertTrue(revocation_gas.isdisjoint(issuance_gas))
        self.assertEqual(panels[3].series[1].linestyle, "--")

    def test_recorded_zero_does_not_use_a_log_axis(self) -> None:
        revocation = (plot_results.ScenarioRow("hash_registry", 1, "revoke", 0, "receipt", "revocation"),)
        data = plot_results.assemble(self.rows, (), revocation)
        panel = plot_results.build_panels(data)[-1]
        self.assertEqual(panel.yscale, "linear")
        self.assertEqual(panel.series[0].gas, (0,))


class RenderTest(unittest.TestCase):
    def test_main_writes_png_when_optional_csvs_are_absent(self) -> None:
        try:
            import matplotlib  # noqa: F401
        except ImportError:
            self.skipTest("matplotlib is not installed")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            issuance = write(root / "issuance.csv", issuance_csv())
            output = root / "figures" / "gas_vs_cohort.png"
            work = root / "work"
            work.mkdir()
            previous = os.getcwd()
            os.chdir(work)
            try:
                code = plot_results.main(["--issuance", str(issuance), "--output", str(output)])
            finally:
                os.chdir(previous)
            self.assertEqual(code, 0)
            payload = output.read_bytes()
            self.assertTrue(payload.startswith(b"\x89PNG"))
            self.assertGreater(len(payload), 1000)
            missing = plot_results.main(["--issuance", str(root / "missing.csv"), "--output", str(output)])
            self.assertEqual(missing, 1)


if __name__ == "__main__":
    unittest.main()
