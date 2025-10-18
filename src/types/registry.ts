import type { Version } from "./version";

export interface GetExtraTags {
  versions: Version[];
  nextUrl: string | null;
}
