import { UpdateType, type Config, type RegistryConfig } from "./config";
import { Client } from "./http";
import { Registry } from "./registry";
import type { IClient } from "./types/http";
import type { Image } from "./types/image";
import type { IRegistry } from "./types/registry";
import semver from "semver";

export class Cup {
  private client: IClient;
  private config: Config = { registries: [] };

  constructor(config?: Config) {
    if (config) {
      this.config = config;
    }
    this.client = new Client();
  }

  public async check(
    registry: string,
    owner: string,
    repo: string,
    tag: string,
    localDigests: string[],
    ignoreUpdateType: UpdateType = UpdateType.None
  ): Promise<Image | null> {
    var registryInstance: IRegistry;
    var registryConfig: RegistryConfig | undefined = undefined;

    registryConfig = this.config.registries.find((r) => r.host === registry);

    if (!registryConfig) {
      registryConfig = {
        host: registry,
        insecure: false,
      };
    }

    registryInstance = new Registry(this.client, registryConfig);

    const image: Image = {
      parts: {
        registry: registry,
        repository: `${owner}/${repo}`,
        tag: tag,
      },
      digestInfo: {
        localDigests: localDigests,
      },
    };

    const authURL = await registryInstance.getAuthURL();

    if (authURL) {
      const token = await registryInstance.getToken(authURL, [image]);
      if (token) {
        registryInstance.setToken(token);
      }
    }

    return await registryInstance.getLatestTag(
      image,
      {
        major: semver.major(tag),
        minor: semver.minor(tag),
        patch: semver.patch(tag),
      },
      ignoreUpdateType
    );
  }
}
