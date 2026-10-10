# Publication hygiene

Before pushing public source, run `npm run privacy` and `python3 scripts/test-publication.py`. Before uploading an App ZIP, run:

```sh
python3 scripts/check-publication.py --artifact dist/darwin-arm64/Log-Buddy-mac-arm64-v0.4.2.zip --runtime /path/to/unmodified/node
```

Also inspect the portable Skill ZIP, public commit identity/history, release notes and screenshots. The guard reports only file/type/offset, never matched values. It blocks credential/config/runtime filenames, suspicious credentials, personal emails, rendered personal Skills and home-directory paths. Only explicit synthetic samples, upstream Node license attribution and intentional GitHub no-reply identity are exempt; package checks compare inherited strings with the unmodified Node runtime. Do not use a modified runtime to approve a release.

This is a limited pattern guard, not proof that arbitrary secrets cannot leak. Inspect business data and image pixels separately. Never package local records, personal agent home directories, `.env`, credentials, private model gateways, conversation traces or your installed personal Skill. Build the single-executable helper with relative paths; check the final binary as well as source.

The original public history starts from a separate source snapshot, with a GitHub no-reply identity. Keep earlier local private development branches local. Only push reviewed commits from the public history. Do not push all local branches or tags indiscriminately.

If real credentials escape, replace them through their provider and coordinate removal of public copies. Removing a GitHub download cannot retract bytes already downloaded or cached. Never attach the leaked value to an issue or audit report.
