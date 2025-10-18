export interface RegistryConfig {
  authentication?: string;
  insecure: boolean;
  ignore: boolean;
}

export enum UpdateType {
  None,
  Major,
  Minor,
  Patch,
}
