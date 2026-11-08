import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  apiGet,
  apiGetBlob,
  apiPostForm,
  apiPostFormForBlob,
  apiPostJsonForBlob,
} from "@/services/api-client";

vi.mock("@/config/env", () => ({ env: { apiBaseUrl: "https://api.example.test/api/v1" } }));

const fetchMock = vi.fn<typeof fetch>();
const requests = [
  { name: "GET JSON", send: (init?: RequestInit) => apiGet("/test", init) },
  { name: "GET blob", send: (init?: RequestInit) => apiGetBlob("/test", init) },
  { name: "POST form JSON", send: (init?: RequestInit) => apiPostForm("/test", new FormData(), init) },
  { name: "POST form blob", send: (init?: RequestInit) => apiPostFormForBlob("/test", new FormData(), init) },
  { name: "POST JSON blob", send: (init?: RequestInit) => apiPostJsonForBlob("/test", { value: 1 }, init) },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe.each(requests)("$name", ({ send }) => {
  it("preserves structured API errors", async () => {
    const body = { error: "FileParseError", message: "Could not parse file." };
    fetchMock.mockResolvedValue(Response.json(body, { status: 422 }));

    await expect(send()).rejects.toMatchObject({
      name: "ApiError", status: 422, body, message: body.message,
    });
  });

  it.each(["<html>Bad gateway</html>", "null", '{"message":123}', '{"detail":[]}'])(
    "handles malformed or non-domain error bodies: %s",
    async (body) => {
      fetchMock.mockResolvedValue(new Response(body, { status: 502 }));

      await expect(send()).rejects.toEqual(
        new ApiError(502, null, "Request to /test failed with status 502.")
      );
    }
  );

  it("preserves request options and propagates network failures", async () => {
    const controller = new AbortController();
    const error = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(error);

    await expect(send({ signal: controller.signal, credentials: "include" })).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/test",
      expect.objectContaining({ signal: controller.signal, credentials: "include" })
    );
  });

  it("propagates cancellation without wrapping it in an API error", async () => {
    const error = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(error);
    await expect(send()).rejects.toBe(error);
  });
});

describe("successful requests", () => {
  it.each<HeadersInit>([
    { "X-Request-Id": "123", accept: "application/custom+json" },
    new Headers({ "X-Request-Id": "123", accept: "application/custom+json" }),
    [["X-Request-Id", "123"], ["accept", "application/custom+json"]],
  ])("merges caller headers in every supported representation", async (headers) => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await expect(apiGet("/test", { headers, method: "DELETE" })).resolves.toEqual({ ok: true });

    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("accept")).toBe("application/custom+json");
    expect(new Headers(init?.headers).get("x-request-id")).toBe("123");
  });

  it("leaves multipart content-type boundaries to the browser", async () => {
    const form = new FormData();
    form.append("name", "example");
    fetchMock.mockResolvedValue(Response.json({ file_id: "123" }));

    await expect(apiPostForm("/test", form)).resolves.toEqual({ file_id: "123" });
    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBe(form);
    expect(new Headers(init?.headers).get("content-type")).toBeNull();
    expect(new Headers(init?.headers).get("accept")).toBe("application/json");
  });

  it("returns binary content and download metadata unchanged", async () => {
    fetchMock.mockResolvedValue(new Response("data", { headers: { "X-Row-Count": "3" } }));
    const { blob, headers } = await apiPostFormForBlob("/test", new FormData());
    expect(await blob.text()).toBe("data");
    expect(headers.get("x-row-count")).toBe("3");
  });

  it("serializes JSON and preserves custom headers for binary exports", async () => {
    fetchMock.mockResolvedValue(new Response("report"));
    const blob = await apiPostJsonForBlob("/test", { value: 1 }, { headers: new Headers({ "X-Request-Id": "123" }) });
    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBe('{"value":1}');
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(new Headers(init?.headers).get("x-request-id")).toBe("123");
    expect(await blob.text()).toBe("report");
  });
});