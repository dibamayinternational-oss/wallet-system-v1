/**
 * Central API client for the existing wallet-system-v1 FastAPI backend.
 * Access tokens live in memory only. This backend does not implement refresh/logout
 * endpoints, so a page reload requires the user to sign in again.
 */
const BASE = "/api/v1";

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const setOnAuthLost = (fn: (() => void) | null) => {
  onAuthLost = fn;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Options {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  idempotencyKey?: string;
  /** Set false for login/register requests, which are allowed to return 401. */
  auth?: boolean;
}

function buildUrl(path: string, query?: Options["query"]) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let response: Response;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  if (opts.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    response = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Cannot reach MayPay. Make sure the backend is running and try again.",
    );
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = data && typeof data === "object"
      ? data as Record<string, unknown>
      : {};
    const nestedError = payload.error && typeof payload.error === "object"
      ? payload.error as Record<string, unknown>
      : {};

    let message = "Something went wrong. Please try again.";
    if (typeof payload.detail === "string") {
      message = payload.detail;
    } else if (Array.isArray(payload.detail)) {
      message = payload.detail
        .map((item) => {
          if (!item || typeof item !== "object") return String(item);
          const issue = item as Record<string, unknown>;
          const location = Array.isArray(issue.loc) ? issue.loc.join(" → ") : "Input";
          return `${location}: ${String(issue.msg ?? "Invalid value")}`;
        })
        .join(". ");
    } else if (typeof nestedError.message === "string") {
      message = nestedError.message;
    }

    const code = typeof nestedError.code === "string"
      ? nestedError.code
      : `HTTP_${response.status}`;

    if (response.status === 401 && opts.auth !== false) {
      accessToken = null;
      onAuthLost?.();
    }

    throw new ApiError(response.status, code, message, {});
  }

  return data as T;
}
