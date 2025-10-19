import type { Parts } from "./parts";
import type { Version } from "./version";

export interface DigestInfo {
  localDigests: string[];
  remoteDigest?: string;
}

export interface VersionInfo {
  currentTag: Version;
  latestRemoteTag?: Version;
}

export interface Image {
  parts: Parts;
  digestInfo?: DigestInfo;
  versionInfo?: VersionInfo;
  error?: string;
}
