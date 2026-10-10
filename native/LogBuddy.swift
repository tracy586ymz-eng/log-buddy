import AppKit
import WebKit

final class LogBuddyDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var service: Process?
    var output = Data()
    var ready = false
    var terminating = false
    var origin: URL?
    var safariTimer: Timer?
    var safariEnabled = UserDefaults.standard.bool(forKey: "safariFollowEnabled")
    var safariBusy = false
    var safariLastPort: Int?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let item = NSMenuItem(); menu.addItem(item)
        let appMenu = NSMenu(); item.submenu = appMenu
        appMenu.addItem(withTitle: "退出 Log Buddy", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let fileItem = NSMenuItem(); menu.addItem(fileItem)
        let file = NSMenu(title: "文件"); fileItem.submenu = file
        file.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "编辑"); editItem.submenu = edit
        for (title, action, key) in [("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a"), ("剪切", "cut:", "x")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1100, height: 800),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Log Buddy · 测试日志助手"
        window.minSize = NSSize(width: 680, height: 520)
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("LogBuddyWindow")
        let config = WKWebViewConfiguration()
        config.userContentController.addUserScript(WKUserScript(source: "window.logBuddyNative=true;window.logBuddySafariEnabled=\(safariEnabled ? "true" : "false");", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(self, name: "logBuddy")
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        window.contentView = web
        if !window.setFrameUsingName("LogBuddyWindow") { window.center() }
        showWindow()
        startService()
        safariTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self, self.safariEnabled, self.ready, !self.safariBusy,
                  NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Safari" else { return }
            self.readSafari(requestConsent: false)
        }
    }
    func showWindow(activate: Bool = true) {
        window?.deminiaturize(nil)
        if activate { window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
        else { window?.orderFrontRegardless() }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        showWindow(); return false
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func startService() {
        let task = Process()
        task.executableURL = Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/test-log-buddy")
        task.arguments = ["service"]
        task.standardInput = FileHandle.nullDevice
        let pipe = Pipe(); task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            if chunk.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.accept(chunk) }
        }
        task.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, !self.terminating else { return }
                self.ready = false
                self.showError("日志服务已结束。请退出 Log Buddy 后重新打开；产品会继续运行。")
            }
        }
        service = task
        do { try task.run() } catch { showError("日志服务未能启动，请重新打开 App。") }
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
            guard let self = self, !self.ready, !self.terminating else { return }
            self.showError("日志窗口未能启动，请退出后重新打开。")
        }
    }
    func accept(_ chunk: Data) {
        output.append(chunk)
        while let end = output.firstIndex(of: 10) {
            let line = output.prefix(upTo: end); output.removeSubrange(...end)
            guard !ready, let value = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  value["event"] as? String == "ready", let text = value["url"] as? String,
                  let url = URL(string: text), url.host == "127.0.0.1", url.scheme == "http" else { continue }
            ready = true; origin = url
            web.load(URLRequest(url: url))
        }
        if output.count > 65536 { output.removeAll() }
    }
    func showError(_ text: String) {
        let escaped = text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
        web.loadHTMLString("<meta charset='utf-8'><style>body{font:18px system-ui;padding:50px}</style><h1>暂时无法查看日志</h1><p>\(escaped)</p>", baseURL: nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
              url.host == origin?.host, url.port == origin?.port, url.scheme == "http",
              let body = message.body as? [String: Any] else { return }
        if body["action"] as? String == "copy", let text = body["text"] as? String, text.utf8.count <= 64 * 1024 * 1024 {
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
            web.evaluateJavaScript("window.logBuddyCopyDone?.()", completionHandler: nil)
        } else if body["action"] as? String == "quit" { NSApp.terminate(nil) }
        else if body["action"] as? String == "safariFollow" {
            if safariEnabled {
                safariEnabled = false; UserDefaults.standard.set(false, forKey: "safariFollowEnabled")
                notifySafari("已关闭 Safari 自动显示。", enabled: false)
            } else { readSafari(requestConsent: true) }
        }
    }
    func notifySafari(_ text: String, enabled: Bool) {
        guard let data = try? JSONSerialization.data(withJSONObject: [text, enabled]),
              let args = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.logBuddySafariStatus?.(...\(args))", completionHandler: nil)
    }
    func readSafari(requestConsent: Bool) {
        guard !safariBusy, !terminating else { return }
        guard !NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Safari").isEmpty else {
            if requestConsent { notifySafari("请先打开 Safari，再启用自动显示。", enabled: false) }
            return
        }
        safariBusy = true
        // No page contents/history are read. The current URL is transient; only a loopback port leaves this callback.
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let script = NSAppleScript(source: "tell application id \"com.apple.Safari\"\nif (count of windows) is 0 then return \"\"\nreturn URL of current tab of front window\nend tell")
            var error: NSDictionary?
            let result = script?.executeAndReturnError(&error)
            let address = result?.stringValue
            let errorCode = error?[NSAppleScript.errorNumber] as? Int
            DispatchQueue.main.async {
                guard let self = self, !self.terminating else { return }
                self.safariBusy = false
                if error != nil || result == nil {
                    if requestConsent || errorCode == -1743 {
                        self.safariEnabled = false; UserDefaults.standard.set(false, forKey: "safariFollowEnabled")
                        self.notifySafari("Safari 自动显示未开启。需要你在 macOS 提示中允许 Log Buddy 访问 Safari。", enabled: false)
                    }
                    return
                }
                if requestConsent {
                    self.safariEnabled = true; UserDefaults.standard.set(true, forKey: "safariFollowEnabled")
                    self.notifySafari("Safari 自动显示已开启。关闭窗口后，打开已接入的本机产品页面即可恢复日志窗口。", enabled: true)
                }
                guard let text = address, let url = URL(string: text),
                      ["http", "https"].contains(url.scheme ?? ""),
                      ["localhost", "127.0.0.1", "::1", "[::1]"].contains(url.host?.lowercased() ?? "") else {
                    self.safariLastPort = nil; return
                }
                let port = url.port ?? (url.scheme == "https" ? 443 : 80)
                if self.safariLastPort == port && self.window.isVisible { return }
                self.focusSafariPort(port)
            }
        }
    }
    func focusSafariPort(_ port: Int) {
        guard let origin = origin, var parts = URLComponents(url: origin, resolvingAgainstBaseURL: false),
              let token = parts.fragment else { return }
        parts.path = "/api/focus-port"; parts.fragment = nil
        guard let url = parts.url else { return }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.timeoutInterval = 2
        request.setValue(token, forHTTPHeaderField: "X-Test-Log-Token")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["port": port])
        safariBusy = true
        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            let value = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            DispatchQueue.main.async {
                guard let self = self, !self.terminating else { return }
                self.safariBusy = false
                if value?["matched"] as? Bool == true {
                    self.safariLastPort = port; self.showWindow(activate: false)
                } else {
                    if self.safariLastPort != port { self.notifySafari("当前 Safari 产品尚未接入日志，请让 AI 帮你接好采集。", enabled: true) }
                    self.safariLastPort = port
                }
            }
        }.resume()
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.host == origin?.host && url.port == origin?.port && url.scheme == "http" { decisionHandler(.allow) }
        else { decisionHandler(.cancel) }
    }
    func applicationWillTerminate(_ notification: Notification) {
        terminating = true
        safariTimer?.invalidate()
        if service?.isRunning == true { service?.terminate() }
    }
}
let app = NSApplication.shared
let delegate = LogBuddyDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
