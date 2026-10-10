# 客户如何接入自己的 LLM

[English](llm-setup.md) · [返回产品说明](README.zh-CN.md)

**Log Buddy 不需要模型账号或 API Key。** 它没有内置 LLM 客户端，不提供作者账号、共享密钥或模型额度，也不自动上传日志。模型在你自己的 Codex / DeepSeek Harness 中配置；日志助手负责本地采集和复制时脱敏。

## 使用 Codex

1. 打开你自己的 Codex 客户端，按照正常登录流程，用自己的 ChatGPT 账号完成浏览器登录。已经可以正常让 AI 写程序，就保持现有配置。
2. 如果选择 API 方式，在自己的 [OpenAI Platform](https://platform.openai.com/api-keys) 创建密钥，再按 [Codex 官方认证说明](https://developers.openai.com/codex/auth) 在客户端配置。API 调用费用由你的 Platform 账号承担，与 ChatGPT 套餐额度分开。不要把密钥输入 Log Buddy、贴到任务对话或写进启动命令。
3. Log Buddy 中点击一次「开启日志助手」，然后新建本地 Codex 会话，请 AI 在交付产品链接前使用 `customer-test-logs`。安装的 Skill 只含本机助手入口，不含模型凭据。未发现 Skill 时，让 AI 明确检查该 Skill；它是操作指引，不能保证每次自动触发。

## 使用 DeepSeek Harness（dsh）

这里指 [DeepSeek 官方 Harness](https://github.com/deepseek-ai/deepseek-harness)，不是 DeepSeek 聊天网页。

1. 启动你本机的 Harness，打开它的 Web UI。
2. 进入 **Settings → Models（设置 → 模型）**。在自己的 [DeepSeek Platform](https://platform.deepseek.com/) 创建 API Key，填写到 DeepSeek 卡片并保存，然后在会话模型选择器中选择可用模型。模型调用费用归你的账号，Log Buddy 不提供充值额度。
3. 使用其他模型时，选择 **Add model provider**，填写该服务商自己的密钥。使用公司网关或自建服务时，选择 **Custom model API**，在 Harness 中配置自己的地址、匹配的 API 协议和模型 ID。不要复制作者的调用配置。具体参考 [Harness 官方模型配置](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.zh.md)；预览版变化较快，以你安装版本为准。
4. 开启 Log Buddy 后，新建 Harness 会话，请 AI 找到 `customer-test-logs`，在正常启动产品前准备采集。仍需确认当前 Harness 版本实际采用了 Skill。

DeepSeek 官方卡片由 Harness 自己管理并保存凭据，Log Buddy 不读取它的凭据文件。不要把 Harness 的 home/profile、Codex 认证文件或个人环境配置上传 GitHub。

## 测试后如何把问题交给 AI

可以对 AI 说：

> 在给我产品预览链接前，使用 customer-test-logs 准备终端日志，并打开独立日志窗口。保持产品正常窗口和启动方式。已有日志就只读接入，需要重启先询问。不要让我找日志路径，也不要向我要 API Key。

照常测试产品。出错后找到对应时间，拖选有关的多行日志，按 **⌘C / Ctrl+C** 或点击「复制选中 · 脱敏」。检查复制结果，再粘贴给 AI，并说明操作、预期结果和大致出错时间。业务敏感字段可在「还有想遮盖的内容？」里补充。

**只有你决定粘贴后，AI 服务商才会接收到这段文本**，并按它自己的数据政策处理。脱敏无法保证识别所有业务秘密或任意凭据片段；原始终端、历史文件、截图和其他应用的复制内容也不受这项复制功能保护。[隐私与存储边界](privacy.md)。

## 常见问题

- **日志助手哪里填模型密钥？** 不用填，没有这个设置。
- **可以用作者的账号、密码或额度吗？** 不可以；公开包不提供作者凭据或个人模型配置。
- **为了查看日志要再买一个模型套餐吗？** 不需要。模型费用来自你选择的 AI 软件/服务商。
- **AI 能回答，但没有日志？** 模型连接与日志采集是两件事。请 AI 确认采集器或已保存日志来源；没保存的旧输出不能补回。
- **模型认证失败？** 在 AI 软件里修正对应服务商配置，不要向公开反馈附上认证文件或未经检查的原始日志。

以上服务商操作已于 2026-10-10 核对官方文档；界面变化时以链接中的最新版说明为准。
