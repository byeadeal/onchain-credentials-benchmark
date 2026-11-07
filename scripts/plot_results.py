#!/usr/bin/env python3
"""Plot credential gas against cohort size.

Issuance input is the CSV written by scripts/benchmark.ts. Its total_gas values
are receipt gasUsed. Deployment, issuance totals, and per-credential issuance
are drawn as separate panels. gas_per_credential is floor(total_gas / cohort_size)
on issue rows and is not eth_estimateGas.

Optional verification and revocation CSVs use:

    architecture,cohort_size,scenario,gas

Verification scenarios are valid and invalid. Their gas column is eth_estimateGas.
The revocation scenario is revoke. Its gas column is receipt gasUsed.
A missing optional file is skipped. This script does not invent measurements.
"""

from __future__ import annotations

import argparse
import csv
import math
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ARCH_ORDER = ("hash_registry", "soulbound", "merkle_anchor")
ARCH_LABEL = {
    "hash_registry": "Hash registry",
    "soulbound": "Soulbound",
    "merkle_anchor": "Merkle anchor",
}
ARCH_COLOR = {
    "hash_registry": "#0072B2",
    "soulbound": "#D55E00",
    "merkle_anchor": "#009E73",
}
ARCH_MARKER = {
    "hash_registry": "o",
    "soulbound": "s",
    "merkle_anchor": "D",
}

ISSUANCE_COLUMNS = (
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
)
SCENARIO_COLUMNS = ("architecture", "cohort_size", "scenario", "gas")
VERIFICATION_SCENARIOS = frozenset({"valid", "invalid"})
REVOCATION_SCENARIOS = frozenset({"revoke"})
SCENARIO_ORDER = ("valid", "invalid", "revoke")

DEFAULT_ISSUANCE = Path("results/issuance.csv")
DEFAULT_VERIFICATION = Path("results/verification.csv")
DEFAULT_REVOCATION = Path("results/revocation.csv")
DEFAULT_OUTPUT = Path("results/figures/gas_vs_cohort.png")

UINT_RE_DESCRIPTION = "non-negative decimal integer"


@dataclass(frozen=True)
class IssuanceRow:
    architecture: str
    cohort_size: int
    operation: str
    total_gas: int
    transactions: int
    gas_per_credential: int | None
    recorded_at: str
    network: str
    compiler: str
    optimizer_runs: str
    evm_version: str


@dataclass(frozen=True)
class ScenarioRow:
    architecture: str
    cohort_size: int
    scenario: str
    gas: int
    measurement: str
    source: str


@dataclass(frozen=True)
class Series:
    label: str
    architecture: str
    measurement: str
    cohort_sizes: tuple[int, ...]
    gas: tuple[int, ...]
    linestyle: str = "-"


@dataclass(frozen=True)
class Panel:
    title: str
    ylabel: str
    measurement: str
    yscale: str
    series: tuple[Series, ...]
    note: str


@dataclass(frozen=True)
class PlotData:
    issuance: tuple[IssuanceRow, ...]
    verification: tuple[ScenarioRow, ...]
    revocation: tuple[ScenarioRow, ...]
    notes: tuple[str, ...]


def _cell(row: dict[str, str | None], column: str) -> str:
    value = row.get(column)
    if value is None:
        return ""
    return value.strip()


def _require_columns(path: Path, fieldnames: list[str] | None, required: tuple[str, ...]) -> None:
    if not fieldnames:
        raise ValueError(f"{path}: missing header")
    missing = [name for name in required if name not in fieldnames]
    if missing:
        raise ValueError(f"{path}: missing columns: {', '.join(missing)}")


def _uint(path: Path, line_no: int, column: str, raw: str) -> int:
    if not raw.isascii() or not raw.isdecimal():
        raise ValueError(f"{path}:{line_no}: {column} must be a {UINT_RE_DESCRIPTION}, got {raw!r}")
    return int(raw)


def _architecture(path: Path, line_no: int, raw: str) -> str:
    if raw not in ARCH_LABEL:
        known = ", ".join(ARCH_ORDER)
        raise ValueError(f"{path}:{line_no}: architecture must be one of {known}, got {raw!r}")
    return raw


def _blank(row: dict[str, str | None]) -> bool:
    return all(value is None or value.strip() == "" for value in row.values())


def _open_csv(path: Path):
    if not path.is_file():
        raise FileNotFoundError(f"CSV not found: {path}")
    return path.open(newline="", encoding="utf-8-sig")


def _expected_transactions(architecture: str, operation: str, cohort_size: int) -> int:
    if operation == "deploy":
        return 1
    if architecture == "merkle_anchor":
        return 1
    return cohort_size


def load_issuance(path: Path) -> tuple[IssuanceRow, ...]:
    """Read the benchmark issuance CSV. Reject rows that disagree with its accounting."""
    rows: list[IssuanceRow] = []
    seen: set[tuple[str, int, str]] = set()
    with _open_csv(path) as handle:
        reader = csv.DictReader(handle)
        _require_columns(path, reader.fieldnames, ISSUANCE_COLUMNS)
        for line_no, raw in enumerate(reader, start=2):
            if raw is None or _blank(raw):
                continue
            architecture = _architecture(path, line_no, _cell(raw, "architecture"))
            cohort_size = _uint(path, line_no, "cohort_size", _cell(raw, "cohort_size"))
            if cohort_size < 1:
                raise ValueError(f"{path}:{line_no}: cohort_size must be >= 1")
            operation = _cell(raw, "operation")
            if operation not in ("deploy", "issue"):
                raise ValueError(f"{path}:{line_no}: operation must be deploy or issue, got {operation!r}")
            total_gas = _uint(path, line_no, "total_gas", _cell(raw, "total_gas"))
            transactions = _uint(path, line_no, "transactions", _cell(raw, "transactions"))
            expected_txs = _expected_transactions(architecture, operation, cohort_size)
            if transactions != expected_txs:
                raise ValueError(
                    f"{path}:{line_no}: {architecture} {operation} transactions must be {expected_txs}, got {transactions}"
                )
            per_raw = _cell(raw, "gas_per_credential")
            if operation == "deploy":
                if per_raw != "":
                    raise ValueError(
                        f"{path}:{line_no}: gas_per_credential must be blank for deploy, got {per_raw!r}"
                    )
                per_credential = None
            else:
                per_credential = _uint(path, line_no, "gas_per_credential", per_raw)
                expected_per = total_gas // cohort_size
                if per_credential != expected_per:
                    raise ValueError(
                        f"{path}:{line_no}: gas_per_credential must be floor(total_gas / cohort_size) = {expected_per}, got {per_credential}"
                    )
            metadata = {
                name: _cell(raw, name)
                for name in ("recorded_at", "network", "compiler", "optimizer_runs", "evm_version")
            }
            missing_meta = [name for name, value in metadata.items() if value == ""]
            if missing_meta:
                raise ValueError(f"{path}:{line_no}: blank metadata: {', '.join(missing_meta)}")
            key = (architecture, cohort_size, operation)
            if key in seen:
                raise ValueError(
                    f"{path}:{line_no}: duplicate {architecture} cohort {cohort_size} {operation}"
                )
            seen.add(key)
            rows.append(
                IssuanceRow(
                    architecture=architecture,
                    cohort_size=cohort_size,
                    operation=operation,
                    total_gas=total_gas,
                    transactions=transactions,
                    gas_per_credential=per_credential,
                    recorded_at=metadata["recorded_at"],
                    network=metadata["network"],
                    compiler=metadata["compiler"],
                    optimizer_runs=metadata["optimizer_runs"],
                    evm_version=metadata["evm_version"],
                )
            )
    if not rows:
        raise ValueError(f"{path}: no issuance rows")
    return tuple(rows)


def load_scenario(
    path: Path,
    *,
    source: str,
    measurement: str,
    allowed_scenarios: frozenset[str],
) -> tuple[ScenarioRow, ...]:
    """Read an optional verification or revocation CSV. Header-only means no rows."""
    rows: list[ScenarioRow] = []
    seen: set[tuple[str, int, str]] = set()
    with _open_csv(path) as handle:
        reader = csv.DictReader(handle)
        _require_columns(path, reader.fieldnames, SCENARIO_COLUMNS)
        for line_no, raw in enumerate(reader, start=2):
            if raw is None or _blank(raw):
                continue
            architecture = _architecture(path, line_no, _cell(raw, "architecture"))
            cohort_size = _uint(path, line_no, "cohort_size", _cell(raw, "cohort_size"))
            if cohort_size < 1:
                raise ValueError(f"{path}:{line_no}: cohort_size must be >= 1")
            scenario = _cell(raw, "scenario")
            if scenario not in allowed_scenarios:
                allowed = ", ".join(sorted(allowed_scenarios))
                raise ValueError(f"{path}:{line_no}: scenario must be one of {allowed}, got {scenario!r}")
            gas_raw = _cell(raw, "gas")
            if gas_raw == "":
                raise ValueError(
                    f"{path}:{line_no}: gas is blank for {architecture} cohort {cohort_size} {scenario}; "
                    "blank is not plotted as zero"
                )
            gas = _uint(path, line_no, "gas", gas_raw)
            key = (architecture, cohort_size, scenario)
            if key in seen:
                raise ValueError(
                    f"{path}:{line_no}: duplicate {architecture} cohort {cohort_size} {scenario}"
                )
            seen.add(key)
            rows.append(
                ScenarioRow(
                    architecture=architecture,
                    cohort_size=cohort_size,
                    scenario=scenario,
                    gas=gas,
                    measurement=measurement,
                    source=source,
                )
            )
    return tuple(rows)


def _coverage_notes(rows: tuple[IssuanceRow, ...]) -> tuple[str, ...]:
    notes: list[str] = []
    for operation in ("deploy", "issue"):
        present: dict[str, set[int]] = defaultdict(set)
        for row in rows:
            if row.operation == operation:
                present[row.architecture].add(row.cohort_size)
        if not present:
            notes.append(f"no {operation} rows")
            continue
        union = set().union(*present.values())
        for architecture in ARCH_ORDER:
            if architecture not in present:
                notes.append(f"no {architecture} {operation} rows")
                continue
            missing = sorted(union - present[architecture])
            if missing:
                joined = ", ".join(str(size) for size in missing)
                notes.append(f"{architecture} {operation} has no rows for cohort sizes {joined}")
    issue_keys = {(row.architecture, row.cohort_size) for row in rows if row.operation == "issue"}
    deploy_keys = {(row.architecture, row.cohort_size) for row in rows if row.operation == "deploy"}
    for architecture, cohort_size in sorted(issue_keys - deploy_keys):
        notes.append(
            f"no deploy row for {architecture} cohort {cohort_size}; issue total does not include deployment"
        )
    return tuple(notes)


def assemble(
    issuance: tuple[IssuanceRow, ...],
    verification: tuple[ScenarioRow, ...] = (),
    revocation: tuple[ScenarioRow, ...] = (),
    notes: tuple[str, ...] = (),
) -> PlotData:
    return PlotData(
        issuance=issuance,
        verification=verification,
        revocation=revocation,
        notes=notes + _coverage_notes(issuance),
    )


def _yscale(values: tuple[int, ...], preferred: str) -> str:
    if not values or any(value <= 0 for value in values):
        return "linear"
    return preferred


def _issuance_series(
    rows: tuple[IssuanceRow, ...],
    operation: str,
    value_name: str,
) -> tuple[Series, ...]:
    grouped: dict[str, list[IssuanceRow]] = defaultdict(list)
    for row in rows:
        if row.operation == operation:
            grouped[row.architecture].append(row)
    series: list[Series] = []
    for architecture in ARCH_ORDER:
        points = sorted(grouped.get(architecture, []), key=lambda row: row.cohort_size)
        if not points:
            continue
        if value_name == "total_gas":
            gas = tuple(point.total_gas for point in points)
        elif value_name == "gas_per_credential":
            gas = tuple(
                point.gas_per_credential if point.gas_per_credential is not None else point.total_gas // point.cohort_size
                for point in points
            )
        else:
            raise ValueError(f"unknown issuance value {value_name}")
        series.append(
            Series(
                label=ARCH_LABEL[architecture],
                architecture=architecture,
                measurement="receipt",
                cohort_sizes=tuple(point.cohort_size for point in points),
                gas=gas,
            )
        )
    return tuple(series)


def _scenario_series(rows: tuple[ScenarioRow, ...], measurement: str) -> tuple[Series, ...]:
    grouped: dict[tuple[str, str], list[ScenarioRow]] = defaultdict(list)
    for row in rows:
        if row.measurement != measurement:
            raise ValueError(f"{row.source} row {row.scenario} is {row.measurement}, expected {measurement}")
        grouped[(row.architecture, row.scenario)].append(row)
    series: list[Series] = []
    for scenario in SCENARIO_ORDER:
        for architecture in ARCH_ORDER:
            points = sorted(grouped.get((architecture, scenario), []), key=lambda row: row.cohort_size)
            if not points:
                continue
            series.append(
                Series(
                    label=f"{ARCH_LABEL[architecture]} {scenario}",
                    architecture=architecture,
                    measurement=measurement,
                    cohort_sizes=tuple(point.cohort_size for point in points),
                    gas=tuple(point.gas for point in points),
                    linestyle="--" if scenario == "invalid" else "-",
                )
            )
    return tuple(series)


def build_panels(data: PlotData) -> tuple[Panel, ...]:
    """Separate receipt totals, per-credential receipt quotients, deploy, estimates, and revoke receipts."""
    issue_totals = _issuance_series(data.issuance, "issue", "total_gas")
    per_credential = _issuance_series(data.issuance, "issue", "gas_per_credential")
    deploy = _issuance_series(data.issuance, "deploy", "total_gas")
    if not issue_totals:
        raise ValueError("issuance CSV has no issue rows to plot")
    panels = [
        Panel(
            title="Total issuance gas",
            ylabel="receipt gasUsed",
            measurement="receipt",
            yscale=_yscale(tuple(value for series in issue_totals for value in series.gas), "log"),
            series=issue_totals,
            note="Sum of issuance receipts. Deployment is not included.",
        ),
        Panel(
            title="Issuance gas per credential",
            ylabel="floor(receipt total / N)",
            measurement="receipt",
            yscale=_yscale(tuple(value for series in per_credential for value in series.gas), "log"),
            series=per_credential,
            note="Integer division of the issuance receipt total. Not eth_estimateGas.",
        ),
        Panel(
            title="Deployment overhead",
            ylabel="receipt gasUsed",
            measurement="receipt",
            yscale="linear",
            series=deploy,
            note="One deployment receipt per cohort. Not included in issuance totals.",
        ),
    ]
    if data.verification:
        verification = _scenario_series(data.verification, "estimate")
        panels.append(
            Panel(
                title="Verification gas",
                ylabel="eth_estimateGas",
                measurement="estimate",
                yscale=_yscale(tuple(value for series in verification for value in series.gas), "log"),
                series=verification,
                note="Scenarios valid and invalid. Simulated gas, not a mined receipt.",
            )
        )
    if data.revocation:
        revocation = _scenario_series(data.revocation, "receipt")
        panels.append(
            Panel(
                title="Revocation gas",
                ylabel="receipt gasUsed",
                measurement="receipt",
                yscale=_yscale(tuple(value for series in revocation for value in series.gas), "log"),
                series=revocation,
                note="Scenario revoke. Mined receipt gas, not an estimate.",
            )
        )
    return tuple(panels)


def metadata_line(rows: tuple[IssuanceRow, ...]) -> str:
    fields = ("network", "compiler", "optimizer_runs", "evm_version", "recorded_at")
    unique = {field: {getattr(row, field) for row in rows} for field in fields}
    parts: list[str] = []
    network = unique["network"]
    compiler = unique["compiler"]
    runs = unique["optimizer_runs"]
    evm = unique["evm_version"]
    recorded = unique["recorded_at"]
    if len(network) == 1:
        parts.append(next(iter(network)))
    if len(compiler) == 1:
        parts.append(f"solc {next(iter(compiler))}")
    if len(runs) == 1:
        parts.append(f"optimizer {next(iter(runs))}")
    if len(evm) == 1:
        parts.append(next(iter(evm)))
    if len(recorded) == 1:
        parts.append(next(iter(recorded)))
    if any(len(values) != 1 for values in unique.values()):
        parts.append("other metadata varies; see the CSV")
    return " · ".join(parts)


def footnote(panels: tuple[Panel, ...]) -> str:
    sentences = [
        "Issuance totals and deployment are receipt gasUsed and are plotted separately.",
        "Per-credential issuance is floor(total receipt gas / cohort size): one transaction per credential for the hash registry and the soulbound token, and one anchor receipt divided by the cohort for Merkle.",
        "That quotient is not eth_estimateGas.",
    ]
    kinds = {panel.title for panel in panels}
    if "Verification gas" in kinds:
        sentences.append("Verification gas is eth_estimateGas for scenarios valid and invalid.")
    else:
        sentences.append("No verification CSV was plotted.")
    if "Revocation gas" in kinds:
        sentences.append("Revocation gas is receipt gasUsed for scenario revoke.")
    else:
        sentences.append("No revocation CSV was plotted.")
    return " ".join(sentences)


def render(panels: tuple[Panel, ...], subtitle: str, output: Path) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.ticker import FuncFormatter, NullFormatter, ScalarFormatter
    except ImportError as exc:
        raise SystemExit(
            "matplotlib is required for plotting. Install it with: python3 -m pip install matplotlib"
        ) from exc

    def thousands(value: float, _pos: int) -> str:
        if abs(value) >= 1000:
            return f"{value:,.0f}"
        if float(value).is_integer():
            return f"{value:.0f}"
        return f"{value:g}"

    count = len(panels)
    columns = min(3, count)
    rows = math.ceil(count / columns)
    fig, axes = plt.subplots(rows, columns, figsize=(4.8 * columns, 4.1 * rows + 1.15), squeeze=False)
    flat_axes = list(axes.ravel())
    for index, panel in enumerate(panels):
        axis = flat_axes[index]
        for series in panel.series:
            axis.plot(
                series.cohort_sizes,
                series.gas,
                label=series.label,
                color=ARCH_COLOR[series.architecture],
                marker=ARCH_MARKER[series.architecture],
                linestyle=series.linestyle,
                linewidth=1.8,
                markersize=6,
            )
        cohort_sizes = sorted({size for series in panel.series for size in series.cohort_sizes})
        axis.set_xscale("log")
        axis.set_xticks(cohort_sizes)
        axis.xaxis.set_major_formatter(ScalarFormatter())
        axis.xaxis.set_minor_formatter(NullFormatter())
        axis.set_xlabel("cohort size")
        axis.set_ylabel(panel.ylabel)
        if panel.yscale == "log":
            axis.set_yscale("log")
        else:
            gas_values = [gas for series in panel.series for gas in series.gas]
            if gas_values and max(gas_values) > 0:
                axis.set_ylim(bottom=0)
            axis.yaxis.set_major_formatter(FuncFormatter(thousands))
        axis.set_title(panel.title, fontsize=12, pad=8)
        axis.grid(True, which="major", color="#d0d0d0", linewidth=0.6)
        axis.set_axisbelow(True)
        if panel.series:
            axis.legend(frameon=False, fontsize=8)
        axis.text(0.0, -0.28, panel.note, transform=axis.transAxes, ha="left", va="top", fontsize=7.5, color="#333333")
    for axis in flat_axes[count:]:
        axis.remove()
    fig.tight_layout(rect=(0, 0.16, 1, 0.86))
    fig.suptitle("Credential gas versus cohort size", fontsize=14, y=0.975)
    fig.text(0.5, 0.905, subtitle, ha="center", va="center", fontsize=8, color="#333333")
    fig.text(0.01, 0.02, footnote(panels), ha="left", va="bottom", fontsize=7.5, color="#333333")
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def resolve_optional(explicit: Path | None, default: Path) -> tuple[Path | None, str | None]:
    """Use an explicit path if given. Otherwise skip a missing default without inventing data."""
    if explicit is not None:
        if not explicit.is_file():
            raise FileNotFoundError(f"optional CSV not found: {explicit}")
        return explicit, None
    if default.is_file():
        return default, None
    return None, f"skipped {default} (not present)"


def format_report(data: PlotData, output: Path) -> str:
    lines = [f"issuance rows: {len(data.issuance)}"]
    for note in data.notes:
        lines.append(f"note: {note}")
    if data.verification:
        lines.append(f"verification rows: {len(data.verification)} (eth_estimateGas)")
    if data.revocation:
        lines.append(f"revocation rows: {len(data.revocation)} (receipt gasUsed)")
    lines.append("plotted series:")
    for panel in build_panels(data):
        lines.append(f"  [{panel.measurement}] {panel.title}")
        for series in panel.series:
            points = ", ".join(
                f"N={size}:{gas}" for size, gas in zip(series.cohort_sizes, series.gas, strict=True)
            )
            lines.append(f"    {series.label}: {points}")
    lines.append(f"wrote {output}")
    return "\n".join(lines)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Plot credential gas against cohort size. "
            "Issuance and deployment gas are receipt gasUsed. "
            "Optional verification gas is eth_estimateGas for scenarios valid and invalid. "
            "Optional revocation gas is receipt gasUsed for scenario revoke. "
            "Missing optional CSVs are skipped and are not drawn as zero."
        )
    )
    parser.add_argument("--issuance", type=Path, default=DEFAULT_ISSUANCE, help="benchmark issuance CSV")
    parser.add_argument(
        "--verification",
        type=Path,
        default=None,
        help=f"optional verification CSV (default if present: {DEFAULT_VERIFICATION})",
    )
    parser.add_argument(
        "--revocation",
        type=Path,
        default=None,
        help=f"optional revocation CSV (default if present: {DEFAULT_REVOCATION})",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="figure path")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not args.issuance.is_file():
        print(f"issuance CSV not found: {args.issuance}", file=sys.stderr)
        return 1
    try:
        verification_path, verification_note = resolve_optional(args.verification, DEFAULT_VERIFICATION)
        revocation_path, revocation_note = resolve_optional(args.revocation, DEFAULT_REVOCATION)
        notes = tuple(note for note in (verification_note, revocation_note) if note)
        verification = (
            load_scenario(
                verification_path,
                source="verification",
                measurement="estimate",
                allowed_scenarios=VERIFICATION_SCENARIOS,
            )
            if verification_path is not None
            else ()
        )
        revocation = (
            load_scenario(
                revocation_path,
                source="revocation",
                measurement="receipt",
                allowed_scenarios=REVOCATION_SCENARIOS,
            )
            if revocation_path is not None
            else ()
        )
        if verification_path is not None and not verification:
            notes = notes + (f"{verification_path}: no data rows; verification panel omitted",)
        if revocation_path is not None and not revocation:
            notes = notes + (f"{revocation_path}: no data rows; revocation panel omitted",)
        data = assemble(load_issuance(args.issuance), verification, revocation, notes)
        panels = build_panels(data)
        render(panels, metadata_line(data.issuance), args.output)
    except (OSError, ValueError, FileNotFoundError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(format_report(data, args.output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
