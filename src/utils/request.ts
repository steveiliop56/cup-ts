import type { RegistryConfig } from "../config";

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

export function toBearerAuth(token: string | null): string | null {
  if (!token) {
    return null;
  }
  return `Bearer ${token}`;
}

export function toBasicAuth(
  username: string | null,
  password: string | null
): string | null {
  if (!username || !password) {
    return null;
  }
  return `Basic ${btoa(`${username}:${password}`)}`;
}
