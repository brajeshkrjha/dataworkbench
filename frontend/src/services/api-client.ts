/**
 * Minimal fetch wrapper for talking to the DataWorkbench backend API.
 * Centralizes base URL resolution and error handling so individual
 * services don't duplicate fetch/error logic.
 */
import { env } from "@/config/env";
import type { ApiErrorResponse } from "@/types/api";

export class ApiError extends Error {
  status: number;
  body: ApiErrorResponse | null;

  constructor(status: number, body: ApiErrorResponse | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Merge all supported HeadersInit shapes without losing caller overrides. */
function mergeHeaders(defaults: HeadersInit, overrides?: HeadersInit): Headers {
  const headers = new Headers(defaults);
  new Headers(overrides).forEach((value, name) => headers.set(name, value));
  return headers;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

/** One error path for JSON and binary responses; network/abort errors pass through. */
async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, init);

  if (!response.ok) {
    let body: ApiErrorResponse | null = null;
    try {
      const parsed: unknown = await response.json();
      if (isApiErrorResponse(parsed)) body = parsed;
    } catch {
      // Proxies may return non-JSON errors. Keep the HTTP status and fallback message.
    }
    throw new ApiError(
      response.status,
      body,
      body?.message ?? `Request to ${path} failed with status ${response.status}.`
    );
  }

  return response;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    method: "GET",
    headers: mergeHeaders({ Accept: "application/json" }, init?.headers),
  });

  return (await response.json()) as T;
}

/**
 * POST a multipart form and receive a binary file. Returns the blob
 * together with the response headers so callers can read any metadata
 * the backend attaches to the download.
 */
export async function apiPostFormForBlob(
  path: string,
  formData: FormData,
  init?: RequestInit
): Promise<{ blob: Blob; headers: Headers }> {
  const response = await apiFetch(path, {
    ...init,
    method: "POST",
    body: formData,
  });

  return { blob: await response.blob(), headers: response.headers };
}

/**
 * POST a multipart form and receive a JSON response.
 */
export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  init?: RequestInit
): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    method: "POST",
    body: formData,
    headers: mergeHeaders({ Accept: "application/json" }, init?.headers),
  });

  return (await response.json()) as T;
}

/** GET a binary file (e.g. a bulk conversion download or report). */
export async function apiGetBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await apiFetch(path, { ...init, method: "GET" });

  return response.blob();
}

/** POST a JSON body and receive a binary file (e.g. an export report). */
export async function apiPostJsonForBlob(
  path: string,
  jsonBody: unknown,
  init?: RequestInit
): Promise<Blob> {
  const response = await apiFetch(path, {
    ...init,
    method: "POST",
    body: JSON.stringify(jsonBody),
    headers: mergeHeaders({ "Content-Type": "application/json" }, init?.headers),
  });

  return response.blob();
}

