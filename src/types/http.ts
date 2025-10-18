export enum RequestMethod {
  GET = "GET",
  HEAD = "HEAD",
}

export interface RequestResult {
  response: Response | null;
  message: string | null;
}

export interface ClientImplementation {
  get(
    url: string,
    headers: Record<string, string>,
    ignore_401: boolean
  ): Promise<RequestResult>;
  head(url: string, headers: Record<string, string>): Promise<RequestResult>;
}
