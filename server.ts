import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import AppInfoParser from "app-info-parser";
import { createServer as createViteServer } from "vite";

// Ensure upload directory and chunk directories exist
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const CHUNKS_DIR = path.join(UPLOADS_DIR, "chunks");
const TEMP_DIR = path.join(UPLOADS_DIR, "temp");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const app = express();
const PORT = 3000;

// Log all requests to a file for diagnostics
app.use((req, res, next) => {
  const logMessage = `[${new Date().toISOString()}] ${req.method} ${req.url} (IP: ${req.ip})\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), "error.log"), logMessage);
  } catch (e) {
    console.error("Failed to write to log file", e);
  }
  next();
});

// Increase payload limits for large IPAs
app.use(express.json({ limit: "1024mb" }));
app.use(express.urlencoded({ limit: "1024mb", extended: true }));

// Serve uploaded files publicly
app.use("/uploads", express.static(UPLOADS_DIR));

// Setup Multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${fileId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit
});

const chunkUpload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per chunk limit is generous
});

// API endpoint for chunked uploads to bypass reverse proxy file size limits
app.post("/api/upload-chunk", chunkUpload.single("chunk"), async (req, res) => {
  try {
    const { fileId, chunkIndex, totalChunks, originalName } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "No chunk uploaded." });
    }

    const index = parseInt(chunkIndex, 10);
    const total = parseInt(totalChunks, 10);

    const fileChunksDir = path.join(CHUNKS_DIR, fileId);
    if (!fs.existsSync(fileChunksDir)) {
      fs.mkdirSync(fileChunksDir, { recursive: true });
    }

    // Move uploaded chunk file to its specific place
    const chunkPath = path.join(fileChunksDir, index.toString());
    
    try {
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
      fs.renameSync(req.file.path, chunkPath);
    } catch (moveErr) {
      // Fallback if rename fails (e.g. cross-device link)
      fs.copyFileSync(req.file.path, chunkPath);
      fs.unlinkSync(req.file.path);
    }

    console.log(`[Chunk Upload] Saved chunk ${index + 1}/${total} for file: ${originalName} (${fileId})`);

    // Check if all chunks have been uploaded
    let allChunksExist = true;
    for (let i = 0; i < total; i++) {
      if (!fs.existsSync(path.join(fileChunksDir, i.toString()))) {
        allChunksExist = false;
        break;
      }
    }

    if (allChunksExist) {
      // Assemble the final file
      const finalFileName = `${fileId}.ipa`;
      const finalFilePath = path.join(UPLOADS_DIR, finalFileName);
      
      console.log(`[Chunk Upload] All ${total} chunks received for ${originalName}. Assembling final file...`);
      
      const writeStream = fs.createWriteStream(finalFilePath);
      
      for (let i = 0; i < total; i++) {
        const chunkFilePath = path.join(fileChunksDir, i.toString());
        const chunkBuffer = fs.readFileSync(chunkFilePath);
        writeStream.write(chunkBuffer);
      }
      writeStream.end();

      // Wait for write stream to finish before proceeding to parse and clean up
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", () => resolve());
        writeStream.on("error", (err) => reject(err));
      });

      console.log(`[Chunk Upload] File assembled successfully: ${finalFilePath}`);

      // Clean up chunks
      try {
        fs.rmSync(fileChunksDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("[Chunk Upload] Failed to cleanup chunks directory:", cleanupErr);
      }

      // Now run IPA parser (graceful fallback)
      let appName = originalName.replace(/\.ipa$/i, "");
      let bundleId = "com.example.placeholder";
      let version = "1.0.0";
      let build = "1";
      let iconUrl = "";
      let parsingFailed = false;

      try {
        const parser = new AppInfoParser(finalFilePath);
        const result = await parser.parse();

        appName = result.CFBundleDisplayName || result.CFBundleName || appName;
        bundleId = result.CFBundleIdentifier || bundleId;
        version = result.CFBundleShortVersionString || result.CFBundleVersion || version;
        build = result.CFBundleVersion || build;

        if (result.icon) {
          try {
            const base64Data = result.icon.replace(/^data:image\/png;base64,/, "");
            const iconPath = path.join(UPLOADS_DIR, `${fileId}_icon.png`);
            fs.writeFileSync(iconPath, base64Data, "base64");
            iconUrl = `/uploads/${fileId}_icon.png`;
          } catch (iconErr) {
            console.error("Failed to save extracted icon:", iconErr);
          }
        }
      } catch (parserError: any) {
        console.warn("[Chunk Upload] AppInfoParser failed on assembled file. Falling back to manual details.", parserError);
        parsingFailed = true;
      }

      const metadata = {
        id: fileId,
        originalName,
        appName,
        bundleId,
        version,
        build,
        iconUrl,
        ipaUrl: `/uploads/${finalFileName}`,
        uploadedAt: new Date().toISOString(),
        parsingFailed,
      };

      fs.writeFileSync(
        path.join(UPLOADS_DIR, `${fileId}.json`),
        JSON.stringify(metadata, null, 2)
      );

      return res.json({
        success: true,
        assembled: true,
        metadata,
      });
    }

    // Still missing some chunks
    res.json({
      success: true,
      assembled: false,
      chunkReceived: index,
    });
  } catch (error: any) {
    console.error("Error during chunk upload:", error);
    // Try to cleanup temp file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({
      error: "チャンクのアップロードまたは結合に失敗しました。",
      details: error.message,
    });
  }
});

// API endpoint to upload and parse IPA with graceful fallback
app.post("/api/parse-ipa", upload.single("ipa"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const ipaPath = req.file.path;
    const fileId = path.basename(req.file.filename, ".ipa");

    console.log(`[IPA Parsing] Received file: ${req.file.originalname}, saved to: ${ipaPath}`);

    // Set fallback default values from filename
    let appName = req.file.originalname.replace(/\.ipa$/i, "");
    let bundleId = "com.example.placeholder";
    let version = "1.0.0";
    let build = "1";
    let iconUrl = "";
    let parsingFailed = false;

    try {
      // Parse IPA file using app-info-parser
      const parser = new AppInfoParser(ipaPath);
      const result = await parser.parse();

      // Extract relevant fields
      appName = result.CFBundleDisplayName || result.CFBundleName || appName;
      bundleId = result.CFBundleIdentifier || bundleId;
      version = result.CFBundleShortVersionString || result.CFBundleVersion || version;
      build = result.CFBundleVersion || build;

      // Handle icon extraction
      if (result.icon) {
        // If result.icon is a base64 data URI (e.g. data:image/png;base64,...)
        try {
          const base64Data = result.icon.replace(/^data:image\/png;base64,/, "");
          const iconPath = path.join(UPLOADS_DIR, `${fileId}_icon.png`);
          fs.writeFileSync(iconPath, base64Data, "base64");
          iconUrl = `/uploads/${fileId}_icon.png`;
        } catch (iconErr) {
          console.error("Failed to save extracted icon:", iconErr);
        }
      }
    } catch (parserError: any) {
      console.warn("[IPA Parsing] AppInfoParser failed on this file. Falling back to manual details.", parserError);
      parsingFailed = true;
    }

    // Save app metadata
    const metadata = {
      id: fileId,
      originalName: req.file.originalname,
      appName,
      bundleId,
      version,
      build,
      iconUrl,
      ipaUrl: `/uploads/${req.file.filename}`,
      uploadedAt: new Date().toISOString(),
      parsingFailed,
    };

    fs.writeFileSync(
      path.join(UPLOADS_DIR, `${fileId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    res.json({
      success: true,
      metadata,
    });
  } catch (error: any) {
    console.error("Error saving IPA upload:", error);
    res.status(500).json({
      error: "アップロードファイルの保存に失敗しました。",
      details: error.message,
    });
  }
});

// Update staged app metadata manually (useful for corrections or fallback handling)
app.post("/api/staged-apps/:id/update", (req, res) => {
  try {
    const fileId = req.params.id;
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ error: "App not found." });
    }

    const metadata = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const { appName, bundleId, version, build } = req.body;

    if (appName) metadata.appName = appName;
    if (bundleId) metadata.bundleId = bundleId;
    if (version) metadata.version = version;
    if (build) metadata.build = build;
    
    // Once they update it manually, we can clear the parsingFailed flag if they filled out the required fields
    if (metadata.appName && metadata.bundleId !== "com.example.placeholder") {
      metadata.parsingFailed = false;
    }

    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    res.json({
      success: true,
      metadata,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update app metadata.", details: error.message });
  }
});

// Endpoint to get active installations/staged apps
app.get("/api/staged-apps", (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const stagedApps = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        try {
          const content = fs.readFileSync(path.join(UPLOADS_DIR, file), "utf-8");
          return JSON.parse(content);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json({ success: true, apps: stagedApps });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list staged apps", details: error.message });
  }
});

// Delete a staged app
app.delete("/api/staged-apps/:id", (req, res) => {
  try {
    const fileId = req.params.id;
    const ipaPath = path.join(UPLOADS_DIR, `${fileId}.ipa`);
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);
    const iconPath = path.join(UPLOADS_DIR, `${fileId}_icon.png`);

    if (fs.existsSync(ipaPath)) fs.unlinkSync(ipaPath);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);

    res.json({ success: true, message: "App package deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete file", details: error.message });
  }
});

// Generate and serve the dynamically generated manifest plist
app.get("/api/ota/:id/manifest.plist", (req, res) => {
  try {
    const fileId = req.params.id;
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).send("Manifest not found");
    }

    const metadata = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    
    // Determine the full base URL. If APP_URL is provided in environment, use that, otherwise fall back to host headers.
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host");
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    
    // Fully qualified URL to the IPA file
    const ipaFullUrl = metadata.ipaUrl.startsWith("http") 
      ? metadata.ipaUrl 
      : `${baseUrl}${metadata.ipaUrl}`;

    // Generate manifest plist XML
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>items</key>
	<array>
		<dict>
			<key>assets</key>
			<array>
				<dict>
					<key>kind</key>
					<key>software-package</key>
					<key>url</key>
					<string>${ipaFullUrl}</string>
				</dict>
			</array>
			<key>metadata</key>
			<dict>
				<key>bundle-identifier</key>
				<string>${metadata.bundleId}</string>
				<key>bundle-version</key>
				<string>${metadata.version}</string>
				<key>kind</key>
				<string>software</string>
				<key>title</key>
				<string>${metadata.appName}</string>
			</dict>
		</dict>
	</array>
</dict>
</plist>`;

    res.setHeader("Content-Type", "application/xml");
    res.send(plist);
  } catch (error: any) {
    res.status(500).send(`Error generating plist: ${error.message}`);
  }
});

// API endpoint to generate and download mobileconfig on the fly
app.get("/api/ota/:id/installer.mobileconfig", (req, res) => {
  try {
    const fileId = req.params.id;
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).send("App not found");
    }

    const metadata = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    
    // Determine base URL
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host");
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    // Read icon if it exists and convert to base64
    let iconBase64 = "";
    if (metadata.iconUrl) {
      const cleanPath = metadata.iconUrl.startsWith("/") ? metadata.iconUrl.substring(1) : metadata.iconUrl;
      const iconPath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(iconPath)) {
        iconBase64 = fs.readFileSync(iconPath, { encoding: "base64" });
      }
    }

    // Direct installation URL using itms-services
    const manifestUrl = `${baseUrl}/api/ota/${fileId}/manifest.plist`;
    const itmsUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;

    // Build the mobileconfig XML
    const generateSimpleUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16).toUpperCase();
      });
    };

    const profileUUID = generateSimpleUUID();
    const payloadUUID = generateSimpleUUID();

    const webClipIdentifier = `com.apple.webclip.managed.${payloadUUID.substring(0, 8)}`;
    const profileIdentifier = `com.generator.profile.webclip.${profileUUID.substring(0, 8)}`;

    const escapeXmlForProfile = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "&": return "&amp;";
          case "'": return "&apos;";
          case '"': return "&quot;";
          default: return c;
        }
      });
    };

    const iconXml = iconBase64 
      ? `			<key>Icon</key>
			<data>
				${iconBase64}
			</data>`
      : "";

    const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>FullScreen</key>
			<true/>
${iconXml}
			<key>IsRemovable</key>
			<true/>
			<key>Label</key>
			<string>${escapeXmlForProfile(metadata.appName)}</string>
			<key>PayloadDescription</key>
			<string>App installation shortcut for ${escapeXmlForProfile(metadata.appName)}</string>
			<key>PayloadDisplayName</key>
			<string>${escapeXmlForProfile(metadata.appName)} (Web Clip)</string>
			<key>PayloadIdentifier</key>
			<string>${webClipIdentifier}</string>
			<key>PayloadType</key>
			<string>com.apple.webclip.managed</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>Precomposed</key>
			<true/>
			<key>URL</key>
			<string>${escapeXmlForProfile(`${baseUrl}/api/ota/${fileId}/direct`)}</string>
		</dict>
	</array>
	<key>PayloadDisplayName</key>
	<string>${escapeXmlForProfile(metadata.appName)} インストーラー</string>
	<key>PayloadIdentifier</key>
	<string>${profileIdentifier}</string>
	<key>PayloadOrganization</key>
	<string>iOS Profile &amp; OTA Generator</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>${profileUUID}</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>`;

    res.setHeader("Content-Type", "application/x-apple-aspen-config");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(metadata.appName)}_installer.mobileconfig"`);
    res.send(mobileconfig);
  } catch (error: any) {
    res.status(500).send(`Error generating configuration profile: ${error.message}`);
  }
});

// API endpoint for direct installation trigger from Web Clip or link
app.get("/api/ota/:id/direct", (req, res) => {
  try {
    const fileId = req.params.id;
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).send("App not found");
    }

    const metadata = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host");
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    
    const manifestUrl = `${baseUrl}/api/ota/${fileId}/manifest.plist`;
    const itmsUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;

    res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(metadata.appName)} - インストール起動</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    window.onload = function() {
      // Trigger the installation prompt immediately
      setTimeout(function() {
        window.location.href = "${itmsUrl}";
      }, 300);
    };
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-center items-center antialiased p-6">
  <div class="max-w-md w-full bg-slate-900/80 backdrop-blur-md rounded-3xl p-8 border border-slate-800 shadow-2xl text-center relative overflow-hidden animate-fade-in">
    <!-- Ambient glow -->
    <div class="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>

    <!-- Spinner / Loading -->
    <div class="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
      <div class="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
      <div class="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-2xl">📲</span>
    </div>

    <h2 class="text-xl font-bold mb-2 text-white">${escapeHtml(metadata.appName)}</h2>
    <p class="text-xs text-slate-400 mb-6 font-mono">${escapeHtml(metadata.bundleId)} (${escapeHtml(metadata.version)})</p>

    <div class="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-4 mb-6">
      <p class="text-xs text-blue-300 font-medium">
        iOSのインストール確認ダイアログがまもなく表示されます。
      </p>
      <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">
        ダイアログが表示されたら<strong>「インストール」</strong>をタップして、ホーム画面に戻ってダウンロードの完了をお待ちください。
      </p>
    </div>

    <!-- Fallback Manual Button -->
    <a href="${itmsUrl}" class="block w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-lg transition duration-200 transform border border-blue-500/30 text-xs mb-3">
      自動で起動しない場合はここをタップ
    </a>
    
    <p class="text-[10px] text-slate-500 leading-relaxed">
      ※ インストール後は、このページ（Web Clip）を閉じてホーム画面でアプリをご確認ください。
    </p>
  </div>
</body>
</html>
    `);
  } catch (error: any) {
    res.status(500).send(`Error triggering installation: ${error.message}`);
  }
});

// Serve beautiful iOS OTA Installation Landing Page
app.get("/install/:id", (req, res) => {
  try {
    const fileId = req.params.id;
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).send(`
        <html>
          <head>
            <title>Not Found</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-950 flex items-center justify-center min-h-screen text-slate-300 font-sans p-6">
            <div class="max-w-md w-full bg-slate-900 rounded-3xl p-8 shadow-xl text-center border border-slate-800">
              <div class="text-amber-500 text-5xl mb-4">⚠️</div>
              <h1 class="text-2xl font-bold mb-2 text-white">リンクが見つかりません</h1>
              <p class="text-slate-400 mb-6">このアプリのダウンロードURLは無効であるか、すでに期限切れ（24時間経過）で自動削除されています。</p>
              <a href="/" class="inline-block bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-2xl transition duration-200 shadow-md">
                トップに戻る
              </a>
            </div>
          </body>
        </html>
      `);
    }

    const metadata = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host");
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    
    const manifestUrl = `${baseUrl}/api/ota/${fileId}/manifest.plist`;
    const itmsUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
    const mobileconfigUrl = `/api/ota/${fileId}/installer.mobileconfig`;

    res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(metadata.appName)} - インストール</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between antialiased">
  <div class="px-6 py-8 flex-grow flex flex-col items-center justify-center max-w-lg mx-auto w-full">
    <!-- Card Container -->
    <div class="bg-slate-900/80 backdrop-blur-md rounded-3xl p-8 border border-slate-800 shadow-2xl w-full text-center relative overflow-hidden">
      <!-- Ambient Backglow -->
      <div class="absolute -top-16 -left-16 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>

      <!-- App Icon Frame with iOS layout -->
      <div class="relative inline-block mb-6">
        ${metadata.iconUrl ? `
          <img src="${metadata.iconUrl}" class="w-24 h-24 object-cover rounded-[22%] shadow-lg border border-slate-800" alt="App Icon" />
        ` : `
          <div class="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[22%] flex items-center justify-center shadow-lg border border-slate-800 text-white font-bold text-3xl">
            ${escapeHtml(metadata.appName.substring(0, 1))}
          </div>
        `}
      </div>

      <!-- App Details -->
      <h1 class="text-2xl font-bold text-white tracking-tight leading-snug mb-1">${escapeHtml(metadata.appName)}</h1>
      <p class="text-slate-400 text-sm mb-6">${escapeHtml(metadata.bundleId)}</p>

      <div class="grid grid-cols-2 gap-4 bg-slate-950 rounded-2xl p-4 border border-slate-800 mb-8 text-left text-xs">
        <div>
          <span class="text-slate-500 block mb-0.5">バージョン</span>
          <span class="font-medium text-slate-200 text-sm">${escapeHtml(metadata.version)}</span>
        </div>
        <div>
          <span class="text-slate-500 block mb-0.5">ビルド</span>
          <span class="font-medium text-slate-200 text-sm">${escapeHtml(metadata.build)}</span>
        </div>
      </div>

      <div class="space-y-4">
        <!-- Flow 1: Profile Install (Recommended by User) -->
        <div class="p-5 bg-gradient-to-br from-blue-950/40 to-indigo-950/40 rounded-2xl border border-blue-500/30 text-left relative overflow-hidden">
          <div class="absolute top-0 right-0 bg-blue-500 text-[9px] font-bold text-white px-3 py-1 rounded-bl-xl uppercase tracking-wider">
            推奨インストール
          </div>
          <h3 class="font-bold text-sm text-white mb-1.5 flex items-center gap-1.5">
            💎 構成プロファイルでインストール
          </h3>
          <p class="text-xs text-slate-300 leading-relaxed mb-4">
            構成プロファイルをインストールすると、ホーム画面にアプリアイコンが追加され、いつでもワンタップでアプリをインストールできるようになります。
          </p>
          <a href="${mobileconfigUrl}" class="block w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-center font-semibold py-3.5 px-5 rounded-xl shadow-lg transition duration-200 border border-blue-500/30 text-xs">
            構成プロファイルをダウンロードする
          </a>
        </div>

        <div class="relative flex py-2 items-center">
          <div class="flex-grow border-t border-slate-800"></div>
          <span class="flex-shrink mx-4 text-slate-500 text-[10px] uppercase tracking-wider font-semibold">または</span>
          <div class="flex-grow border-t border-slate-800"></div>
        </div>

        <!-- Flow 2: Standard OTA Install -->
        <a href="${itmsUrl}" class="block w-full bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-slate-200 font-semibold py-3.5 px-6 rounded-xl border border-slate-800 text-xs transition duration-200">
          今すぐ一度だけ直接インストールする (OTA)
        </a>
      </div>
    </div>

    <!-- Helpful steps accordions/cards -->
    <div class="w-full mt-6 space-y-3">
      <div class="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300">
        <h3 class="font-bold text-white mb-2 flex items-center gap-1.5">
          <span class="bg-blue-500/20 text-blue-400 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono">A</span>
          構成プロファイルの手順 (推奨)
        </h3>
        <ol class="list-decimal pl-4 space-y-1.5 mt-1 text-slate-400">
          <li>上記の<strong>「構成プロファイルをダウンロードする」</strong>をタップして許可します。</li>
          <li>iOSの<strong>「設定」</strong>アプリを開きます。</li>
          <li>上部に表示される<strong>「プロファイルがダウンロードされました」</strong>をタップし、インストールを行います。</li>
          <li>ホーム画面に追加された<strong>「${escapeHtml(metadata.appName)}」アイコンをタップ</strong>すると、直接アプリのインストールが開始されます。</li>
        </ol>
      </div>

      <div class="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300">
        <h3 class="font-bold text-white mb-2 flex items-center gap-1.5">
          <span class="bg-blue-500/20 text-blue-400 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono">B</span>
          直接OTAインストールを行う手順
        </h3>
        <p class="leading-relaxed mb-2">「今すぐ一度だけ直接インストールする」をタップし、確認ダイアログが表示されたら<strong>「インストール」</strong>をタップします。</p>
        <p class="leading-relaxed">ホーム画面にアプリのダミーアイコンが追加され、ダウンロードが自動的に開始されます。</p>
      </div>

      <div class="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300">
        <h3 class="font-bold text-white mb-2 flex items-center gap-1.5">
          <span class="bg-blue-500/20 text-blue-400 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono">C</span>
          起動できない場合の対処法
        </h3>
        <p class="leading-relaxed mb-1">起動時に<strong>「信頼されていないエンタープライズ開発元」</strong>というエラーが表示される場合は、以下の手順を実行してください。</p>
        <ol class="list-decimal pl-4 space-y-1 mt-1 text-slate-400 font-mono">
          <li>iOSの<strong>「設定」</strong>アプリを開く</li>
          <li><strong>「一般」</strong> &gt; <strong>「VPNとデバイス管理」</strong> を開く</li>
          <li>「エンタープライズアプリ」または「デベロッパ」から該当する開発元を選択</li>
          <li><strong>「&quot;〜&quot;を信頼」</strong>をタップして許可します</li>
        </ol>
      </div>
    </div>
  </div>

  <footer class="py-6 text-center text-[10px] text-slate-600 border-t border-slate-900/50">
    &copy; iOS Profile &amp; OTA Generator &bull; Powered by Google AI Studio Build
  </footer>
</body>
</html>
    `);
  } catch (error: any) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}

// Periodic Cleanup function (removes uploads older than 24 hours to prevent disk fill-up)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // hourly
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

setInterval(() => {
  try {
    const now = Date.now();
    const files = fs.readdirSync(UPLOADS_DIR);
    files.forEach((file) => {
      // Do not delete the core chunk/temp folders themselves, but we can clean their contents
      if (file === "chunks" || file === "temp") {
        const subDir = path.join(UPLOADS_DIR, file);
        const subFiles = fs.readdirSync(subDir);
        subFiles.forEach((subFile) => {
          const subFilePath = path.join(subDir, subFile);
          const stats = fs.statSync(subFilePath);
          if (now - stats.mtimeMs > MAX_AGE) {
            fs.rmSync(subFilePath, { recursive: true, force: true });
            console.log(`[Cleanup] Deleted expired temporary chunk/temp file: ${file}/${subFile}`);
          }
        });
        return;
      }

      const filePath = path.join(UPLOADS_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > MAX_AGE) {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`[Cleanup] Deleted expired file/directory: ${file}`);
      }
    });
  } catch (err) {
    console.error("[Cleanup] Error cleaning uploads:", err);
  }
}, CLEANUP_INTERVAL);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errMessage = `[${new Date().toISOString()}] ERROR: ${err.message || err}\nStack: ${err.stack || ""}\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), "error.log"), errMessage);
  } catch (e) {
    console.error("Failed to write error to log file", e);
  }
  console.error("[Global Error Handler]", err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    error: err.message || "サーバーエラーが発生しました。",
    details: err.stack || String(err),
  });
});

// Integrate Vite middleware or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
