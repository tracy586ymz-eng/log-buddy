# Public preview privacy review · 0.4.2

Reviewed 2026-10-10. This is a scoped review, not a guarantee against every possible secret.

- Inspected both initial public commits and their unique source blobs, commit identity, release notes, App ZIPs and portable Skill ZIPs for 0.4.0/0.4.1, plus the new 0.4.2 build.
- Compared privately configured authentication/contact/provider values locally without printing or saving those values. No matches found in the inspected public source or packages.
- No maintainer's live model key, password, private email, personal model configuration or runtime log was identified. Credential-like runtime matches also occur in the unmodified Node executable; source test samples and screenshot values are fictional. Required dependency license attribution remains.
- Found an absolute build path in earlier helper binaries. Version0.4.2 prepares its single-executable bundle using relative paths; the final App/Skill package checks pass without that local path.
- Added public-source CI checks and regression tests rejecting private config/runtime files, generated credentials, private contact data and personal build paths. Review images and business secrets separately.
- The packaged helper passed capture/reopen/full-history/search/copied-redaction/access-control checks without an external Node executable. Twenty product checks and four publication-guard tests pass locally.

Log Buddy has no LLM client or account/key settings. Users configure their own coding agent and manually paste reviewed copied text. See [model setup](llm-setup.md) and [privacy limits](privacy.md). Use the current release; earlier versions are superseded. Removal of an old asset does not retract downloaded/cached copies.
