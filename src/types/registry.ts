import type { UpdateType } from "../config";
import type { Image } from "./image";
import type { Version } from "./version";

export interface GetExtraTags {
  versions: Version[];
  nextUrl: string | null;
}

export interface IRegistry {
  setToken(token: string): void;
  getAuthURL(): Promise<string | null>;
  getToken(authURL: string, images: Image[]): Promise<string | null>;
  getLatestDigest(image: Image): Promise<Image>;
  getExtraTags(
    url: string,
    base: Version,
    headers: Record<string, string>,
    ignoreUpdateType?: UpdateType
  ): Promise<GetExtraTags | null>;
  getLatestTag(
    image: Image,
    base: Version,
    ignoreUpdateType?: UpdateType
  ): Promise<Image>;
}
