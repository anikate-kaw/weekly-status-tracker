import Foundation

enum AppConfig {
    static let appName = "Weekly Status Tracker"
    static let appBundleID = "com.anikatek.weekly-status"

    static let configuredProjectDir = "/Users/anikatek/Desktop/personal_projects/weekly-status-tracker"
    static let bundledWebDirName = "web"
    static let serverScriptName = "server.js"
    static let appSupportDirName = "Weekly Status Tracker"

    static let serverPort = 4173

    static let startupPollInterval: TimeInterval = 0.2
    static let startupTimeout: TimeInterval = 10.0
    static let shutdownTimeout: TimeInterval = 2.0

    static let nodeEnvOverrideKey = "WEEKLY_STATUS_NODE_PATH"
    static let defaultPath = "/usr/bin:/bin:/usr/sbin:/sbin"
    static let fallbackPathEntries = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/homebrew/sbin",
        "/usr/local/sbin"
    ]
    static let nodePathCandidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node"
    ]

    static var configuredProjectDirURL: URL {
        URL(fileURLWithPath: configuredProjectDir)
    }

    static var configuredDataFileURL: URL {
        configuredProjectDirURL
            .appendingPathComponent("data", isDirectory: true)
            .appendingPathComponent("weekly-status.json")
    }

    static var bundledWebRootURL: URL? {
        Bundle.main.resourceURL?.appendingPathComponent(bundledWebDirName, isDirectory: true)
    }

    static var runtimeStaticRootURL: URL {
        if let bundled = bundledWebRootURL,
           FileManager.default.fileExists(atPath: bundled.appendingPathComponent("index.html").path) {
            return bundled
        }

        return configuredProjectDirURL
    }

    static var runtimeServerScriptURL: URL {
        let bundledScript = runtimeStaticRootURL.appendingPathComponent(serverScriptName)
        if FileManager.default.fileExists(atPath: bundledScript.path) {
            return bundledScript
        }

        return configuredProjectDirURL.appendingPathComponent(serverScriptName)
    }

    static var runtimeDataDirURL: URL {
        if let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            return appSupport
                .appendingPathComponent(appSupportDirName, isDirectory: true)
                .appendingPathComponent("data", isDirectory: true)
        }

        return runtimeStaticRootURL.appendingPathComponent("data", isDirectory: true)
    }

    static var runtimeDataFileURL: URL {
        runtimeDataDirURL.appendingPathComponent("weekly-status.json")
    }

    static var baseURL: URL {
        URL(string: "http://127.0.0.1:\(serverPort)")!
    }

    static var stateURL: URL {
        baseURL.appendingPathComponent("api/state")
    }

    static var logFileURL: URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("weekly-status-tracker-mac.log")
    }
}
