"""Regression checks for publication blocking; all values generated fictionally."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('guard', Path(__file__).with_name('check-publication.py'))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class PublicationTest(unittest.TestCase):
    def test_blocks_private_files_even_without_obvious_values(self):
        for name in ['.env', '.codex/auth.json', '.dsh/.credentials.yaml', 'records/run.sqlite', 'runtime.log']:
            self.assertTrue(guard.scan(name, b'{}'), name)

    def test_blocks_generated_credentials_and_private_contact(self):
        for value in [b'sk-' + b'Z' * 40, b'password="' + b'Z' * 20 + b'"', b'person' + b'@private-mail.invalid']:
            self.assertTrue(guard.scan('sample.txt', value))

    def test_blocks_build_path_and_rendered_skill(self):
        self.assertTrue(guard.scan('bundle', b'/Users/' + b'local-user/private-project/main.cjs'))
        self.assertTrue(guard.scan('skills/customer-test-logs/SKILL.md', b'personal rendered command'))
        self.assertFalse(guard.scan('skills/customer-test-logs/SKILL.md', b'{{HELPER_INVOCATION}}'))

    def test_allows_explicit_fiction_and_runtime_attribution(self):
        self.assertFalse(guard.scan('sample.txt', b'sk-FAKE_1234567890123456789 person@example.invalid'))
        vendor_string = b'sk-' + b'Z' * 40
        self.assertFalse(guard.scan('binary', vendor_string, runtime=vendor_string))
        self.assertTrue(guard.scan('binary', vendor_string, runtime=b'unrelated-runtime'))

if __name__ == '__main__':
    unittest.main()
