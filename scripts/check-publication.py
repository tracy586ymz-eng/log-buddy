#!/usr/bin/env python3
"""Best-effort public-source/package guard; never print matched secret values."""
import argparse
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    'provider-key': rb'\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b',
    'email': rb'[A-Za-z0-9._%+-]{1,120}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,20}',
    'personal-path': rb'/(?:Users|home)/[A-Za-z0-9._-]+/[A-Za-z0-9_./ -]{1,240}',
    'private-key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{0,12000}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'credential-value': rb'(?i)\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)\s*["\x27]?\s*[:=]\s*["\x27]([^"\x27\r\n]{6,160})["\x27]',
}
# These are explicitly fictional values used to exercise copy redaction.
FICTIONAL = (b'fake', b'demo_', b'example.invalid', b'example.com', b'/Users/privateuser/', b'/home/privateuser/', b'/Users/example/', b'/home/example/', b'/path/to/', b'/Users/[', b'/home/[')
# Node's required license includes upstream attribution, not maintainer contact data.
LICENSE_EMAILS = set(re.findall(PATTERNS['email'], (ROOT / 'NODE-LICENSE').read_bytes()))

def blocked_name(name):
    parts = Path(name).parts
    return any(p in {'.git', '.codex', '.dsh', 'records', 'node_modules'} for p in parts) or any(
        p in {'auth.json', '.credentials.yaml', '.credentials.yml', 'settings.yaml', 'cordis.patch.yml', '.env'}
        or (p.startswith('.env.') and p != '.env.example')
        or p.endswith(('.log', '.sqlite', '.sqlite-wal', '.sqlite-shm', '.session.json', '.meta.json')) for p in parts)

def scan(name, data, runtime=b''):
    issues = []
    if blocked_name(name):
        issues.append({'file': name, 'type': 'private-runtime-or-config-file'})
    for kind, pattern in PATTERNS.items():
        for match in re.finditer(pattern, data):
            value = match.group()
            if any(marker.lower() in value.lower() for marker in FICTIONAL):
                continue
            if kind == 'email' and (value in LICENSE_EMAILS or value.endswith(b'@users.noreply.github.com')):
                continue
            if runtime and value in runtime:
                continue  # Inherited from the separately supplied, unmodified Node runtime.
            # Literal expressions/placeholder strings are code, not configured credentials.
            if kind == 'credential-value' and (b'[SECRET_' in match.group(1) or b'\\[SECRET_' in match.group(1)):
                continue
            if kind == 'private-key' and b'FAKE' in value:
                continue
            issues.append({'file': name, 'type': kind, 'offset': match.start()})
    if name.endswith('customer-test-logs/SKILL.md') and b'{{HELPER_INVOCATION}}' not in data:
        issues.append({'file': name, 'type': 'rendered-personal-skill'})
    return issues

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', action='append', default=[], help='ZIP package to inspect, in addition to tracked source')
    parser.add_argument('--runtime', help='Original unmodified Node executable for runtime-attribution comparison')
    args = parser.parse_args()
    runtime = Path(args.runtime).read_bytes() if args.runtime else b''
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    issues = []; count = 0
    for name in filter(None, files):
        target = ROOT / name
        if target.is_file():
            count += 1; issues.extend(scan(name, target.read_bytes()))
    for path in args.artifact:
        with zipfile.ZipFile(path) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                count += 1
                issues.extend(scan(Path(path).name + '/' + member.filename, archive.read(member), runtime))
    print(json.dumps({'checked_files': count, 'passed': not issues, 'issues': issues, 'limits': 'Pattern/file guard, not a guarantee. Review screenshots and business secrets separately; archive checks need the original runtime.'}, ensure_ascii=False))
    return int(bool(issues))

if __name__ == '__main__':
    sys.exit(main())
