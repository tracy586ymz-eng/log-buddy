---
name: customer-test-logs
description: Automatically prepare live product logs with redacted copying whenever launching an AI-built local product for the customer to test or handing over its preview link. Preserve the normal browser or native product window; use Log Buddy beside it. Applies across Codex and DeepSeek Harness projects.
---

# Prepare customer test logs before handoff

The customer personally tests the AI-built product. Capture the product's terminal stdout/stderr, not the AI transcript and not autonomous test output. The customer should not find log files, select a capture, or start the product from Log Buddy.

Installed helper argv: `{{HELPER_INVOCATION}}`

Use that argv prefix for the commands below. If it is unresolved, locate the installed Log Buddy app and its Contents/MacOS/test-log-buddy helper. Never guess an unrelated executable.

## At the normal authorized product launch

Wrap the original launch argv in the original harness terminal:

    <helper> collect --cwd <original-project-directory> --name <product-name> -- <original-program> <original-arguments>

Keep the same working directory, environment, product dependencies and harness execution mode. The collector forwards terminal output, saves original output in private local full-history storage without a time limit, automatically opens the independent native log window and selects this capture. Do not use --no-open for a customer handoff. Keep the collector alive through the harness's existing long-running terminal mechanism.

Then open or provide the original product URL exactly as usual: built-in preview, clickable localhost link, Safari, another browser, or native window. Do not embed/proxy the product, change its URL, change the default browser, create per-product launcher/config, or modify source to make logging work.

The helper detects localhost port numbers from startup output. If the port is known but the product does not print its local URL, pass --port <confirmed-local-port> to collect or watch to associate the registered product with its confirmed port. Store no query strings or remote addresses. The main launch flow needs no Safari automation permission. Optional Safari foreground matching is disabled; do not enable it or grant permission without an explicit request.

Before handing over the product, check <helper> sources for the matching running capture and output. Verify actual GUI visibility when tools allow; otherwise say capture is ready and visibility unverified. Startup and navigation are separate channels; a Skill is model guidance, not an OS-wide link-click listener or guaranteed lifecycle hook.

## If the product is already running

First reuse a matching capture from sources using <helper> show --id <confirmed-capture-id>, which reopens the native window and selects it. If it writes an existing log file, locate that file yourself using the product's documented launch/log settings and actual running process evidence. Connect without asking the customer for paths:

    <helper> watch --file <confirmed-existing-log-file> --name <product-name>

watch is read-only and automatically opens/selects its record. Keep it alive independently. Never import AI chat/harness session files as product logs. Don't scan unrelated user files or choose a file merely because its name looks like a log.

If the output is only in a terminal pipe with no reusable saved source, explain that historical output cannot be reconstructed. Ask whether to restart the specific process you own; preserve the customer's test state. Once authorized, restart with collect using the same launch command. Never stop unrelated products.

## Operation and boundaries

The customer tests in the original product and views original logs. They drag-select multiple log lines and press normal Command-C / Ctrl-C, or use Copy selected. Only the copied text is rule-redacted, with errors and stack traces preserved; originals stay unchanged. Selection freezes rendering while capture continues. Full history can be searched, paged and located by time. Time-range export is optional, not a one-minute recording limit. The helper never sends logs to the model. Closing or reopening the viewer does not stop the product. Multiple products remain separate; the latest explicitly prepared capture becomes active, with optional switching by product name.

Captures use output receipt time. Files use explicit timezone-bearing ISO time where available; remaining lines use read time. Browser-only console errors, unsaved historical output, interactive TTY programs and remotely hosted server logs are outside this terminal adapter. Do not advertise automatic capture of every already-running program or browser console.

Rule redaction is assistance, not a guarantee of detecting all business secrets. Let the customer inspect the copied result and add business identifiers when needed. Original history stays in private local app data, not cloud storage. Never put raw logs, credentials or history databases in Git, export packages, backups or long-term memory. Do not automatically paste or transmit them to the model.
