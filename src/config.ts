export interface RegistryConfig {
  insecure: boolean;
  host: string;
  username?: string;
  password?: string;
}

export enum UpdateType {
  None,
  Major,
  Minor,
  Patch,
}
