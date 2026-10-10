# Privacy and data handling

Log Buddy records product stdout/stderr or a confirmed existing text log, not AI conversations. It displays originals and redacts copied text locally. The app makes no model API calls, sends no telemetry and never automatically posts logs to an agent.

On macOS, runtime history is in `~/Library/Application Support/Log Buddy/records`. Owned directories use mode0700 and records0600. SQLite retains history without a duration/total-row eviction; only the hot snapshot and rendering page are bounded. Disk capacity is finite. Do not include these files in public issues, source packages, project backups or shared screenshots.

The local viewer binds to loopback, uses random tokens and checks Host/Origin. Text is rendered without interpreting product output as HTML. It cannot launch/open a product. The native clipboard bridge accepts only its own local main frame.

The collector keeps the original terminal output available to its caller; that original terminal output is not redacted. Copied log selections use shared local rules and optional literal business identifiers. The selection's displayed context can help mask a complete value without its field label; arbitrary partial values/business secrets cannot be guaranteed. Screenshots of real original logs are not protected by copy redaction.

Metadata includes product name, status, collector PID and loopback port numbers. Full argv/environment and URL query strings are not dumped. File reads do not change source files. Captures use receipt time; files parse explicit timezone-bearing ISO timestamps when present.

The main flow does not require Safari Automation permission. The optional foreground Safari adapter is disabled. Its dormant code matches a transient loopback port; it does not save browsing history. Do not enable extra permissions for the basic workflow.

Never paste live credentials or personal runtime logs into an issue. Use fictional reproduction values and a redacted excerpt. If a secret was exposed outside your machine, use its provider's normal process to replace it.
