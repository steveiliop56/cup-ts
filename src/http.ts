import { RequestMethod, type IClient, type RequestResult } from "./types/http";

export class Client implements IClient {
  private async request(
    url: string,
    method: RequestMethod,
    headers: Record<string, string>,
    ignore401: boolean
  ): Promise<RequestResult> {
    try {
      const request = new Request(url, {
        method: method,
        headers: headers,
      });

      const response = await fetch(request);

      const status = response.status;

      if (status == 404) {
        return { response: null, message: `${method} ${url}: not found` };
      }

      if (status == 401) {
        if (ignore401) {
          return { response: response, message: null };
        }
        return { response: null, message: `${method} ${url}: unauthorized` };
      }

      if (status == 502) {
        return {
          response: null,
          message: `${method} ${url}: registry unavailable`,
        };
      }

      if (status >= 400) {
        return {
          response: null,
          message: `${method} ${url}: request failed with status ${status}`,
        };
      }

      return { response: response, message: null };
    } catch (e) {
      return { response: null, message: (e as Error).message };
    }
  }

  public async get(
    url: string,
    headers: Record<string, string> = {},
    ignore401: boolean = false
  ): Promise<RequestResult> {
    return this.request(url, RequestMethod.GET, headers, ignore401);
  }

  public async head(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<RequestResult> {
    return this.request(url, RequestMethod.HEAD, headers, false);
  }
}
