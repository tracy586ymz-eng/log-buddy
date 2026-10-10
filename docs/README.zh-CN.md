# Log Buddy · 客户测试日志助手

**AI写好了产品，你在测试中发现Bug：选中对应日志，安全复制给AI。**

[下载Mac App](https://github.com/tracy586ymz-eng/log-buddy/releases/download/v0.4.0/Log-Buddy-mac-arm64-v0.4.0.zip) · [版本说明](https://github.com/tracy586ymz-eng/log-buddy/releases/tag/v0.4.0) · [English](../README.md) · [反馈问题](https://github.com/tracy586ymz-eng/log-buddy/issues/new/choose)

![实际App，全部演示数据为虚构](assets/app-screenshot.png)

你照常在原网页、浏览器、弹窗或原生窗口测试。Log Buddy在旁边显示产品终端日志，不要求你开IDE、找日志文件或把产品搬进它的窗口。

## 使用

1. 下载并解压一次，把Log Buddy.app放入“应用程序”。打开后点击「开启日志助手」一次。
2. 新Codex / DeepSeek Harness会话发现共享Skill后，由AI准备产品正常启动的终端日志或只读接入已确认的现有文件。
3. 保持原产品界面测试。出错时拖选多行，按⌘C / Ctrl+C，或点「复制选中 · 脱敏」，自行粘贴给AI。

查看的是原文，脱敏的是复制结果。错误和堆栈保留，原始记录不改；选中文字时画面暂停，后台继续记录。

完整历史留本机，没有一分钟或总条数淘汰；可搜索全部历史、载入早期日志、按时间定位，实际总量受磁盘容量限制。「最近1分钟」只是可选的复制范围。

## 首版范围

- 已验证Apple Silicon Mac、macOS 13+；当前App界面中文，英文文档已提供。
- App自带运行环境，无需另外安装Node或Swift；原产品仍需它自己的依赖。
- 首版是公开预览，ad-hoc签名、尚未Apple公证。其他Mac可能阻止正常打开；保留正常系统保护。Windows / Intel Mac安装包尚未提供。
- Skill是AI操作指引，两个harness的新会话稳定自动采用仍需更多真实验收；不能承诺任意点一个链接就接入所有程序。
- 已有日志可以只读接入；未保存的输出不能补回，重启应先得到允许。浏览器console、交互TTY和远程日志需其他适配器。

## 隐私

原始记录仅保存在本机私有应用数据目录，不上传、不自动发给AI。复制时遮盖常见密钥、密码、邮箱、IP、个人路径；业务秘密和任意凭据片段不能保证识别，必要时补充遮盖项并检查副本。

[隐私说明](privacy.md) · [采集机制](integration.md) · [参与改进](../CONTRIBUTING.md)

如果它让你少折腾一次终端，欢迎给项目点⭐，帮助更多用AI开发产品的人找到它。反馈请只附脱敏内容。
