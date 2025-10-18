import type { Parts } from "./parts";
import type { Version } from "./version";

export interface DigestInfo {
  localDigests: string[];
  remoteDigest?: string;
}

export interface VersionInfo {
  currentTag: Version;
  latestRemoteTag?: Version;
  formatStr: string;
}

export interface Image {
  reference: string;
  parts: Parts;
  url?: string;
  digestInfo?: DigestInfo;
  versionInfo?: VersionInfo;
  error?: string;
}
