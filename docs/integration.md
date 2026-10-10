# Product log integration

Log Buddy0.4 prepares product stdout/stderr before the customer receives a preview link. The product stays in its normal harness/browser/native flow. The viewer owns readers and a local API service, not the product; closing it does not stop the product.

`collect` preserves the original cwd/environment/stdin, forwards stdout/stderr and exit code, and saves original output to a private SQLite archive. Changed hot snapshots are published every150ms. On spawn it selects the capture and presents the native app. `watch` imports an AI-confirmed file read-only from the beginning and follows append/rotation/truncation. `show` re-presents an existing capture. Keep collectors/watchers alive using the harness's existing long-running terminal mechanism.

The viewer checks explicit focus every250ms and the selected snapshot every200ms. Original logs are paged, searched over the full archive and can be located by time. Selection pauses DOM replacement and defers automatic source switches, while capture continues. Command-C / Ctrl-C on a log selection writes a rule-redacted copy; the button uses the native clipboard bridge. Time-range export is optional and preserves complete intersecting stack records. There is no one-minute recording limit.

The AppKit/WKWebView app has normal Dock/menu/close/reopen behavior. Closing a window leaves the app running; quitting ends only its own viewer service. Update into a fresh bundle and atomically rename it, never overwrite a running executable in place.

One-time installation renders the actual helper argv into `~/.agents/skills/customer-test-logs`. App startup refreshes only its own managed Skill after relocation. Unrelated same-name Skills are not overwritten. No global AGENTS, harness approval policy or security setting is changed. This is model guidance: real automatic selection in fresh Codex/DeepSeek Harness sessions requires acceptance, not a claim of a universal link-click hook.

Existing confirmed files accept .log/.txt/.jsonl/.ndjson/.out. Their source is never written. Timezone-bearing ISO timestamps and stack continuations are preserved; other lines use read time. Unsaved terminal history, browser-console-only messages, interactive TTY apps and remote logs cannot be recovered by this adapter.

The optional Safari foreground adapter remains disabled and is not needed for ordinary handoffs. Its local port association requires one unique registered capture and refuses ambiguity; it cannot create missing output. See the privacy notes before considering additional permissions.
