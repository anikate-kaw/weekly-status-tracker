import Foundation

final class ServerController {
    enum ServerError: LocalizedError {
        case nodeBinaryNotFound
        case unableToStartNode(String)
        case waitTimedOut(URL)
        case portInUse(Int)

        var errorDescription: String? {
            switch self {
            case .nodeBinaryNotFound:
                return "Node.js was not found. Install Node or set \(AppConfig.nodeEnvOverrideKey) to your node binary path."
            case .unableToStartNode(let reason):
                return "Unable to start Node server. \(reason)"
            case .waitTimedOut(let url):
                return "Timed out waiting for server at \(url.absoluteString)."
            case .portInUse(let port):
                return "Port \(port) is already in use by another process. Close that process and retry."
            }
        }
    }

    private(set) var ownedByApp = false

    private var serverProcess: Process?
    private var logHandle: FileHandle?
    private let queue = DispatchQueue(label: "weekly-status.server.controller", qos: .userInitiated)

    func ensureServerReady(completion: @escaping (Result<Void, Error>) -> Void) {
        queue.async {
            if self.isServerReachable() {
                self.ownedByApp = false
                DispatchQueue.main.async {
                    completion(.success(()))
                }
                return
            }

            if self.isPortInUse() {
                DispatchQueue.main.async {
                    completion(.failure(ServerError.portInUse(AppConfig.serverPort)))
                }
                return
            }

            do {
                try self.startServerProcess()
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
                return
            }

            if self.waitForServerReady(until: Date().addingTimeInterval(AppConfig.startupTimeout)) {
                DispatchQueue.main.async {
                    completion(.success(()))
                }
            } else {
                let error: Error
                if self.ownedByApp, let process = self.serverProcess, !process.isRunning {
                    error = ServerError.unableToStartNode("Node process exited before server was ready. See log: \(AppConfig.logFileURL.path)")
                } else {
                    error = ServerError.waitTimedOut(AppConfig.stateURL)
                }

                self.stopOwnedServerIfNeeded()
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }

    func appWillTerminate() {
        queue.sync {
            self.stopOwnedServerIfNeeded()
        }
    }

    private func startServerProcess() throws {
        if let process = serverProcess, process.isRunning {
            return
        }

        guard let nodeExecutable = resolveNodeExecutable() else {
            throw ServerError.nodeBinaryNotFound
        }

        let staticRoot = AppConfig.runtimeStaticRootURL
        let serverScript = AppConfig.runtimeServerScriptURL
        let dataDir = AppConfig.runtimeDataDirURL

        do {
            try FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)
        } catch {
            throw ServerError.unableToStartNode("Cannot create data directory at \(dataDir.path): \(error.localizedDescription)")
        }

        migrateLegacyDataIfNeeded()

        let process = Process()
        process.currentDirectoryURL = staticRoot
        process.executableURL = URL(fileURLWithPath: nodeExecutable)
        process.arguments = [serverScript.path]

        var env = mergedEnvironment()
        env["WEEKLY_STATUS_STATIC_ROOT"] = staticRoot.path
        env["WEEKLY_STATUS_DATA_DIR"] = dataDir.path
        process.environment = env

        do {
            let logURL = AppConfig.logFileURL
            if !FileManager.default.fileExists(atPath: logURL.path) {
                _ = FileManager.default.createFile(atPath: logURL.path, contents: Data())
            }

            let handle = try FileHandle(forWritingTo: logURL)
            handle.seekToEndOfFile()

            process.standardOutput = handle
            process.standardError = handle

            try process.run()

            // If node fails immediately (e.g. script/config error), return a direct error.
            Thread.sleep(forTimeInterval: 0.2)
            if !process.isRunning && !isServerReachable() {
                try? handle.close()
                throw ServerError.unableToStartNode("Node exited immediately. See log: \(AppConfig.logFileURL.path)")
            }

            self.serverProcess = process
            self.logHandle = handle
            self.ownedByApp = true
        } catch {
            throw ServerError.unableToStartNode("\(error.localizedDescription). See log: \(AppConfig.logFileURL.path)")
        }
    }

    private func migrateLegacyDataIfNeeded() {
        let fileManager = FileManager.default
        let targetFile = AppConfig.runtimeDataFileURL

        guard !fileManager.fileExists(atPath: targetFile.path) else {
            return
        }

        let legacyFile = AppConfig.configuredDataFileURL
        guard fileManager.fileExists(atPath: legacyFile.path) else {
            return
        }

        do {
            try fileManager.copyItem(at: legacyFile, to: targetFile)
        } catch {
            // Non-fatal: app will initialize a fresh state file if copy fails.
        }
    }

    private func stopOwnedServerIfNeeded() {
        guard ownedByApp else { return }

        if let process = serverProcess, process.isRunning {
            process.terminate()

            let deadline = Date().addingTimeInterval(AppConfig.shutdownTimeout)
            while process.isRunning && Date() < deadline {
                Thread.sleep(forTimeInterval: 0.05)
            }

            if process.isRunning {
                process.interrupt()
            }
        }

        try? logHandle?.close()
        logHandle = nil
        serverProcess = nil
        ownedByApp = false
    }

    private func waitForServerReady(until deadline: Date) -> Bool {
        while Date() < deadline {
            if isServerReachable() {
                return true
            }
            Thread.sleep(forTimeInterval: AppConfig.startupPollInterval)
        }
        return false
    }

    private func resolveNodeExecutable() -> String? {
        if let override = ProcessInfo.processInfo.environment[AppConfig.nodeEnvOverrideKey], isExecutableFile(override) {
            return override
        }

        for candidate in AppConfig.nodePathCandidates where isExecutableFile(candidate) {
            return candidate
        }

        if let fromShell = discoverNodeViaLoginShell(), isExecutableFile(fromShell) {
            return fromShell
        }

        if let fromWhich = discoverNodeViaWhich(), isExecutableFile(fromWhich) {
            return fromWhich
        }

        return nil
    }

    private func discoverNodeViaLoginShell() -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", "command -v node"]
        process.environment = mergedEnvironment()

        let out = Pipe()
        process.standardOutput = out
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
            guard process.terminationStatus == 0 else { return nil }
            let data = out.fileHandleForReading.readDataToEndOfFile()
            let path = String(decoding: data, as: UTF8.self)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return path.isEmpty ? nil : path
        } catch {
            return nil
        }
    }

    private func discoverNodeViaWhich() -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        process.arguments = ["node"]
        process.environment = mergedEnvironment()

        let out = Pipe()
        process.standardOutput = out
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
            guard process.terminationStatus == 0 else { return nil }
            let data = out.fileHandleForReading.readDataToEndOfFile()
            let path = String(decoding: data, as: UTF8.self)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return path.isEmpty ? nil : path
        } catch {
            return nil
        }
    }

    private func mergedEnvironment() -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        let currentPath = env["PATH"] ?? AppConfig.defaultPath
        var pathEntries = currentPath
            .split(separator: ":")
            .map(String.init)

        for entry in AppConfig.fallbackPathEntries where !pathEntries.contains(entry) {
            pathEntries.append(entry)
        }

        env["PATH"] = pathEntries.joined(separator: ":")
        return env
    }

    private func isExecutableFile(_ path: String) -> Bool {
        FileManager.default.isExecutableFile(atPath: path)
    }

    private func isPortInUse() -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        process.arguments = ["-nP", "-iTCP:\(AppConfig.serverPort)", "-sTCP:LISTEN"]
        process.standardOutput = Pipe()
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }

    private func isServerReachable() -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
        process.arguments = [
            "--silent",
            "--max-time", "1",
            "--output", "/dev/null",
            "--write-out", "%{http_code}",
            AppConfig.stateURL.absoluteString,
        ]
        process.environment = mergedEnvironment()

        let out = Pipe()
        process.standardOutput = out
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
            guard process.terminationStatus == 0 else { return false }

            let data = out.fileHandleForReading.readDataToEndOfFile()
            let code = String(decoding: data, as: UTF8.self)
                .trimmingCharacters(in: .whitespacesAndNewlines)

            return code.hasPrefix("2")
        } catch {
            return false
        }
    }
}
