import type { RegistryConfig } from "./config";
import type { ClientImplementation } from "./types/http";
import { getProtocol, parseWWWAuthenticate } from "./utils/request";

export async function checkAuth(
  registryConfig: Map<string, RegistryConfig>,
  registry: string,
  client: ClientImplementation
): Promise<string | null> {
  const protocol = getProtocol(registry, registryConfig);
  const url = `${protocol}://${registry}/v2/`;
  const res = await client.get(url, {}, true);

  if (!res.response) {
    return null;
  }

  if (res.response.status === 401) {
    const wwwAuth = res.response.headers.get("www-authenticate");
    return parseWWWAuthenticate(wwwAuth ?? "");
  }

  return null;
}
