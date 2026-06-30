import { WebClipConfig, WiFiConfig, VPNConfig, PasscodeConfig, MDMConfig, CertificateConfig } from "../types";

// Self-contained UUID generator
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

// Generate outer mobileconfig wrapper
function wrapProfile(payloadContentXml: string, typeName: string, displayName: string, orgName: string = "iOS Profile & OTA Generator"): string {
  const profileUUID = generateUUID();
  const identifier = `com.generator.profile.${typeName.toLowerCase()}.${profileUUID.substring(0, 8)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
${payloadContentXml}
	</array>
	<key>PayloadDisplayName</key>
	<string>${escapeXml(displayName)}</string>
	<key>PayloadIdentifier</key>
	<string>${identifier}</string>
	<key>PayloadOrganization</key>
	<string>${escapeXml(orgName)}</string>
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
}

function escapeXml(unsafe: string): string {
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
}

export function generateWebClipProfile(config: WebClipConfig): string {
  const payloadUUID = generateUUID();
  const identifier = `com.apple.webclip.managed.${payloadUUID.substring(0, 8)}`;
  
  // Clean base64 string
  let iconData = "";
  if (config.iconBase64) {
    iconData = config.iconBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "").trim();
  }

  const payloadXml = `		<dict>
			<key>FullScreen</key>
			<${config.isFullScreen ? "true" : "false"}/>
			<key>Icon</key>
			<data>
				${iconData}
			</data>
			<key>IsRemovable</key>
			<${config.isRemovable ? "true" : "false"}/>
			<key>Label</key>
			<string>${escapeXml(config.label)}</string>
			<key>PayloadDescription</key>
			<string>Web Clip Configuration for ${escapeXml(config.label)}</string>
			<key>PayloadDisplayName</key>
			<string>${escapeXml(config.label)} (Web Clip)</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}</string>
			<key>PayloadType</key>
			<string>com.apple.webclip.managed</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>Precomposed</key>
			<${config.precomposedIcon ? "true" : "false"}/>
			<key>URL</key>
			<string>${escapeXml(config.url)}</string>
		</dict>`;

  return wrapProfile(payloadXml, "WebClip", config.label);
}

export function generateWiFiProfile(config: WiFiConfig): string {
  const payloadUUID = generateUUID();
  const identifier = `com.apple.wifi.managed.${payloadUUID.substring(0, 8)}`;

  const securityXml = config.securityType !== "None" 
    ? `<key>EncryptionType</key>\n			<string>${config.securityType}</string>\n			<key>Password</key>\n			<string>${escapeXml(config.password || "")}</string>`
    : `<key>EncryptionType</key>\n			<string>None</string>`;

  const payloadXml = `		<dict>
			<key>AutoJoin</key>
			<${config.autoJoin ? "true" : "false"}/>
			<key>SSID_STR</key>
			<string>${escapeXml(config.ssid)}</string>
			<key>HIDDEN_NETWORK</key>
			<false/>
			${securityXml}
			<key>PayloadDescription</key>
			<string>Wi-Fi Configuration for ${escapeXml(config.ssid)}</string>
			<key>PayloadDisplayName</key>
			<string>Wi-Fi (${escapeXml(config.ssid)})</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}</string>
			<key>PayloadType</key>
			<string>com.apple.wifi.managed</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>`;

  return wrapProfile(payloadXml, "WiFi", `Wi-Fi - ${config.ssid}`);
}

export function generateVPNProfile(config: VPNConfig): string {
  const payloadUUID = generateUUID();
  const identifier = `com.apple.vpn.managed.${payloadUUID.substring(0, 8)}`;

  const payloadXml = `		<dict>
			<key>UserDefinedName</key>
			<string>${escapeXml(config.connectionName)}</string>
			<key>VPNType</key>
			<string>${config.connectionType}</string>
			<key>IPSec</key>
			<dict>
				<key>RemoteAddress</key>
				<string>${escapeXml(config.serverAddress)}</string>
				<key>XAuthName</key>
				<string>${escapeXml(config.account)}</string>
				<key>AuthenticationMethod</key>
				<string>SharedSecret</string>
			</dict>
			<key>PayloadDescription</key>
			<string>VPN Configuration for ${escapeXml(config.connectionName)}</string>
			<key>PayloadDisplayName</key>
			<string>VPN (${escapeXml(config.connectionName)})</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}</string>
			<key>PayloadType</key>
			<string>com.apple.vpn.managed</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>`;

  return wrapProfile(payloadXml, "VPN", `VPN - ${config.connectionName}`);
}

export function generatePasscodeProfile(config: PasscodeConfig): string {
  const payloadUUID = generateUUID();
  const identifier = `com.apple.mobiledevice.passwordpolicy.${payloadUUID.substring(0, 8)}`;

  const payloadXml = `		<dict>
			<key>forcePIN</key>
			<${config.requirePasscode ? "true" : "false"}/>
			<key>minLength</key>
			<integer>${config.minLength}</integer>
			<key>maxFailedAttempts</key>
			<integer>${config.maxFailedAttempts}</integer>
			<key>allowSimple</key>
			<${config.allowSimple ? "true" : "false"}/>
			<key>PayloadDescription</key>
			<string>Passcode Policy Configuration</string>
			<key>PayloadDisplayName</key>
			<string>Passcode Policy</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}</string>
			<key>PayloadType</key>
			<string>com.apple.mobiledevice.passwordpolicy</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>`;

  return wrapProfile(payloadXml, "Passcode", "Passcode Policy");
}

export function generateMDMProfile(config: MDMConfig): string {
  const payloadUUID = generateUUID();
  const identifier = `com.apple.mdm.${payloadUUID.substring(0, 8)}`;

  const payloadXml = `		<dict>
			<key>ServerURL</key>
			<string>${escapeXml(config.serverUrl)}</string>
			<key>CheckInURL</key>
			<string>${escapeXml(config.checkInUrl)}</string>
			<key>Topic</key>
			<string>${escapeXml(config.topic)}</string>
			<key>IdentityCertificateUUID</key>
			<string>${generateUUID()}</string>
			<key>AccessRights</key>
			<integer>${config.accessRights}</integer>
			<key>SignMessage</key>
			<${config.signMessage ? "true" : "false"}/>
			<key>PayloadDescription</key>
			<string>MDM Server enrollment profile configuration.</string>
			<key>PayloadDisplayName</key>
			<string>MDM Server (${escapeXml(config.topic)})</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}</string>
			<key>PayloadType</key>
			<string>com.apple.mdm</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>`;

  return wrapProfile(payloadXml, "MDM", `MDM - ${config.topic}`);
}

export function generateCertificateProfile(config: CertificateConfig): string {
  const payloadUUID = generateUUID();
  const identifier = `com.apple.security.root.${payloadUUID.substring(0, 8)}`;
  
  // Clean base64 string
  const certData = config.certificateBase64.replace(/^data:.*?;base64,/, "").trim();

  const payloadXml = `		<dict>
			<key>PayloadCertificateFileName</key>
			<string>${escapeXml(config.displayName)}.cer</string>
			<key>PayloadContent</key>
			<data>
				${certData}
			</data>
			<key>PayloadDescription</key>
			<string>Trusted root certificate authority config.</string>
			<key>PayloadDisplayName</key>
			<string>${escapeXml(config.displayName)}</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}</string>
			<key>PayloadType</key>
			<string>com.apple.security.root</string>
			<key>PayloadUUID</key>
			<string>${payloadUUID}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>`;

  return wrapProfile(payloadXml, "Certificate", config.displayName);
}

