from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCKERFILE = ROOT / "Dockerfile"
CONTRACT = ROOT / ".lotbi" / "build-env.env"
EXPECTED_IMAGE = "nginx:1.28-alpine"
EXPECTED_DIGEST = "sha256:0dcc88822d45581e65ae329f8be769762bf628d3b2bb7d2a077d4aa5c98b30e3"
DIGEST_PATTERN = re.compile(r"sha256:[0-9a-f]{64}")


def contract_values() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in CONTRACT.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            key, separator, value = line.partition("=")
            if separator:
                values[key] = value
    return values


class ContainerPinTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    def test_base_image_is_digest_pinned_for_linux_amd64(self) -> None:
        match = re.search(r"^FROM\s+--platform=(\S+)\s+(\S+)$", self.dockerfile, re.MULTILINE)
        self.assertIsNotNone(match, "FROM must pin the target platform")
        assert match is not None
        platform, image = match.groups()
        self.assertEqual(platform, "linux/amd64")
        self.assertTrue(image.startswith(f"{EXPECTED_IMAGE}@"), image)
        digest = image.removeprefix(f"{EXPECTED_IMAGE}@")
        self.assertRegex(digest, rf"^{DIGEST_PATTERN.pattern}$")
        self.assertEqual(digest, EXPECTED_DIGEST)
        self.assertNotIn("latest", image)

    def test_contract_platform_matches_the_dockerfile(self) -> None:
        self.assertEqual(contract_values().get("LOTBI_DOCKER_PLATFORM"), "linux/amd64")

    def test_oci_source_and_revision_labels_are_declared(self) -> None:
        self.assertRegex(self.dockerfile, r"(?m)^ARG\s+VCS_REF=unknown$")
        self.assertRegex(
            self.dockerfile,
            r"(?m)^ARG\s+VCS_SOURCE=ssh://lotbi-ncloud-ro/srv/git/repositories/lotbi-site\.git$",
        )
        self.assertRegex(
            self.dockerfile,
            r'org\.opencontainers\.image\.source="\$\{VCS_SOURCE\}"',
        )
        self.assertRegex(
            self.dockerfile,
            r'org\.opencontainers\.image\.revision="\$\{VCS_REF\}"',
        )


if __name__ == "__main__":
    unittest.main()
