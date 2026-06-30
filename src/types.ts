export interface AppMetadata {
  id: string;
  originalName: string;
  appName: string;
  bundleId: string;
  version: string;
  build: string;
  iconUrl: string;
  ipaUrl: string;
  uploadedAt: string;
  parsingFailed?: boolean;
}

export enum ProfileType {
  WEB_CLIP = "WEB_CLIP",
  WIFI = "WIFI",
  VPN = "VPN",
  PASSCODE = "PASSCODE",
  MDM = "MDM",
  CERTIFICATE = "CERTIFICATE",
}

export interface WebClipConfig {
  label: string;
  url: string;
  iconBase64: string; // From IPA or custom upload
  isFullScreen: boolean;
  isRemovable: boolean;
  precomposedIcon: boolean;
}

export interface WiFiConfig {
  ssid: string;
  securityType: "WEP" | "WPA" | "None";
  password?: string;
  autoJoin: boolean;
}

export interface VPNConfig {
  connectionName: string;
  connectionType: "L2TP" | "PPTP" | "IPSec";
  serverAddress: string;
  account: string;
}

export interface PasscodeConfig {
  requirePasscode: boolean;
  minLength: number;
  maxFailedAttempts: number;
  allowSimple: boolean;
}

export interface MDMConfig {
  serverUrl: string;
  checkInUrl: string;
  topic: string;
  accessRights: number;
  signMessage: boolean;
}

export interface CertificateConfig {
  displayName: string;
  certificateBase64: string;
}
