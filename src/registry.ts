import type { RegistryConfig } from "./config";
import type { ClientImplementation } from "./types/http";
import type { Image } from "./types/image";
import {
  getProtocol,
  parseWWWAuthenticate,
  toBearerAuth,
} from "./utils/request";

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

export async function getLatestDigest(
  image: Image,
  token: string | null,
  client: ClientImplementation,
  registryConfig: Map<string, RegistryConfig>
): Promise<Image> {
  try {
    const protocol = getProtocol(image.parts.registry, registryConfig);
    const url = `${protocol}://${image.parts.registry}/v2/${image.parts.registry}/manifests/${image.parts.tag}`;
    const authorization = toBearerAuth(token);
    const headers: Record<string, string> = {
      Accept:
        "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json",
      Authorization: authorization ?? "",
    };
    const res = await client.head(url, headers);

    if (!res.response) {
      return { ...image, error: res.message ?? "failed to fetch manifest" };
    }

    const remoteDigests = res.response.headers.get("docker-content-digest");

    return {
      ...image,
      digestInfo: {
        localDigests: image.digestInfo?.localDigests ?? [],
        remoteDigest: remoteDigests ?? undefined,
      },
    };
  } catch (e) {
    return { ...image, error: (e as Error).message };
  }
}
