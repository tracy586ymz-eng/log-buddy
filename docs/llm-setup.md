# Use your own AI account

[中文](llm-setup.zh-CN.md) · [Back to Log Buddy](../README.md)

**Log Buddy needs no LLM account or API key.** It has no model client, shared developer key, telemetry or automatic log upload. Connect your model in your own coding agent; Log Buddy only collects product output locally and redacts the text you copy.

## Codex

1. Open your Codex client and sign in with your own ChatGPT account using its normal browser sign-in. If it already works, keep your existing setup.
2. If you choose API access instead, obtain your own key from the [OpenAI Platform](https://platform.openai.com/api-keys) and configure it in the Codex client using the [official authentication guide](https://developers.openai.com/codex/auth). API usage is billed separately to your Platform account. Never enter the key in Log Buddy or paste it into a task, GitHub issue or launch command.
3. Enable Log Buddy once, start a fresh local Codex conversation, and ask it to use `customer-test-logs` before handing over the product preview. The installed Skill contains a local helper path, not model credentials. If discovery fails, ask the agent to check that Skill explicitly; guidance is not a guaranteed launch hook.

## DeepSeek Harness (dsh)

This means the [official DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), not the DeepSeek chat website.

1. Start your own locally installed Harness and open its Web UI.
2. Open **Settings → Models**. Obtain your own API key from the [DeepSeek Platform](https://platform.deepseek.com/), enter it on the DeepSeek card and save. Choose an available configured model in the session picker. API usage belongs to your account; Log Buddy does not provide credits.
3. For another provider, use **Add model provider** and the provider's own key. For a private gateway, choose **Custom model API** and enter its endpoint, matching API protocol and model ID in Harness. Do not copy a maintainer's configuration. Follow the [official model configuration guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md); this preview changes quickly and your version's labels may differ.
4. Enable Log Buddy and start a new Harness session. Ask it to locate `customer-test-logs` and prepare collection before normal product launch. Actual Skill adoption must be verified in your Harness version.

The official DeepSeek card manages credentials in Harness's own local credential store. Log Buddy does not read that store. Never publish Harness home/profile files or Codex authentication files.

## Test, copy, then ask for a fix

Ask your agent:

> Use customer-test-logs to prepare the product's terminal output before showing me the preview. Keep the product in its normal window. Reuse a confirmed existing log if available; ask before restarting. Do not ask me for log paths or API keys.

Test normally. Locate the failure time, select the relevant lines, and press ⌘C / Ctrl+C or **复制选中 · 脱敏**. Inspect the copied result before pasting it into your agent; add sensitive business identifiers under **还有想遮盖的内容？** when needed. Include the action you took, expected result and approximate failure time.

**Pasting is your choice.** Once you paste, the selected agent/model provider receives that text under its own data policies. Copy redaction is best effort; it does not sanitize your original terminal, history files, screenshots or other apps' clipboard content. Business secrets and arbitrary partial values can escape detection. [Privacy and storage boundaries](privacy.md).

## Common questions

- **Where do I enter a model key in Log Buddy?** Nowhere; it has no model settings.
- **Can I use the author's account or key?** No account, live key, personal configuration or model credit is distributed.
- **Do I need a second model subscription for the viewer?** No. Model charges come only from your chosen agent/provider and its plan.
- **The agent can answer but there are no logs.** Model access and product-log collection are separate. Ask it to confirm a collector or existing log source. Unsaved old output cannot be recovered.
- **Authentication failed.** Fix the selected provider in the coding agent. Do not attach credential files or raw diagnostic logs to public issues.

Provider instructions checked against official documentation on 2026-10-10. Follow the linked documentation when provider interfaces change.
