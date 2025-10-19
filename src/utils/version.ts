import semver from "semver";

export const formatVersion = (version: string): string => {
  const hasVPrefix = version.startsWith("v");
  const coerced = semver.coerce(version);
  if (!coerced) {
    return version;
  }
  return hasVPrefix ? `v${coerced.version}` : coerced.version;
};
