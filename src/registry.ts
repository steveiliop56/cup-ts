import semver from "semver";
import { UpdateType, type RegistryConfig } from "./config";
import type { ClientImplementation } from "./types/http";
import type { Image } from "./types/image";
import type { GetExtraTags } from "./types/registry";
import type { Version } from "./types/version";
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

export async function getToken(
  images: Image[],
  authUrl: string,
  credentials: string | null,
  client: ClientImplementation
): Promise<string> {
  try {
    var params: string[] = [];

    for (const image of images) {
      params.push(`&scope=repository:${image.parts.registry}:pull`);
    }

    const headers: Record<string, string> = {
      Authorization: credentials ?? "",
    };

    const res = await client.get(
      `${authUrl}${params.join("")}`,
      headers,
      false
    );

    if (!res.response) {
      throw new Error(res.message ?? "failed to fetch token");
    }

    const data = (await res.response.json()) as { token: string };

    return data.token;
  } catch (e) {
    throw new Error((e as Error).message);
  }
}

export async function getLatestTag(
  image: Image,
  base: Version,
  token: string | null,
  client: ClientImplementation,
  registryConfig: Map<string, RegistryConfig>,
  ignoreUpdateType: UpdateType = UpdateType.None
): Promise<Image> {
  try {
    const protocol = getProtocol(image.parts.registry, registryConfig);
    const url = `${protocol}://${image.parts.registry}/v2/${image.parts.registry}/tags/list`;
    const authorization = toBearerAuth(token);
    const headers: Record<string, string> = {
      Authorization: authorization ?? "",
      Accept: "application/json",
    };

    var tags: Version[] = [];
    var nextUrl: string = url;

    while (nextUrl) {
      const extraTagsRes = await getExtraTags(
        nextUrl,
        headers,
        base,
        client,
        ignoreUpdateType
      );

      if (typeof extraTagsRes === "string") {
        return { ...image, error: extraTagsRes };
      }

      tags = tags.concat(extraTagsRes.versions);
      nextUrl = extraTagsRes.nextUrl ?? "";
    }

    for (const tag of tags) {
      if (tag === base && image.digestInfo) {
        const latestDigest = await getLatestDigest(
          image,
          token,
          client,
          registryConfig
        );
        return latestDigest;
      }

      return {
        ...image,
        versionInfo: {
          latestRemoteTag: tag,
          currentTag: base,
          formatStr: `v${tag.major}.${tag.minor}.${tag.patch}`,
        },
      };
    }

    return { ...image, error: "no newer tag found" };
  } catch (e) {
    return { ...image, error: (e as Error).message };
  }
}

export async function getExtraTags(
  url: string,
  headers: Record<string, string>,
  base: Version,
  client: ClientImplementation,
  ignoreUpdateType: UpdateType = UpdateType.None
): Promise<GetExtraTags | string> {
  try {
    const res = await client.get(url, headers, false);

    if (!res.response) {
      return res.message ?? "failed to fetch tags";
    }

    const nextUrl = res.response.headers.get("link");
    const data = (await res.response.json()) as { tags: string[] };

    // instead of using cup's regex to match, we will just use the official semver package
    var versions: Version[] = [];

    for (const tag of data.tags) {
      // i guess we just skip invalid semver tags
      if (!semver.valid(tag)) {
        continue;
      }

      versions.push({
        major: semver.major(tag),
        minor: semver.minor(tag),
        patch: semver.patch(tag),
      });
    }

    // lines 236-242 probably translate to this
    versions.filter((v) => {
      if (
        !(base.patch !== undefined && v.patch === undefined) ||
        !(base.patch === undefined && v.patch === undefined)
      ) {
        return false;
      }

      if (
        !(base.minor !== undefined && v.minor === undefined) ||
        !(base.minor === undefined && v.minor === undefined)
      ) {
        return false;
      }

      return true;
    });

    versions.filter((v) => {
      switch (ignoreUpdateType) {
        case UpdateType.Major:
          return v.major === base.major;
        case UpdateType.Minor:
          return v.major === base.major && v.minor === base.minor;
        case UpdateType.Patch:
          return (
            v.major === base.major &&
            v.minor === base.minor &&
            v.patch === base.patch
          );
        case UpdateType.None:
        default:
          return true;
      }
    });

    return {
      versions: versions,
      nextUrl: nextUrl,
    };
  } catch (e) {
    return (e as Error).message;
  }
}
