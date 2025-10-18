import type { RegistryConfig } from "../config";

export function getProtocol(
  registry: string,
  registryConfig: Map<string, RegistryConfig>
): string {
  const config = registryConfig.keys().find((key) => key === registry);

  if (!config) {
    return "https";
  }

  if (registryConfig.get(config)?.insecure) {
    return "http";
  }

  return "https";
}

// custom implementation
export function parseWWWAuthenticate(wwwAuth: string): string {
  const bearerMatch = wwwAuth.match(/^Bearer\s+/);

  if (!bearerMatch) {
    throw new Error("unsupported authentication scheme");
  }

  const realmMatch = wwwAuth.match(/realm="(.*?)"/);

  if (!realmMatch || realmMatch[1] === undefined) {
    throw new Error("realm not found in www-authenticate header");
  }

  return realmMatch[1];
}
