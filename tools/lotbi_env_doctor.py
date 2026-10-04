from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Mapping, Sequence, TextIO


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONTRACT = ROOT / ".lotbi" / "build-env.env"
FORBIDDEN_KEY_PARTS = ("TOKEN", "PASSWORD", "SECRET", "CREDENTIAL")
CHECK_KEYS = ("LOTBI_PYTHON_VERSION", "LOTBI_NODE_VERSION")


class ContractError(ValueError):
    """The checked-in environment contract is invalid."""


@dataclass(frozen=True)
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class Check:
    repo: str
    key: str
    expected: str
    actual: str
    status: str


Runner = Callable[[str, tuple[str, ...]], CommandResult]


def load_contract(path: Path) -> dict[str, str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ContractError("contract is unavailable") from exc

    values: dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not key or not value or key in values:
            raise ContractError("contract contains a malformed entry")
        if any(part in key.upper() for part in FORBIDDEN_KEY_PARTS):
            raise ContractError("contract contains a forbidden key category")
        values[key] = value

    required = {"LOTBI_ENV_CONTRACT_VERSION", "LOTBI_REPOSITORY", *CHECK_KEYS}
    if not required.issubset(values):
        raise ContractError("contract is missing required entries")
    if values["LOTBI_ENV_CONTRACT_VERSION"] != "1":
        raise ContractError("contract version is unsupported")
    return values


def _default_runner(label: str, command: tuple[str, ...]) -> CommandResult:
    del label
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as exc:
        return CommandResult(127, "", type(exc).__name__)
    return CommandResult(completed.returncode, completed.stdout, completed.stderr)


def _extract(label: str, result: CommandResult) -> str:
    if result.exit_code != 0:
        return "MISSING"
    output = result.stdout.strip()
    if label == "python":
        match = re.search(r"Python\s+(\d+\.\d+\.\d+)", output)
        return match.group(1) if match else "UNPARSEABLE"
    if label == "node":
        match = re.search(r"^v?(\d+\.\d+\.\d+)$", output)
        return match.group(1) if match else "UNPARSEABLE"
    return "UNPARSEABLE"


def collect_versions(runner: Runner = _default_runner) -> dict[str, str]:
    node = os.environ.get("LOTBI_NODE", "node")
    commands: tuple[tuple[str, str, tuple[str, ...]], ...] = (
        ("LOTBI_PYTHON_VERSION", "python", (sys.executable, "--version")),
        ("LOTBI_NODE_VERSION", "node", (node, "--version")),
    )
    return {
        key: _extract(label, runner(label, command))
        for key, label, command in commands
    }


def evaluate(expected: Mapping[str, str], actual: Mapping[str, str]) -> list[Check]:
    repo = expected["LOTBI_REPOSITORY"]
    return [
        Check(
            repo=repo,
            key=key,
            expected=expected[key],
            actual=actual.get(key, "MISSING"),
            status="PASS" if expected[key] == actual.get(key) else "FAIL",
        )
        for key in CHECK_KEYS
    ]


def _safe_field(value: str) -> str:
    return re.sub(r"\s+", "_", value.strip()) or "EMPTY"


def _write_result(checks: list[Check], repo: str, as_json: bool, stdout: TextIO) -> int:
    failed = sum(check.status == "FAIL" for check in checks)
    result = {
        "repo": repo,
        "status": "FAIL" if failed else "PASS",
        "failed": failed,
        "skipped": 0,
    }
    if as_json:
        json.dump({"checks": [asdict(check) for check in checks], "result": result}, stdout, sort_keys=True)
        stdout.write("\n")
    else:
        for check in checks:
            stdout.write(
                "LOTBI_ENV_CHECK "
                f"repo={_safe_field(check.repo)} "
                f"key={_safe_field(check.key)} "
                f"expected={_safe_field(check.expected)} "
                f"actual={_safe_field(check.actual)} "
                f"status={check.status}\n"
            )
        stdout.write(
            "LOTBI_ENV_RESULT "
            f"repo={_safe_field(repo)} status={result['status']} "
            f"failed={failed} skipped=0\n"
        )
    return 1 if failed else 0


def main(
    argv: Sequence[str] | None = None,
    *,
    runner: Runner = _default_runner,
    stdout: TextIO = sys.stdout,
) -> int:
    parser = argparse.ArgumentParser(description="Check the lotbi-site helper environment")
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    try:
        expected = load_contract(args.contract)
    except ContractError:
        result = {"repo": "UNKNOWN", "status": "ERROR", "failed": 0, "skipped": 0}
        if args.json:
            json.dump({"checks": [], "result": result}, stdout, sort_keys=True)
            stdout.write("\n")
        else:
            stdout.write("LOTBI_ENV_RESULT repo=UNKNOWN status=ERROR failed=0 skipped=0\n")
        return 2

    checks = evaluate(expected, collect_versions(runner))
    return _write_result(checks, expected["LOTBI_REPOSITORY"], args.json, stdout)


if __name__ == "__main__":
    raise SystemExit(main())
