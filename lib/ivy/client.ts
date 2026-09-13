import { IVY_API_BASE_URL, getIvyApiKey } from "./config";

export class IvyApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(
      `Ivy API request failed with ${status}: ${
        typeof detail === "string" ? detail : JSON.stringify(detail)
      }`
    );
    this.status = status;
    this.detail = detail;
  }
}

interface IvyRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  /** The end-user's session access token, if the call needs one. */
  accessToken?: string;
  body?: unknown;
  /** Query params to append; undefined/null values are skipped. */
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, params?: IvyRequestOptions["params"]): URL {
  const url = new URL(IVY_API_BASE_URL + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

/**
 * Calls the live Ivy API. The API key travels only as the X-API-Key header
 * (the documented ?api_key= query parameter is rejected by the live API —
 * see analysis/INVESTIGATION_LOG.md). This function only ever runs on the
 * server; the key never reaches the browser.
 */
export async function ivyFetch<T>(
  path: string,
  options: IvyRequestOptions = {}
): Promise<T> {
  const { method = "GET", accessToken, body, params } = options;
  const url = buildUrl(path, params);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Key": getIvyApiKey(),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new IvyApiError(res.status, data?.detail ?? data);
  }

  return data as T;
}
