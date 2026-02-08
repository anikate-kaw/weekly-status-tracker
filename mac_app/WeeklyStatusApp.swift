import AppKit
import WebKit
import Foundation

@main
final class WeeklyStatusApp: NSObject, NSApplicationDelegate {
    private static var retainedDelegate: WeeklyStatusApp?

    static func main() {
        let app = NSApplication.shared
        let delegate = WeeklyStatusApp()
        retainedDelegate = delegate
        app.delegate = delegate
        app.run()
    }

    private let serverController = ServerController()

    private var window: NSWindow!
    private var webView: WKWebView!
    private var errorContainer: NSView!
    private var errorLabel: NSTextField!
    private var retryButton: NSButton!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildWindow()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        bootApplication()
    }

    func applicationWillTerminate(_ notification: Notification) {
        serverController.appWillTerminate()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func buildWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1360, height: 860)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = AppConfig.appName
        window.minSize = NSSize(width: 980, height: 640)

        let root = NSView(frame: rect)
        window.contentView = root

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(webView)

        errorContainer = NSView()
        errorContainer.translatesAutoresizingMaskIntoConstraints = false
        errorContainer.wantsLayer = true
        errorContainer.layer?.backgroundColor = NSColor(calibratedWhite: 0.09, alpha: 0.96).cgColor
        errorContainer.layer?.cornerRadius = 18
        errorContainer.isHidden = true
        root.addSubview(errorContainer)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 12
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false

        let title = NSTextField(labelWithString: "Unable to open Weekly Status Tracker")
        title.font = NSFont.boldSystemFont(ofSize: 20)
        title.textColor = NSColor(calibratedWhite: 0.95, alpha: 1)

        errorLabel = NSTextField(wrappingLabelWithString: "")
        errorLabel.font = NSFont.systemFont(ofSize: 13)
        errorLabel.textColor = NSColor(calibratedWhite: 0.82, alpha: 1)

        retryButton = NSButton(title: "Retry", target: self, action: #selector(retryBoot))
        retryButton.bezelStyle = .rounded

        stack.addArrangedSubview(title)
        stack.addArrangedSubview(errorLabel)
        stack.addArrangedSubview(retryButton)
        errorContainer.addSubview(stack)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),

            errorContainer.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            errorContainer.centerYAnchor.constraint(equalTo: root.centerYAnchor),
            errorContainer.widthAnchor.constraint(equalToConstant: 620),

            stack.leadingAnchor.constraint(equalTo: errorContainer.leadingAnchor, constant: 18),
            stack.trailingAnchor.constraint(equalTo: errorContainer.trailingAnchor, constant: -18),
            stack.topAnchor.constraint(equalTo: errorContainer.topAnchor, constant: 18),
            stack.bottomAnchor.constraint(equalTo: errorContainer.bottomAnchor, constant: -18),
        ])
    }

    @objc
    private func retryBoot() {
        bootApplication()
    }

    private func bootApplication() {
        retryButton.isEnabled = false
        hideError()

        serverController.ensureServerReady { [weak self] result in
            guard let self else { return }
            self.retryButton.isEnabled = true

            switch result {
            case .success:
                self.webView.load(URLRequest(url: AppConfig.baseURL))
            case .failure(let error):
                self.showError(error)
            }
        }
    }

    private func showError(_ error: Error) {
        let detail: String
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            detail = description
        } else {
            detail = error.localizedDescription
        }

        errorLabel.stringValue = "\(detail)\n\nLogs: \(AppConfig.logFileURL.path)"
        errorContainer.isHidden = false
    }

    private func hideError() {
        errorContainer.isHidden = true
        errorLabel.stringValue = ""
    }
}
