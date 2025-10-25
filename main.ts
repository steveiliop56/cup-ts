import { Cup, type CheckParams } from "./src/cup";
import type { Image } from "./src/types/image";

const cup: Cup = new Cup();

export async function check(params: CheckParams): Promise<Image | null> {
  return await cup.check(params);
}

