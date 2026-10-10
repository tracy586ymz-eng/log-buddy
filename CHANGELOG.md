# Changelog

## 0.4.2

- Remove the local absolute build path embedded in the single-executable helper by preparing its bundle with relative paths.
- Add publication checks for personal configuration, runtime records, credential patterns and local build paths.
- Explain customer-owned Codex / DeepSeek Harness model setup in English and Chinese; no LLM key is needed by Log Buddy.


## 0.4.1 — Mac compatibility fix

- Explicitly compile the native shell for macOS13.5 instead of inheriting the build machine's macOS26 target.
- Match the app's declared minimum to the embedded Node runtime (macOS13.5).
- Add a native compilation/deployment-target check to public CI.

Version0.4.0's earlier macOS13 claim was incorrect: its native shell required macOS26. Use0.4.1 for the corrected deployment target. Builds remain ad-hoc signed and not Apple-notarized; older OS runtime acceptance is still broader testing work.

## 0.4.0 — Public preview

- Full private local history, independent of the bounded rendering page.
- Original log display; native/keyboard copies redact only selected text.
- Selection freezes the view while background recording continues.
- Full-history search, older pages, time lookup and optional range export.
- Existing files imported from the beginning; final unterminated lines saved on stop/rotation.
- Managed shared Skill for agent-prepared normal product launches.
- Apple Silicon Mac package with embedded runtime; no user Node/Swift install.

Verified locally:20 core/integration checks, native selection and copying, packaged SQLite. Fresh model-selected Codex/DeepSeek handoffs, broader platform packages and Apple notarization remain pending acceptance.
