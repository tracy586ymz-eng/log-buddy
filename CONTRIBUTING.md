# Contributing

Start with a small reproduction: OS/architecture, harness version, original product type and the step that failed. Attach fictional data or already-redacted excerpts only. Do not attach raw history databases, .env, tokens or private screenshots.

Source needs Node>=22.13. Run `npm ci` and `npm test`. Native Mac builds additionally need Swift and `npm run build`. Keep work in a focused branch. Add meaningful tests for changes to capture/history/redaction/process boundaries; UI wording changes do not need implementation-mirroring tests.

Preserve the original product window, argv/cwd/environment and customer control of restarts. Never add telemetry or automatic log sending. Be explicit about platform and harness behavior you actually verified.

Good first directions: reproducible handoff failures, multi-service grouping, English UI, accessible selection/copy and signed distribution. Please discuss large scope changes in an issue before implementation.
