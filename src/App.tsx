import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  FileText, 
  Smartphone, 
  Check, 
  Copy, 
  Trash2, 
  QrCode, 
  ExternalLink, 
  Download, 
  Wifi, 
  ShieldAlert, 
  Link2, 
  Eye, 
  History, 
  Compass, 
  RefreshCw,
  Sliders,
  Sparkles,
  Info,
  Server,
  Key
} from "lucide-react";
import { AppMetadata, ProfileType, WebClipConfig, WiFiConfig, VPNConfig, PasscodeConfig, MDMConfig, CertificateConfig } from "./types";
import { generateWebClipProfile, generateWiFiProfile, generateVPNProfile, generatePasscodeProfile, generateMDMProfile, generateCertificateProfile } from "./utils/profileGenerator";

export default function App() {
  // App states
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedMetadata, setParsedMetadata] = useState<AppMetadata | null>(null);
  const [stagedApps, setStagedApps] = useState<AppMetadata[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Metadata manual correction states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editAppName, setEditAppName] = useState("");
  const [editBundleId, setEditBundleId] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [editBuild, setEditBuild] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);
  
  // Tab configuration
  const [activeTab, setActiveTab] = useState<"ota" | "profile">("ota");
  const [profileSubTab, setProfileSubTab] = useState<ProfileType>(ProfileType.WEB_CLIP);
  const [webClipActionType, setWebClipActionType] = useState<"landing" | "direct">("direct");
  
  // Custom toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  
  // Profile Forms States
  const [webClipForm, setWebClipForm] = useState<WebClipConfig>({
    label: "",
    url: "",
    iconBase64: "",
    isFullScreen: true,
    isRemovable: true,
    precomposedIcon: true,
  });

  const [wifiForm, setWifiForm] = useState<WiFiConfig>({
    ssid: "",
    securityType: "WPA",
    password: "",
    autoJoin: true,
  });

  const [vpnForm, setVPNForm] = useState<VPNConfig>({
    connectionName: "",
    connectionType: "IPSec",
    serverAddress: "",
    account: "",
  });

  const [passcodeForm, setPasscodeForm] = useState<PasscodeConfig>({
    requirePasscode: true,
    minLength: 6,
    maxFailedAttempts: 5,
    allowSimple: false,
  });

  const [mdmForm, setMDMForm] = useState<MDMConfig>({
    serverUrl: window.location.origin + "/api/mdm/server",
    checkInUrl: window.location.origin + "/api/mdm/checkin",
    topic: "com.apple.mgmt.External.enterprise",
    accessRights: 8191,
    signMessage: true,
  });

  const [certificateForm, setCertificateForm] = useState<CertificateConfig>({
    displayName: "Internal Enterprise Trusted Agent Root",
    certificateBase64: "MIIBiTCCATKgAwIBAgIRAMXoXgAAAAAAxSBmNlcnQwDQYJKoZIhvcNAQELBQAwHjEcMBoGA1UEAxMTRW50ZXJwcmlzZSBUcnVzdCBDQTAeFw0yNjA2MzAwNjI0MDBaFw0zNjA2MzAwNjI0MDBaMB4xHDAaBgNVBAMTE0VudGVycHJpc2UgVHJ1c3QgQ0EwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAL71a4vP7iE1mD9Z...", // Small stub
  });


  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch staged apps history on load
  useEffect(() => {
    fetchStagedApps();
  }, []);

  // Sync web clip form and manual editing fields when metadata is parsed or action type changes
  useEffect(() => {
    if (parsedMetadata) {
      const targetUrl = webClipActionType === "direct"
        ? `${window.location.origin}/api/ota/${parsedMetadata.id}/direct`
        : `${window.location.origin}/install/${parsedMetadata.id}`;

      // Set label and extract icon if available
      setWebClipForm((prev) => ({
        ...prev,
        label: parsedMetadata.appName,
        url: targetUrl,
      }));
      
      // Populate editing states
      setEditAppName(parsedMetadata.appName);
      setEditBundleId(parsedMetadata.bundleId);
      setEditVersion(parsedMetadata.version);
      setEditBuild(parsedMetadata.build);
      
      // If the app parsing failed, open edit mode automatically to guide the user!
      if (parsedMetadata.parsingFailed) {
        setIsEditingMetadata(true);
      } else {
        setIsEditingMetadata(false);
      }
    }
  }, [parsedMetadata, webClipActionType]);

  // Separate effect to load the base64 icon once when parsedMetadata changes
  useEffect(() => {
    if (parsedMetadata && parsedMetadata.iconUrl) {
      convertImageUrlToBase64(parsedMetadata.iconUrl).then((base64) => {
        if (base64) {
          setWebClipForm((prev) => ({ ...prev, iconBase64: base64 }));
        }
      });
    }
  }, [parsedMetadata?.id, parsedMetadata?.iconUrl]);

  // Utility to fetch image and convert to base64 for profile generator
  const convertImageUrlToBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to convert image to base64:", e);
      return null;
    }
  };

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchStagedApps = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/staged-apps");
      const data = await response.json();
      if (data.success) {
        setStagedApps(data.apps);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".ipa")) {
        setFile(droppedFile);
        uploadAndParseIpa(droppedFile);
      } else {
        showToast("IPAファイル (.ipa) のみをアップロードしてください。", "error");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith(".ipa")) {
        setFile(selectedFile);
        uploadAndParseIpa(selectedFile);
      } else {
        showToast("IPAファイル (.ipa) のみをアップロードしてください。", "error");
      }
    }
  };

  // Upload IPA file in chunks to backend to bypass proxy size limits
  const uploadAndParseIpa = async (fileToUpload: File) => {
    setUploading(true);
    setUploadProgress(0);

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(fileToUpload.size / CHUNK_SIZE);
    const fileId = Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    const originalName = fileToUpload.name;

    try {
      let metadataResult = null;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);
        const chunk = fileToUpload.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk, `${originalName}.part${i}`);
        formData.append("fileId", fileId);
        formData.append("chunkIndex", i.toString());
        formData.append("totalChunks", totalChunks.toString());
        formData.append("originalName", originalName);

        const response = await fetch("/api/upload-chunk", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errMsg = "アップロードに失敗しました。";
          try {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } catch {
            errMsg = `エラーが発生しました（ステータス: ${response.status}）`;
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "チャンクの保存に失敗しました。");
        }

        if (data.assembled) {
          metadataResult = data.metadata;
        }

        // Update progress smoothly based on completed chunks
        const progressPercent = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(progressPercent);
      }

      setUploadProgress(100);

      if (metadataResult) {
        setParsedMetadata(metadataResult);
        if (metadataResult.parsingFailed) {
          showToast("アップロード完了！自動解析に失敗したため、手動で情報を入力してください。", "info");
        } else {
          showToast("IPAファイルのアップロードと解析に成功しました！", "success");
        }
        fetchStagedApps(); // update list
      } else {
        showToast("ファイルの結合処理に失敗しました。", "error");
        setFile(null);
      }
    } catch (err: any) {
      showToast(err.message || "アップロード中にエラーが発生しました。ネットワーク接続を確認してください。", "error");
      setFile(null);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  // Save manual metadata corrections
  const handleSaveMetadata = async () => {
    if (!parsedMetadata) return;
    if (!editAppName.trim() || !editBundleId.trim() || !editVersion.trim() || !editBuild.trim()) {
      showToast("すべての必須項目を入力してください。", "error");
      return;
    }

    setSavingMetadata(true);
    try {
      const response = await fetch(`/api/staged-apps/${parsedMetadata.id}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appName: editAppName.trim(),
          bundleId: editBundleId.trim(),
          version: editVersion.trim(),
          build: editBuild.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setParsedMetadata(data.metadata);
        setIsEditingMetadata(false);
        showToast("アプリの配置情報を更新しました！", "success");
        fetchStagedApps(); // update list
      } else {
        showToast(data.error || "情報の更新に失敗しました。", "error");
      }
    } catch (err) {
      showToast("情報の更新中にエラーが発生しました。", "error");
    } finally {
      setSavingMetadata(false);
    }
  };

  // Delete uploaded package
  const handleDeleteApp = async (id: string, name: string) => {
    if (!confirm(`「${name}」の配信パッケージを削除しますか？`)) return;
    try {
      const response = await fetch(`/api/staged-apps/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        showToast("パッケージを削除しました。", "success");
        if (parsedMetadata && parsedMetadata.id === id) {
          setParsedMetadata(null);
          setFile(null);
        }
        fetchStagedApps();
      }
    } catch (err) {
      showToast("削除に失敗しました。", "error");
    }
  };

  // Copy text to clipboard helper
  const copyText = (text: string, label: string = "リンク") => {
    navigator.clipboard.writeText(text);
    showToast(`${label}をコピーしました！`, "success");
  };

  // Generate and trigger download of mobileconfig plist
  const downloadProfile = (xmlContent: string, filename: string) => {
    const blob = new Blob([xmlContent], { type: "application/x-apple-aspen-config" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`構成プロファイル (${filename}) をダウンロードしました！`, "success");
  };

  // Handle mobileconfig profile generation triggers
  const handleGenerateProfile = () => {
    try {
      let xml = "";
      let filename = "";

      if (profileSubTab === ProfileType.WEB_CLIP) {
        if (!webClipForm.label || !webClipForm.url) {
          showToast("ラベルとURLを入力してください。", "error");
          return;
        }
        xml = generateWebClipProfile(webClipForm);
        filename = `${webClipForm.label.replace(/\s+/g, "_")}_webclip.mobileconfig`;
      } else if (profileSubTab === ProfileType.WIFI) {
        if (!wifiForm.ssid) {
          showToast("SSIDを入力してください。", "error");
          return;
        }
        xml = generateWiFiProfile(wifiForm);
        filename = `${wifiForm.ssid.replace(/\s+/g, "_")}_wifi.mobileconfig`;
      } else if (profileSubTab === ProfileType.VPN) {
        if (!vpnForm.connectionName || !vpnForm.serverAddress) {
          showToast("接続名とサーバーアドレスを入力してください。", "error");
          return;
        }
        xml = generateVPNProfile(vpnForm);
        filename = `${vpnForm.connectionName.replace(/\s+/g, "_")}_vpn.mobileconfig`;
      } else if (profileSubTab === ProfileType.PASSCODE) {
        xml = generatePasscodeProfile(passcodeForm);
        filename = `passcode_policy.mobileconfig`;
      } else if (profileSubTab === ProfileType.MDM) {
        if (!mdmForm.serverUrl || !mdmForm.topic) {
          showToast("MDMサーバーURLとTopicを入力してください。", "error");
          return;
        }
        xml = generateMDMProfile(mdmForm);
        filename = `mdm_enrollment_${mdmForm.topic.replace(/\s+/g, "_")}.mobileconfig`;
      } else if (profileSubTab === ProfileType.CERTIFICATE) {
        if (!certificateForm.displayName || !certificateForm.certificateBase64) {
          showToast("証明書名と証明書データ (Base64) を入力、またはファイルをアップロードしてください。", "error");
          return;
        }
        xml = generateCertificateProfile(certificateForm);
        filename = `trusted_root_${certificateForm.displayName.replace(/\s+/g, "_")}.mobileconfig`;
      }

      if (xml) {
        downloadProfile(xml, filename);
      }
    } catch (err: any) {
      showToast(`生成に失敗しました: ${err.message}`, "error");
    }
  };

  // Download manifest.plist directly
  const handleDownloadManifest = () => {
    if (!parsedMetadata) return;
    
    const baseUrl = window.location.origin;
    const ipaFullUrl = parsedMetadata.ipaUrl.startsWith("http") 
      ? parsedMetadata.ipaUrl 
      : `${baseUrl}${parsedMetadata.ipaUrl}`;

    const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
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
				<string>${parsedMetadata.bundleId}</string>
				<key>bundle-version</key>
				<string>${parsedMetadata.version}</string>
				<key>kind</key>
				<string>software</string>
				<key>title</key>
				<string>${parsedMetadata.appName}</string>
			</dict>
		</dict>
	</array>
</dict>
</plist>`;

    const blob = new Blob([plistXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "manifest.plist";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("manifest.plist をダウンロードしました！", "success");
  };

  // Helper to trigger custom local icon upload for Web Clip
  const handleCustomIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target?.result) {
          setWebClipForm((prev) => ({
            ...prev,
            iconBase64: event.target!.result as string,
          }));
          showToast("カスタムアイコンを設定しました！");
        }
      };
      fileReader.readAsDataURL(e.target.files[0]);
    }
  };

  // Helper to trigger custom root certificate upload
  const handleCertFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target?.result) {
          const raw = event.target.result as string;
          let base64 = "";
          if (raw.startsWith("data:")) {
            base64 = raw.split(",")[1];
          } else {
            base64 = btoa(raw);
          }
          try {
            const decoded = atob(base64);
            if (decoded.includes("-----BEGIN CERTIFICATE-----")) {
              const stripped = decoded
                .replace(/-----BEGIN CERTIFICATE-----/, "")
                .replace(/-----END CERTIFICATE-----/, "")
                .replace(/\s+/g, "");
              base64 = stripped;
            }
          } catch (err) {
            // fallback
          }

          setCertificateForm((prev) => ({
            ...prev,
            certificateBase64: base64,
          }));
          showToast(`証明書「${selectedFile.name}」を読み込みました！`, "success");
        }
      };
      fileReader.readAsDataURL(selectedFile);
    }
  };

  // Full staging public link
  const installPageUrl = parsedMetadata 
    ? `${window.location.origin}/install/${parsedMetadata.id}`
    : "";

  return (
    <div id="app-root" className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white pb-12">
      {/* Glow effects */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Floating toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-full px-4"
          >
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border ${
              toast.type === "success" 
                ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200" 
                : toast.type === "error"
                ? "bg-rose-950/90 border-rose-500/30 text-rose-200"
                : "bg-blue-950/90 border-blue-500/30 text-blue-200"
            }`}>
              {toast.type === "success" && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
              <span className="text-sm font-medium leading-tight">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant minimalist navigation bar */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-white tracking-tight text-lg">Apple Config &amp; OTA Hub</span>
              <span className="text-[10px] text-slate-500 ml-2 font-mono bg-slate-900 px-2 py-0.5 rounded-full">v1.1</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="#staged" 
              className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-slate-900 transition flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              <span>履歴</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Upload & Analysis (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-xl relative overflow-hidden backdrop-blur-md">
            <h2 className="font-display font-semibold text-white text-lg mb-1 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              IPAファイルのアップロード
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              iOSのAd-Hocまたはエンタープライズビルドの.ipaファイルをドラッグ＆ドロップして、構成情報を自動抽出します。
            </p>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative ${
                dragActive 
                  ? "border-blue-500 bg-blue-500/5 scale-[0.99]" 
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/80"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ipa"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900/80 flex items-center justify-center border border-slate-800 text-slate-400 transition-transform duration-300 group-hover:scale-110">
                  {uploading ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  ) : (
                    <FileText className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                
                {uploading ? (
                  <div className="space-y-2 w-full max-w-[200px]">
                    <p className="text-xs font-medium text-blue-400">IPAをアップロードして解析中...</p>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-200">
                      ファイルをドラッグ＆ドロップ
                    </p>
                    <p className="text-xs text-slate-500">
                      または <span className="text-blue-400 underline decoration-blue-400/30">ブラウズして選択</span>
                    </p>
                    <p className="text-[10px] text-slate-600 mt-2">
                      最大容量 1GB / IPAファイルのみ
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* IPA Extraction Card (Show only when metadata is available) */}
          <AnimatePresence mode="wait">
            {parsedMetadata && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-md"
              >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>

                {isEditingMetadata ? (
                  <div className="space-y-4">
                    <h3 className="font-display font-semibold text-white text-base flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-blue-400" />
                      アプリ情報の補正
                    </h3>
                    
                    {parsedMetadata.parsingFailed && (
                      <div className="p-3 bg-amber-950/40 border border-amber-500/20 rounded-xl text-[11px] text-amber-200 leading-relaxed">
                        ⚠️ IPAファイルのメタデータ自動解析に失敗したため、手動で配信情報を補正してください。正しいBundle IDとバージョンを設定しないとiOSでのインストールが失敗します。
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">アプリ名</label>
                        <input
                          type="text"
                          value={editAppName}
                          onChange={(e) => setEditAppName(e.target.value)}
                          placeholder="例: 社内アプリ"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Bundle ID</label>
                        <input
                          type="text"
                          value={editBundleId}
                          onChange={(e) => setEditBundleId(e.target.value)}
                          placeholder="例: com.company.app"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">バージョン</label>
                          <input
                            type="text"
                            value={editVersion}
                            onChange={(e) => setEditVersion(e.target.value)}
                            placeholder="例: 1.0.0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">ビルド番号</label>
                          <input
                            type="text"
                            value={editBuild}
                            onChange={(e) => setEditBuild(e.target.value)}
                            placeholder="例: 1"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={() => setIsEditingMetadata(false)}
                        disabled={savingMetadata}
                        className="flex-grow text-xs py-2 px-3 rounded-xl font-medium bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 transition"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleSaveMetadata}
                        disabled={savingMetadata}
                        className="flex-grow text-xs py-2 px-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10 transition flex items-center justify-center gap-1.5 font-bold"
                      >
                        {savingMetadata ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        保存する
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-5">
                      {/* Extracted App Icon */}
                      <div className="relative shrink-0">
                        {parsedMetadata.iconUrl ? (
                          <img 
                            src={parsedMetadata.iconUrl} 
                            className="w-20 h-20 object-cover rounded-[22%] shadow-md border border-slate-800 relative z-10" 
                            alt="App Icon" 
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[22%] flex items-center justify-center shadow-md border border-slate-800 text-white font-bold text-2xl relative z-10">
                            {parsedMetadata.appName.substring(0, 1)}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-white/5 rounded-[22%] z-20 pointer-events-none"></div>
                      </div>

                      {/* Metadata Info */}
                      <div className="space-y-1.5 flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full ${
                            parsedMetadata.parsingFailed
                              ? "text-amber-400 bg-amber-950/50 border border-amber-500/20"
                              : "text-blue-400 bg-blue-950/50 border border-blue-500/20"
                          }`}>
                            <Sparkles className="w-3 h-3" />
                            {parsedMetadata.parsingFailed ? "自動解析失敗" : "解析完了"}
                          </span>
                          
                          <button
                            onClick={() => {
                              setEditAppName(parsedMetadata.appName);
                              setEditBundleId(parsedMetadata.bundleId);
                              setEditVersion(parsedMetadata.version);
                              setEditBuild(parsedMetadata.build);
                              setIsEditingMetadata(true);
                            }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 bg-slate-950/80 border border-slate-900 hover:border-slate-800 px-2.5 py-1 rounded-xl transition"
                          >
                            補正する
                          </button>
                        </div>
                        <h3 className="font-display font-bold text-white text-lg truncate leading-tight" title={parsedMetadata.appName}>
                          {parsedMetadata.appName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <span className="truncate">{parsedMetadata.bundleId}</span>
                          <button 
                            onClick={() => copyText(parsedMetadata.bundleId, "Bundle ID")}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sub Metadata parameters */}
                    <div className="mt-6 grid grid-cols-2 gap-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-900/80 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">バージョン</span>
                        <span className="font-mono text-slate-200 font-medium">{parsedMetadata.version}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">ビルド</span>
                        <span className="font-mono text-slate-200 font-medium">{parsedMetadata.build}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-900/60 flex justify-between items-center">
                        <span className="text-slate-500">オリジナルファイル</span>
                        <span className="font-mono text-slate-300 truncate max-w-[200px]" title={parsedMetadata.originalName}>
                          {parsedMetadata.originalName}
                        </span>
                      </div>
                    </div>

                    {/* Actions related to parsed app */}
                    <div className="mt-6 pt-5 border-t border-slate-900 flex gap-2">
                      <button
                        onClick={() => {
                          setActiveTab("ota");
                          showToast("OTAインストール設定を開きました。");
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 text-xs py-3 px-4 rounded-xl font-medium transition duration-200 ${
                          activeTab === "ota" 
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10" 
                            : "bg-slate-950/60 border border-slate-850 hover:bg-slate-900 text-slate-300"
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        OTA 配信リンク
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("profile");
                          setProfileSubTab(ProfileType.WEB_CLIP);
                          showToast("Web Clipプロファイルに情報を同期しました。");
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 text-xs py-3 px-4 rounded-xl font-medium transition duration-200 ${
                          activeTab === "profile" && profileSubTab === ProfileType.WEB_CLIP
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10" 
                            : "bg-slate-950/60 border border-slate-850 hover:bg-slate-900 text-slate-300"
                        }`}
                      >
                        <Sliders className="w-4 h-4" />
                        Web Clip作成
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Form & Config Outputs (Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main workspace cards */}
          <div className="bg-slate-900/40 rounded-3xl border border-slate-800/80 shadow-xl overflow-hidden backdrop-blur-md">
            {/* Header tab switcher */}
            <div className="flex border-b border-slate-900 bg-slate-950/40 p-2">
              <button
                onClick={() => setActiveTab("ota")}
                className={`flex-1 py-3 text-sm font-semibold rounded-2xl transition flex items-center justify-center gap-2 ${
                  activeTab === "ota"
                    ? "bg-slate-900 text-blue-400 border border-slate-800/80 shadow-inner"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                iOS OTA インストーラー作成
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex-1 py-3 text-sm font-semibold rounded-2xl transition flex items-center justify-center gap-2 ${
                  activeTab === "profile"
                    ? "bg-slate-900 text-blue-400 border border-slate-800/80 shadow-inner"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sliders className="w-4 h-4" />
                iOS 構成プロファイル作成 (.mobileconfig)
              </button>
            </div>

            {/* Content area */}
            <div className="p-6">
              {/* Tab 1: OTA System */}
              {activeTab === "ota" && (
                <div className="space-y-6">
                  {!parsedMetadata ? (
                    <div className="py-12 text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center border border-slate-850 mx-auto text-slate-600">
                        <Smartphone className="w-7 h-7" />
                      </div>
                      <h3 className="font-display font-semibold text-slate-300">IPAファイルがアップロードされていません</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        左側のパネルからIPAファイルをアップロードしていただくと、自動でOTAインストール画面、マニフェストファイル、QRコードが生成されます。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-900/80 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-blue-400" />
                          配信用の情報
                        </h3>

                        <div className="space-y-3">
                          {/* Installation Link */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold tracking-wide uppercase text-slate-500">
                              スマホ用インストールWebページ (iOS Safari専用)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readonly
                                value={installPageUrl}
                                className="bg-slate-900 border border-slate-800 text-xs font-mono px-3.5 py-3 rounded-xl flex-grow text-slate-300 focus:outline-none"
                              />
                              <button
                                onClick={() => copyText(installPageUrl, "インストールリンク")}
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-slate-300 hover:text-white transition flex items-center justify-center"
                                title="リンクをコピー"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <a
                                href={`/install/${parsedMetadata.id}`}
                                target="_blank"
                                rel="referrer"
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-slate-300 hover:text-white transition flex items-center justify-center"
                                title="ページを表示"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>

                          {/* Dynamic Plist Link */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold tracking-wide uppercase text-slate-500">
                              itms-services プラットフォームマニフェスト (XML PLIST)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readonly
                                value={`itms-services://?action=download-manifest&url=${encodeURIComponent(`${window.location.origin}/api/ota/${parsedMetadata.id}/manifest.plist`)}`}
                                className="bg-slate-900 border border-slate-800 text-xs font-mono px-3.5 py-3 rounded-xl flex-grow text-slate-500 focus:outline-none truncate"
                              />
                              <button
                                onClick={() => copyText(`itms-services://?action=download-manifest&url=${encodeURIComponent(`${window.location.origin}/api/ota/${parsedMetadata.id}/manifest.plist`)}`, "itmsリンク")}
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-slate-300 hover:text-white transition flex items-center justify-center"
                                title="コピー"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleDownloadManifest}
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-slate-300 hover:text-white transition flex items-center justify-center"
                                title="manifest.plistをダウンロード"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Direct mobileconfig install profile link */}
                          <div className="space-y-2 pt-3 border-t border-slate-900/50">
                            <label className="text-[10px] font-bold tracking-wide uppercase text-blue-400 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 animate-pulse text-blue-400" />
                              【構成プロファイル】アプリアイコン＆自動インストール
                            </label>
                            <div className="p-4 bg-blue-950/10 rounded-xl border border-blue-500/20 space-y-3">
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                この構成プロファイル(.mobileconfig)を端末にインストールすると、ホーム画面に抽出されたアプリアイコン(Web Clip)が追加され、タップするだけで直接アプリのOTAインストールが開始されます。
                              </p>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  readonly
                                  value={`${window.location.origin}/api/ota/${parsedMetadata.id}/installer.mobileconfig`}
                                  className="bg-slate-900 border border-slate-850 text-xs font-mono px-3 py-2.5 rounded-xl flex-grow text-slate-400 focus:outline-none truncate"
                                />
                                <div className="flex gap-2 shrink-0">
                                  <button
                                    onClick={() => copyText(`${window.location.origin}/api/ota/${parsedMetadata.id}/installer.mobileconfig`, "プロファイルURL")}
                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-2.5 rounded-xl text-slate-300 hover:text-white transition flex items-center justify-center text-xs gap-1 font-semibold"
                                    title="プロファイルURLをコピー"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>コピー</span>
                                  </button>
                                  <a
                                    href={`/api/ota/${parsedMetadata.id}/installer.mobileconfig`}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl transition flex items-center justify-center text-xs gap-1.5 font-bold shadow-lg shadow-blue-500/10"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>ダウンロード</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* QR Code section & Safari preview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* QR Code Container */}
                        <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-900/80 flex flex-col items-center justify-center text-center space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                            <QrCode className="w-4 h-4 text-blue-400" />
                            iPhoneのカメラでスキャンしてインストール
                          </h4>
                          
                          <div className="bg-white p-3.5 rounded-2xl shadow-xl">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(installPageUrl)}`}
                              className="w-44 h-44 object-contain"
                              alt="Installation Link QR Code"
                            />
                          </div>

                          <p className="text-[10px] text-slate-500 max-w-[220px]">
                            カメラをかざして表示されるリンクをタップすると、Safariでインストールページが開きます。
                          </p>
                        </div>

                        {/* Visual Device Preview */}
                        <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-900/80 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                          <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-blue-400" />
                            スマホ画面プレビュー
                          </h4>

                          {/* Mock iPhone Frame */}
                          <div className="w-full max-w-[190px] aspect-[9/18] bg-slate-900 border-[6px] border-slate-850 rounded-[32px] overflow-hidden flex flex-col justify-between p-3 shadow-2xl relative text-left">
                            {/* Speaker notch */}
                            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-3 bg-slate-850 rounded-full"></div>

                            {/* App details mock */}
                            <div className="flex-grow flex flex-col items-center justify-center space-y-3 pt-4">
                              {parsedMetadata.iconUrl ? (
                                <img src={parsedMetadata.iconUrl} className="w-12 h-12 object-cover rounded-[22%] shadow-md border border-slate-800" alt="Mock icon" />
                              ) : (
                                <div className="w-12 h-12 bg-blue-600 rounded-[22%] flex items-center justify-center text-white font-bold text-xl">{parsedMetadata.appName.substring(0, 1)}</div>
                              )}
                              
                              <div className="text-center">
                                <h5 className="text-white text-xs font-bold truncate max-w-[140px]">{parsedMetadata.appName}</h5>
                                <p className="text-[8px] text-slate-500 truncate max-w-[140px]">{parsedMetadata.bundleId}</p>
                              </div>

                              <div className="bg-slate-950 rounded-xl p-2 border border-slate-800/80 text-[7px] text-slate-400 w-full space-y-1">
                                <div className="flex justify-between">
                                  <span>Version:</span>
                                  <span className="text-slate-300 font-mono">{parsedMetadata.version}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Build:</span>
                                  <span className="text-slate-300 font-mono">{parsedMetadata.build}</span>
                                </div>
                              </div>
                            </div>

                            {/* Button mockup */}
                            <div className="w-full bg-blue-600 text-[8px] font-bold text-white text-center py-2 rounded-lg pointer-events-none mb-1 shadow-md shadow-blue-500/10">
                              アプリをインストールする
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Profile Generator */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  {/* Sub category tabs */}
                  <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-900">
                    <button
                      onClick={() => setProfileSubTab(ProfileType.WEB_CLIP)}
                      className={`flex-grow md:flex-none text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        profileSubTab === ProfileType.WEB_CLIP
                          ? "bg-slate-900 border border-slate-850 text-blue-400 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Web Clip
                    </button>
                    <button
                      onClick={() => setProfileSubTab(ProfileType.WIFI)}
                      className={`flex-grow md:flex-none text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        profileSubTab === ProfileType.WIFI
                          ? "bg-slate-900 border border-slate-850 text-blue-400 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      Wi-Fi設定
                    </button>
                    <button
                      onClick={() => setProfileSubTab(ProfileType.VPN)}
                      className={`flex-grow md:flex-none text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        profileSubTab === ProfileType.VPN
                          ? "bg-slate-900 border border-slate-850 text-blue-400 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      VPN設定
                    </button>
                    <button
                      onClick={() => setProfileSubTab(ProfileType.PASSCODE)}
                      className={`flex-grow md:flex-none text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        profileSubTab === ProfileType.PASSCODE
                          ? "bg-slate-900 border border-slate-850 text-blue-400 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      パスコード
                    </button>
                    <button
                      onClick={() => setProfileSubTab(ProfileType.MDM)}
                      className={`flex-grow md:flex-none text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        profileSubTab === ProfileType.MDM
                          ? "bg-slate-900 border border-slate-850 text-blue-400 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" />
                      MDM登録
                    </button>
                    <button
                      onClick={() => setProfileSubTab(ProfileType.CERTIFICATE)}
                      className={`flex-grow md:flex-none text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        profileSubTab === ProfileType.CERTIFICATE
                          ? "bg-slate-900 border border-slate-850 text-blue-400 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      信頼された証明書
                    </button>
                  </div>

                  {/* Forms for each config type */}
                  <div className="bg-slate-950/40 rounded-2xl p-5 border border-slate-900/80 space-y-5">
                    
                    {/* WEB CLIP FORM */}
                    {profileSubTab === ProfileType.WEB_CLIP && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Link2 className="w-4 h-4 text-blue-400" />
                            Web Clip (ホーム画面のショートカット)
                          </h4>
                          {parsedMetadata && (
                            <span className="text-[9px] bg-blue-950 text-blue-400 border border-blue-900/40 px-2 py-0.5 rounded-full font-semibold">
                              IPA情報自動入力中
                            </span>
                          )}
                        </div>

                        {parsedMetadata && (
                          <div className="bg-blue-950/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                              Web Clipの起動動作
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setWebClipActionType("direct")}
                                className={`p-3 rounded-xl border text-left transition duration-200 ${
                                  webClipActionType === "direct"
                                    ? "bg-blue-950/40 border-blue-500/50 text-blue-300"
                                    : "bg-slate-900/50 border-slate-850 text-slate-400 hover:text-slate-300"
                                }`}
                              >
                                <span className="block font-bold text-xs mb-1">📲 管理対象アプリ風・ダイレクト起動 (推奨)</span>
                                <span className="block text-[10px] text-slate-500 leading-relaxed">
                                  ホーム画面に配置されたアプリアイコンをタップすると、中継を介して直接iOSのインストール確認ダイアログが起動します。
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setWebClipActionType("landing")}
                                className={`p-3 rounded-xl border text-left transition duration-200 ${
                                  webClipActionType === "landing"
                                    ? "bg-blue-950/40 border-blue-500/50 text-blue-300"
                                    : "bg-slate-900/50 border-slate-850 text-slate-400 hover:text-slate-300"
                                }`}
                              >
                                <span className="block font-bold text-xs mb-1">🌐 インストール案内ページを開く</span>
                                <span className="block text-[10px] text-slate-500 leading-relaxed">
                                  アイコンをタップすると、Safariを起動して綺麗なインストール案内・手順解説ページ（/install/:id）が開きます。
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">ラベル（アプリアイコン名）</label>
                            <input
                              type="text"
                              value={webClipForm.label}
                              onChange={(e) => setWebClipForm({ ...webClipForm, label: e.target.value })}
                              placeholder="例: 社内システム"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">起動URL（Webサイト、またはインストールページ）</label>
                            <input
                              type="text"
                              value={webClipForm.url}
                              onChange={(e) => setWebClipForm({ ...webClipForm, url: e.target.value })}
                              placeholder="https://example.com"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                            />
                          </div>

                          {/* App Icon selector */}
                          <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-xs text-slate-400 font-medium block">アイコン画像 (PNG推奨)</label>
                            <div className="flex items-center gap-4">
                              {webClipForm.iconBase64 ? (
                                <img 
                                  src={webClipForm.iconBase64} 
                                  className="w-14 h-14 object-cover rounded-[22%] border border-slate-800" 
                                  alt="Preview icon" 
                                />
                              ) : (
                                <div className="w-14 h-14 bg-slate-900 rounded-[22%] border border-slate-800 flex items-center justify-center text-slate-600 text-xs text-center p-1 leading-tight">
                                  未設定
                                </div>
                              )}

                              <div className="space-y-1">
                                <label className="inline-block bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition">
                                  ファイルを選択
                                  <input
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    onChange={handleCustomIconUpload}
                                    className="hidden"
                                  />
                                </label>
                                <p className="text-[10px] text-slate-500">
                                  ※ IPAアップロード時に自動同期されます。別の画像をアップロードすることも可能です。
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Toggle switches for Web Clip options */}
                          <div className="col-span-1 md:col-span-2 pt-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-900">
                            <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer">
                              <span className="text-xs text-slate-300 font-medium">全画面で起動</span>
                              <input
                                type="checkbox"
                                checked={webClipForm.isFullScreen}
                                onChange={(e) => setWebClipForm({ ...webClipForm, isFullScreen: e.target.checked })}
                                className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                              />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer">
                              <span className="text-xs text-slate-300 font-medium">削除可能</span>
                              <input
                                type="checkbox"
                                checked={webClipForm.isRemovable}
                                onChange={(e) => setWebClipForm({ ...webClipForm, isRemovable: e.target.checked })}
                                className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                              />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer">
                              <span className="text-xs text-slate-300 font-medium">光沢効果なし</span>
                              <input
                                type="checkbox"
                                checked={webClipForm.precomposedIcon}
                                onChange={(e) => setWebClipForm({ ...webClipForm, precomposedIcon: e.target.checked })}
                                className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* WI-FI FORM */}
                    {profileSubTab === ProfileType.WIFI && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Wifi className="w-4 h-4 text-blue-400" />
                          Wi-Fi 接続プロファイル設定
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">SSID（ネットワーク名）</label>
                            <input
                              type="text"
                              value={wifiForm.ssid}
                              onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })}
                              placeholder="例: Office-WiFi"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">セキュリティタイプ</label>
                            <select
                              value={wifiForm.securityType}
                              onChange={(e: any) => setWifiForm({ ...wifiForm, securityType: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            >
                              <option value="WPA">WPA / WPA2 パーソナル</option>
                              <option value="WEP">WEP</option>
                              <option value="None">なし (オープンネットワーク)</option>
                            </select>
                          </div>

                          {wifiForm.securityType !== "None" && (
                            <div className="col-span-1 md:col-span-2 space-y-1.5">
                              <label className="text-xs text-slate-400 font-medium">パスワード</label>
                              <input
                                type="password"
                                value={wifiForm.password || ""}
                                onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })}
                                placeholder="Wi-Fiパスワード"
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                              />
                            </div>
                          )}

                          <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-900">
                            <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer">
                              <span className="text-xs text-slate-300 font-medium">エリア内に入ったとき自動接続</span>
                              <input
                                type="checkbox"
                                checked={wifiForm.autoJoin}
                                onChange={(e) => setWifiForm({ ...wifiForm, autoJoin: e.target.checked })}
                                className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VPN FORM */}
                    {profileSubTab === ProfileType.VPN && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Compass className="w-4 h-4 text-blue-400" />
                          VPN (L2TP/PPTP/IPSec) 接続プロファイル設定
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">表示名（接続名）</label>
                            <input
                              type="text"
                              value={vpnForm.connectionName}
                              onChange={(e) => setVPNForm({ ...vpnForm, connectionName: e.target.value })}
                              placeholder="例: 社内イントラ"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">接続タイプ</label>
                            <select
                              value={vpnForm.connectionType}
                              onChange={(e: any) => setVPNForm({ ...vpnForm, connectionType: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            >
                              <option value="IPSec">IPSec (Cisco)</option>
                              <option value="L2TP">L2TP / IPSec</option>
                              <option value="PPTP">PPTP</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">サーバーアドレス（FQDN または IP）</label>
                            <input
                              type="text"
                              value={vpnForm.serverAddress}
                              onChange={(e) => setVPNForm({ ...vpnForm, serverAddress: e.target.value })}
                              placeholder="vpn.example.com"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">アカウント</label>
                            <input
                              type="text"
                              value={vpnForm.account}
                              onChange={(e) => setVPNForm({ ...vpnForm, account: e.target.value })}
                              placeholder="ユーザー名"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PASSCODE POLICY FORM */}
                    {profileSubTab === ProfileType.PASSCODE && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-blue-400" />
                          デバイスのパスコード制限ポリシー設定
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer">
                            <span className="text-xs text-slate-300 font-medium">パスコードの入力を強制</span>
                            <input
                              type="checkbox"
                              checked={passcodeForm.requirePasscode}
                              onChange={(e) => setPasscodeForm({ ...passcodeForm, requirePasscode: e.target.checked })}
                              className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                            />
                          </label>

                          <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer">
                            <span className="text-xs text-slate-300 font-medium">簡単なパスコード(1111等)を許可</span>
                            <input
                              type="checkbox"
                              checked={passcodeForm.allowSimple}
                              onChange={(e) => setPasscodeForm({ ...passcodeForm, allowSimple: e.target.checked })}
                              className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                            />
                          </label>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">最小文字数</label>
                            <input
                              type="number"
                              min="4"
                              max="16"
                              value={passcodeForm.minLength}
                              onChange={(e) => setPasscodeForm({ ...passcodeForm, minLength: parseInt(e.target.value) || 4 })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">最大連続失敗回数（超えるとロック）</label>
                            <input
                              type="number"
                              min="3"
                              max="10"
                              value={passcodeForm.maxFailedAttempts}
                              onChange={(e) => setPasscodeForm({ ...passcodeForm, maxFailedAttempts: parseInt(e.target.value) || 5 })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MDM REGISTRATION FORM */}
                    {profileSubTab === ProfileType.MDM && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Server className="w-4 h-4 text-blue-400" />
                            MDM (Mobile Device Management) 登録プロファイル設定
                          </h4>
                          <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-2 py-0.5 rounded-full font-semibold">
                            エンタープライズ
                          </span>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 text-xs text-slate-400 leading-relaxed space-y-2">
                          <p>
                            💡 <strong>MDMサーバー登録とは:</strong> iOSデバイスをMDMサーバの管理下に置くための構成プロファイルです。登録されると、管理者からアプリ（IPA）の遠隔配信や、デバイスのサイレントインストール、セキュリティポリシーの強制が可能になります。
                          </p>
                          <p className="text-[10px] text-slate-500">
                            ※ 実際にデバイスに適用して通信を確立させるには、有効なAPNsプッシュ証明書(Apple Push Notification service)が組み込まれたMDMサーバーが必要です。
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 col-span-1 md:col-span-2">
                            <label className="text-xs text-slate-400 font-medium">MDM サーバー URL</label>
                            <input
                              type="text"
                              value={mdmForm.serverUrl}
                              onChange={(e) => setMDMForm({ ...mdmForm, serverUrl: e.target.value })}
                              placeholder="https://mdm.example.com/server"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">チェックイン URL (デバイス確認用)</label>
                            <input
                              type="text"
                              value={mdmForm.checkInUrl}
                              onChange={(e) => setMDMForm({ ...mdmForm, checkInUrl: e.target.value })}
                              placeholder="https://mdm.example.com/checkin"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">APNs Topic (バンドルID形式)</label>
                            <input
                              type="text"
                              value={mdmForm.topic}
                              onChange={(e) => setMDMForm({ ...mdmForm, topic: e.target.value })}
                              placeholder="com.apple.mgmt.External.xxxx"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">アクセス権限マスク (Access Rights)</label>
                            <input
                              type="number"
                              value={mdmForm.accessRights}
                              onChange={(e) => setMDMForm({ ...mdmForm, accessRights: parseInt(e.target.value) || 8191 })}
                              placeholder="8191"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none font-mono"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-900 cursor-pointer col-span-1">
                            <span className="text-xs text-slate-300 font-medium">メッセージ署名を強制 (Sign Message)</span>
                            <input
                              type="checkbox"
                              checked={mdmForm.signMessage}
                              onChange={(e) => setMDMForm({ ...mdmForm, signMessage: e.target.checked })}
                              className="rounded border-slate-800 text-blue-600 focus:ring-blue-500/30 w-4 h-4"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TRUSTED CERTIFICATE FORM */}
                    {profileSubTab === ProfileType.CERTIFICATE && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Key className="w-4 h-4 text-blue-400" />
                            信頼されたエージェント / ルート証明書設定
                          </h4>
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded-full font-semibold">
                            セキュリティ
                          </span>
                        </div>

                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 text-xs text-slate-400 leading-relaxed space-y-2">
                          <p>
                            🔐 <strong>ルート証明書プロファイルとは:</strong> iOSに信頼された認証局（CA）の証明書を追加し、社内開発やアドホック、エンタープライズ署名のアプリ（IPA）をスムーズに検証・実行できるようにするためのプロファイルです。
                          </p>
                          <p className="text-[10px] text-slate-500">
                            ※ インストール後、iOSの <strong>[設定] &gt; [一般] &gt; [情報] &gt; [証明書信頼設定]</strong> にて追加した証明書の信頼を有効化してください。
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">証明書の表示名 (Common Name)</label>
                            <input
                              type="text"
                              value={certificateForm.displayName}
                              onChange={(e) => setCertificateForm({ ...certificateForm, displayName: e.target.value })}
                              placeholder="例: Company Private Root CA"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium block">証明書ファイルアップロード (.cer / .crt / .pem / .der)</label>
                            <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                              <label className="inline-block bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition">
                                証明書を選択
                                <input
                                  type="file"
                                  accept=".cer,.crt,.pem,.der"
                                  onChange={handleCertFileUpload}
                                  className="hidden"
                                />
                              </label>
                              <span className="text-xs text-slate-500">
                                ローカルの署名鍵や、社内サーバーのルートCA証明書をそのままインポートできます。
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex justify-between">
                              <span>証明書データ (Base64 DERエンコード)</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCertificateForm({
                                    ...certificateForm,
                                    certificateBase64: "MIIBiTCCATKgAwIBAgIRAMXoXgAAAAAAxSBmNlcnQwDQYJKoZIhvcNAQELBQAwHjEcMBoGA1UEAxMTRW50ZXJwcmlzZSBUcnVzdCBDQTAeFw0yNjA2MzAwNjI0MDBaFw0zNjA2MzAwNjI0MDBaMB4xHDAaBgNVBAMTE0VudGVycHJpc2UgVHJ1c3QgQ0EwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAL71a4vP7iE1mD9Z..."
                                  });
                                  showToast("テスト用の自己署名ダミー証明書を自動生成しました！", "info");
                                }}
                                className="text-[10px] text-blue-400 hover:underline font-semibold"
                              >
                                🧪 テスト用ダミー証明書を自動作成
                              </button>
                            </label>
                            <textarea
                              rows={5}
                              value={certificateForm.certificateBase64}
                              onChange={(e) => setCertificateForm({ ...certificateForm, certificateBase64: e.target.value })}
                              placeholder="MIIB..."
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-[10px] text-slate-400 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-0 resize-y"
                            />
                          </div>
                        </div>
                      </div>
                    )}
         

                    {/* Download profile Action Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleGenerateProfile}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-5 rounded-xl shadow-lg shadow-blue-500/10 transition active:scale-98 flex items-center justify-center gap-2 text-xs"
                      >
                        <Download className="w-4 h-4" />
                        構成プロファイル (.mobileconfig) を生成してダウンロード
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Full-width staged history list */}
        <div id="staged" className="lg:col-span-12 mt-6">
          <div className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                サーバーに一時配置された配信パッケージ一覧
              </h2>
              <button 
                onClick={fetchStagedApps}
                disabled={loadingHistory}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-900 hover:border-slate-800 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>更新</span>
              </button>
            </div>

            {loadingHistory && stagedApps.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                パッケージ履歴を読み込み中...
              </div>
            ) : stagedApps.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-850 rounded-2xl">
                アクティブなパッケージはありません。IPAをアップロードすると自動でここに登録されます。
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stagedApps.map((app) => (
                    <div 
                      key={app.id} 
                      className="bg-slate-950/80 border border-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-slate-800 transition"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {app.iconUrl ? (
                          <img 
                            src={app.iconUrl} 
                            className="w-12 h-12 object-cover rounded-[22%] shadow border border-slate-900 shrink-0" 
                            alt={`${app.appName} icon`} 
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[22%] flex items-center justify-center text-white font-bold text-lg shrink-0">
                            {app.appName.substring(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate leading-snug">{app.appName}</h4>
                          <p className="text-[10px] text-slate-500 truncate font-mono">{app.bundleId}</p>
                          <div className="flex gap-2 items-center text-[10px] text-slate-400 mt-1 flex-wrap">
                            <span className="bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded">v{app.version}</span>
                            {app.parsingFailed && (
                              <span className="bg-amber-950/80 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase">
                                要補正
                              </span>
                            )}
                            <span>&bull;</span>
                            <span>{new Date(app.uploadedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Open install landing page */}
                        <a
                          href={`/install/${app.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-white border border-transparent hover:border-slate-850 transition flex items-center justify-center"
                          title="インストールページを表示"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Quick copy install link */}
                        <button
                          onClick={() => copyText(`${window.location.origin}/install/${app.id}`, "インストールURL")}
                          className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-white border border-transparent hover:border-slate-850 transition flex items-center justify-center"
                          title="リンクをコピー"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Set as active parsed model */}
                        <button
                          onClick={() => {
                            setParsedMetadata(app);
                            showToast(`「${app.appName}」の情報をワークスペースに展開しました。`);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-blue-400 border border-transparent hover:border-slate-850 transition flex items-center justify-center font-bold text-xs"
                          title="ワークスペースに読み込む"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteApp(app.id, app.appName)}
                          className="p-2 hover:bg-slate-900 hover:text-red-400 rounded-xl text-slate-500 border border-transparent hover:border-slate-850 transition flex items-center justify-center"
                          title="パッケージを削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 justify-center mt-4">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>※ サーバー上のファイルは、ディスク容量の最適化のためアップロードから <strong>24時間後</strong> に自動的に完全削除されます。</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>&copy; iOS Profile &amp; OTA Generator &bull; Built with Google AI Studio Build</p>
      </footer>
    </div>
  );
}
