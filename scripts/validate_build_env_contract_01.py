from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import lotbi_env_doctor as doctor  # noqa: E402


EXPECTED_CONTRACT = """\
LOTBI_ENV_CONTRACT_VERSION=1
LOTBI_REPOSITORY=lotbi-site
LOTBI_PYTHON_VERSION=3.13.16
LOTBI_NODE_VERSION=24.21.0
LOTBI_DOCKER_PLATFORM=linux/amd64
"""


def runner(overrides: dict[str, doctor.CommandResult] | None = None) -> doctor.Runner:
    results = {
        "python": doctor.CommandResult(0, "Python 3.13.16\n", ""),
        "node": doctor.CommandResult(0, "v24.21.0\n", ""),
    }
    results.update(overrides or {})
    return lambda label, _command: results[label]


class BuildEnvironmentContractTests(unittest.TestCase):
    def contract_file(self, content: str = EXPECTED_CONTRACT) -> Path:
        descriptor, name = tempfile.mkstemp(
            prefix="test-contract-",
            suffix=".env",
            dir=ROOT / ".lotbi",
        )
        os.close(descriptor)
        target = Path(name)
        self.addCleanup(target.unlink, missing_ok=True)
        target.write_text(content, encoding="utf-8")
        return target

    def test_exact_pins_and_no_dependency_project_are_present(self) -> None:
        self.assertEqual((ROOT / ".python-version").read_text(encoding="utf-8").strip(), "3.13.16")
        self.assertEqual((ROOT / ".node-version").read_text(encoding="utf-8").strip(), "24.21.0")
        self.assertEqual(
            (ROOT / ".lotbi" / "build-env.env").read_text(encoding="utf-8"),
            EXPECTED_CONTRACT,
        )
        for forbidden in ("package.json", "package-lock.json", "node_modules", "pyproject.toml"):
            self.assertFalse((ROOT / forbidden).exists(), forbidden)
        self.assertEqual(list(ROOT.glob("requirements*.txt")), [])

    def test_doctor_passes_exact_versions_and_emits_common_output(self) -> None:
        output = io.StringIO()
        result = doctor.main(
            ["--contract", str(self.contract_file())],
            runner=runner(),
            stdout=output,
        )
        self.assertEqual(result, 0)
        self.assertIn(
            "LOTBI_ENV_CHECK repo=lotbi-site key=LOTBI_PYTHON_VERSION "
            "expected=3.13.16 actual=3.13.16 status=PASS",
            output.getvalue(),
        )
        self.assertIn("LOTBI_ENV_RESULT repo=lotbi-site status=PASS failed=0 skipped=0", output.getvalue())

    def test_doctor_returns_one_for_mismatch_or_missing_node(self) -> None:
        for node_result in (
            doctor.CommandResult(0, "v24.20.0\n", ""),
            doctor.CommandResult(127, "", "missing"),
        ):
            with self.subTest(node_result=node_result):
                output = io.StringIO()
                result = doctor.main(
                    ["--contract", str(self.contract_file())],
                    runner=runner({"node": node_result}),
                    stdout=output,
                )
                self.assertEqual(result, 1)
                self.assertRegex(output.getvalue(), r"key=LOTBI_NODE_VERSION .* status=FAIL")

    def test_malformed_contract_is_secret_safe(self) -> None:
        secret = "do-not-print-this"
        output = io.StringIO()
        result = doctor.main(
            ["--contract", str(self.contract_file(EXPECTED_CONTRACT + f"LOTBI_SECRET_TOKEN={secret}\n"))],
            runner=runner(),
            stdout=output,
        )
        self.assertEqual(result, 2)
        self.assertNotIn(secret, output.getvalue())
        self.assertNotIn("LOTBI_SECRET_TOKEN", output.getvalue())
        self.assertIn("LOTBI_ENV_RESULT repo=UNKNOWN status=ERROR", output.getvalue())

    def test_json_contains_checks_and_final_result(self) -> None:
        output = io.StringIO()
        result = doctor.main(
            ["--json", "--contract", str(self.contract_file())],
            runner=runner(),
            stdout=output,
        )
        self.assertEqual(result, 0)
        payload = json.loads(output.getvalue())
        self.assertEqual(
            payload["result"],
            {"repo": "lotbi-site", "status": "PASS", "failed": 0, "skipped": 0},
        )
        self.assertEqual(
            [item["key"] for item in payload["checks"]],
            ["LOTBI_PYTHON_VERSION", "LOTBI_NODE_VERSION"],
        )


if __name__ == "__main__":
    unittest.main()
