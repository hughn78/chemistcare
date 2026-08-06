#!/usr/bin/env node
// Downloads ONLY the sherpa-onnx speaker-diarization binary (+ shared libs).
// Trimmed from OpenWhispr scripts/download-sherpa-onnx.js (MIT) — the ASR
// websocket-server binaries are not ported; whisper.cpp handles ASR here.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  downloadFile,
  findBinaryInDir,
  parseArgs,
  setExecutable,
} = require("./lib/download-utils");

const SHERPA_ONNX_VERSION = "1.13.4";
const GITHUB_RELEASE_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${SHERPA_ONNX_VERSION}`;

// macOS uses universal2 builds that work on both arm64 and x64.
const BINARIES = {
  "darwin-arm64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-osx-universal2-shared.tar.bz2`,
    diarizeBinaryPath: "sherpa-onnx-offline-speaker-diarization",
    diarizeOutputName: "sherpa-onnx-diarize-darwin-arm64",
    libPattern: "*.dylib",
  },
  "darwin-x64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-osx-universal2-shared.tar.bz2`,
    diarizeBinaryPath: "sherpa-onnx-offline-speaker-diarization",
    diarizeOutputName: "sherpa-onnx-diarize-darwin-x64",
    libPattern: "*.dylib",
  },
  "win32-x64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-win-x64-shared-MD-Release.tar.bz2`,
    diarizeBinaryPath: "sherpa-onnx-offline-speaker-diarization.exe",
    diarizeOutputName: "sherpa-onnx-diarize-win32-x64.exe",
    libPattern: "*.dll",
  },
  "linux-x64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-linux-x64-shared.tar.bz2`,
    diarizeBinaryPath: "sherpa-onnx-offline-speaker-diarization",
    diarizeOutputName: "sherpa-onnx-diarize-linux-x64",
    libPattern: "*.so*",
  },
};

const BIN_DIR = path.join(__dirname, "..", "..", "resources", "bin");

// Upstream 1.13.4 ships an invalid arm64 signature on libonnxruntime; dyld SIGKILLs unsigned loads.
function adhocSign(filePath, platformArch) {
  if (process.platform !== "darwin" || !platformArch.startsWith("darwin")) return;
  try {
    execFileSync("codesign", ["--force", "--sign", "-", filePath], { stdio: "ignore" });
  } catch {
    // unsigned dev machines: best effort
  }
}

function extractTarBz2(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  // Relative paths from archive dir as cwd, so neither -f nor -C args contain
  // Windows drive letter colons (GNU tar treats C: as remote host).
  const cwd = path.dirname(archivePath);
  execFileSync("tar", ["-xjf", path.basename(archivePath), "-C", path.relative(cwd, destDir)], {
    stdio: "inherit",
    cwd,
  });
}

function findLibrariesInDir(dir, pattern, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findLibrariesInDir(fullPath, pattern, maxDepth, currentDepth + 1));
      } else if (matchesPattern(entry.name, pattern)) {
        results.push(fullPath);
      }
    }
  } catch {
    // permission errors: skip
  }
  return results;
}

function matchesPattern(filename, pattern) {
  if (pattern === "*.dylib") return filename.endsWith(".dylib");
  if (pattern === "*.dll") return filename.endsWith(".dll");
  if (pattern === "*.so*") return /\.so(\.\d+)*$/.test(filename) || filename.endsWith(".so");
  return false;
}

async function downloadBinary(platformArch, config, isForce = false) {
  if (!config) {
    console.log(`  ${platformArch}: Not supported`);
    return false;
  }

  const diarizeOutputPath = path.join(BIN_DIR, config.diarizeOutputName);

  if (!isForce && fs.existsSync(diarizeOutputPath)) {
    console.log(`  ${platformArch}: Already exists (use --force to re-download)`);
    return true;
  }

  const url = `${GITHUB_RELEASE_URL}/${config.archiveName}`;
  console.log(`  ${platformArch}: Downloading from ${url}`);

  const archivePath = path.join(BIN_DIR, config.archiveName);
  const extractDir = path.join(BIN_DIR, `temp-sherpa-diarize-${platformArch}`);

  try {
    await downloadFile(url, archivePath);
    extractTarBz2(archivePath, extractDir);

    const foundPath = findBinaryInDir(extractDir, config.diarizeBinaryPath);
    if (!foundPath || !fs.existsSync(foundPath)) {
      console.error(`  ${platformArch}: Binary '${config.diarizeBinaryPath}' not found in archive`);
      return false;
    }
    fs.rmSync(diarizeOutputPath, { force: true });
    fs.copyFileSync(foundPath, diarizeOutputPath);
    setExecutable(diarizeOutputPath);
    adhocSign(diarizeOutputPath, platformArch);
    console.log(`  ${platformArch}: Extracted to ${config.diarizeOutputName}`);

    // Copy shared libraries the diarize binary links against.
    if (config.libPattern) {
      for (const libPath of findLibrariesInDir(extractDir, config.libPattern)) {
        const libName = path.basename(libPath);
        const destPath = path.join(BIN_DIR, libName);
        fs.rmSync(destPath, { force: true });
        fs.copyFileSync(libPath, destPath);
        setExecutable(destPath);
        adhocSign(destPath, platformArch);
        console.log(`  ${platformArch}: Copied library ${libName}`);
      }
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    return true;
  } catch (error) {
    console.error(`  ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    return false;
  }
}

async function main() {
  console.log(`\n[diarization-binary] sherpa-onnx v${SHERPA_ONNX_VERSION}\n`);
  fs.mkdirSync(BIN_DIR, { recursive: true });

  const args = parseArgs();

  if (args.isCurrent) {
    if (!BINARIES[args.platformArch]) {
      console.error(`Unsupported platform/arch: ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }
    const ok = await downloadBinary(args.platformArch, BINARIES[args.platformArch], args.isForce);
    if (!ok) {
      console.error(`Failed to download diarization binary for ${args.platformArch}`);
      process.exitCode = 1;
    }
  } else {
    console.log("Downloading diarization binaries for all platforms:");
    for (const platformArch of Object.keys(BINARIES)) {
      await downloadBinary(platformArch, BINARIES[platformArch], args.isForce);
    }
  }
}

main().catch(console.error);
