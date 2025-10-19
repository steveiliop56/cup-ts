import semver from "semver";
import { UpdateType, type RegistryConfig } from "./config";
import type { IClient } from "./types/http";
import type { Image } from "./types/image";
import type { GetExtraTags, IRegistry } from "./types/registry";
import type { Version } from "./types/version";
import {
  parseWWWAuthenticate,
  toBasicAuth,
  toBearerAuth,
} from "./utils/request";

export class Registry implements IRegistry {
  private client: IClient;
  private config: RegistryConfig;
  private maxPages: number;
  private token: string | null = null;

  constructor(client: IClient, config: RegistryConfig, maxPages: number = 10) {
    this.config = config;
    this.client = client;
    this.maxPages = maxPages;
  }

  private getProtocol(): string {
    return this.config.insecure ? "http" : "https";
  }

  public setToken(token: string): void {
    this.token = token;
  }

  public async getAuthURL(): Promise<string | null> {
    const protocol = this.getProtocol();
    const url = `${protocol}://${this.config.host}/v2/`;
    const res = await this.client.get(url, {}, true);

    if (!res.response) {
      return null;
    }

    if (res.response.status === 401) {
      const wwwAuth = res.response.headers.get("www-authenticate");
      return parseWWWAuthenticate(wwwAuth ?? "");
    }

    return null;
  }

  public async getToken(
    authURL: string,
    images: Image[]
  ): Promise<string | null> {
    var params: string[] = [];

    for (const image of images) {
      params.push(`?scope=repository:${image.parts.repository}:pull`);
    }

    const headers: Record<string, string> = {
      Authorization:
        toBasicAuth(this.config.username ?? "", this.config.password ?? "") ??
        "",
    };

    const res = await this.client.get(
      `${authURL}${params.join("")}`,
      headers,
      false
    );

    if (!res.response) {
      return null;
    }

    const data = (await res.response.json()) as { token: string };

    return data.token;
  }

  public async getLatestDigest(image: Image): Promise<Image> {
    const protocol = this.getProtocol();
    const url = `${protocol}://${this.config.host}/v2/${image.parts.repository}/manifests/${image.parts.tag}`;
    const authorization = toBearerAuth(this.token);
    const headers: Record<string, string> = {
      Accept:
        "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json",
      Authorization: authorization ?? "",
    };

    const res = await this.client.head(url, headers);

    if (!res.response) {
      throw new Error("failed to fetch image manifest");
    }

    const remoteDigests = res.response.headers.get("docker-content-digest");

    return {
      ...image,
      digestInfo: {
        localDigests: image.digestInfo?.localDigests ?? [],
        remoteDigest: remoteDigests ?? undefined,
      },
    };
  }

  public async getExtraTags(
    url: string,
    base: Version,
    headers: Record<string, string>,
    ignoreUpdateType: UpdateType = UpdateType.None
  ): Promise<GetExtraTags | null> {
    const res = await this.client.get(url, headers, false);

    if (!res.response) {
      throw new Error("failed to fetch tags");
    }

    var nextUrl: string | null = null;

    const nextUrlRaw = res.response.headers.get("link");

    if (nextUrlRaw) {
      const match = nextUrlRaw.match(/<(.*)>/);
      if (match && match[1]) {
        nextUrl = match[1];
        const page = nextUrl.match(/&n=([0-9]*)/);
        if (page && page[1]) {
          if (page[1] === "0") {
            nextUrl = null;
          }
        }
      }
    }

    const data = (await res.response.json()) as { tags: string[] };

    var versions: Version[] = [];

    for (const tag of data.tags) {
      if (!semver.valid(tag)) {
        continue;
      }
      versions.push({
        major: semver.major(tag),
        minor: semver.minor(tag),
        patch: semver.patch(tag),
      });
    }

    // Filter out duplicate versions (v1.0.0-beta.1 and v1.0.0-beta.2 both map to 1.0.0)
    versions = versions.reduce((acc: Version[], item: Version) => {
      if (
        !acc.find(
          (v) =>
            v.major === item.major &&
            v.minor === item.minor &&
            v.patch === item.patch
        )
      ) {
        acc.push(item);
      }
      return acc;
    }, []);

    versions = versions.filter((v) => {
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
        default:
          return true;
      }
    });

    return {
      versions: versions,
      nextUrl: nextUrl,
    };
  }

  public async getLatestTag(
    image: Image,
    base: Version,
    ignoreUpdateType: UpdateType = UpdateType.None
  ): Promise<Image> {
    const protocol = this.getProtocol();
    const baseUrl = `${protocol}://${this.config.host}`;
    const authorization = toBearerAuth(this.token);
    const headers: Record<string, string> = {
      Authorization: authorization ?? "",
      Accept: "application/json",
    };

    var tags: Version[] = [];
    var nextUrl: string = baseUrl + `/v2/${image.parts.repository}/tags/list`;
    var pages: number = 0;

    while (nextUrl && pages < this.maxPages) {
      const extraTags = await this.getExtraTags(
        nextUrl,
        base,
        headers,
        ignoreUpdateType
      );

      if (!extraTags) {
        throw new Error("failed to fetch extra tags");
      }

      tags = tags.concat(extraTags.versions);
      if (extraTags.nextUrl) {
        nextUrl = baseUrl + extraTags.nextUrl;
      } else {
        nextUrl = "";
      }
      pages += 1;
    }

    for (const tag of tags) {
      if (
        tag.major === base.major &&
        tag.minor === base.minor &&
        tag.patch === base.patch &&
        image.digestInfo
      ) {
        const latestDigest = await this.getLatestDigest(image);
        image = {
          ...latestDigest,
          versionInfo: {
            latestRemoteTag: tag,
            currentTag: base,
          },
        };
      } else {
        image = {
          ...image,
          versionInfo: {
            latestRemoteTag: tag,
            currentTag: base,
          },
        };
      }
    }

    return { ...image };
  }
}
