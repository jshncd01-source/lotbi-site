#!/usr/bin/env python3
"""Regression checks: the consumer-design relock must remain fail-closed."""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
import unittest

import validate_hardening as hardening
import validate_accessibility as accessibility

SOURCE = Path(__file__).resolve().parents[1]


class ConsumerPredeployGuards(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="lotbi-design-guards-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        files = set(hardening.LOCKED_SHA256) | set(accessibility.PAGES) | {
            "index.html", "site-hardening.css", "site-auth-continuity.css",
            "home-shell.js", "mobile-entry.js", "site-continuity.js",
            "site-asset-version.json", "home-chat.css", "mobile-entry.css",
        }
        for relative in files:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / relative, target)

    def check(self, module):
        previous_root = module.ROOT
        module.ROOT = self.root
        output = StringIO()
        try:
            with redirect_stdout(output):
                result = module.main()
        finally:
            module.ROOT = previous_root
        return result, output.getvalue()

    def change(self, relative, transform):
        target = self.root / relative
        target.write_text(transform(target.read_text(encoding="utf-8")), encoding="utf-8")

    def test_approved_candidate_passes(self):
        self.assertEqual(self.check(hardening)[0], 0)
        self.assertEqual(self.check(accessibility)[0], 0)

    def test_each_locked_text_rejects_content_changes(self):
        for relative in hardening.LOCKED_SHA256:
            if not relative.endswith((".html", ".css", ".js")):
                continue
            with self.subTest(file=relative):
                target = self.root / relative
                original = target.read_bytes()
                try:
                    self.change(relative, lambda text: text + "\nUNAPPROVED_CONTENT\n")
                    result, output = self.check(hardening)
                    self.assertEqual(result, 1)
                    self.assertIn("locked file changed", output)
                    self.assertIn(relative, output)
                finally:
                    target.write_bytes(original)

    def test_unknown_script_is_rejected(self):
        self.change("index.html", lambda text: text.replace("</body>", '<script src="unknown.js"></script></body>'))
        result, output = self.check(hardening)
        self.assertEqual(result, 1)
        self.assertIn("home page may run only", output)

    def test_layout_script_cannot_gain_networking(self):
        self.change("site-consumer-layout.js", lambda text: text + "\nfetch('/unexpected');\n")
        result, output = self.check(hardening)
        self.assertEqual(result, 1)
        self.assertIn("site-consumer-layout.js", output)

    def test_official_avatar_dimensions_are_bound_to_fallback(self):
        self.change("index.html", lambda text: text.replace('width="512"', 'width="511"'))
        result, output = self.check(hardening)
        self.assertEqual(result, 1)
        self.assertIn("avatar fallback", output)

    def test_unlabelled_additional_editor_is_rejected(self):
        self.change("index.html", lambda text: text.replace("</main>", '<textarea id="unknown-editor"></textarea></main>'))
        result, output = self.check(accessibility)
        self.assertEqual(result, 1)
        self.assertIn("every textarea requires", output)

    def test_duplicate_composer_is_rejected(self):
        self.change("index.html", lambda text: text.replace("</main>", '<textarea id="lotbi-prompt"></textarea></main>'))
        result, output = self.check(accessibility)
        self.assertEqual(result, 1)
        self.assertIn("expected one prompt textarea", output)

    def test_line_endings_only_do_not_unlock_styles(self):
        target = self.root / "styles.css"
        normalized = target.read_bytes().replace(b"\r\n", b"\n")
        target.write_bytes(normalized.replace(b"\n", b"\r\n"))
        self.assertEqual(self.check(hardening)[0], 0)


if __name__ == "__main__":
    unittest.main()
