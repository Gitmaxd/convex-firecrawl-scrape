/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import {
  validateUrl,
  normalizeUrl,
  hashUrl,
  formatValidationError,
  MAX_URL_LENGTH,
} from "./url.js";

describe("URL validation", () => {
  test("accepts valid http URLs", () => {
    expect(validateUrl("http://example.com")).toEqual({ valid: true });
    expect(validateUrl("http://example.com/path")).toEqual({ valid: true });
    expect(validateUrl("http://example.com/path?query=1")).toEqual({
      valid: true,
    });
  });

  test("accepts valid https URLs", () => {
    expect(validateUrl("https://example.com")).toEqual({ valid: true });
    expect(validateUrl("https://api.example.com/v1/data")).toEqual({
      valid: true,
    });
  });

  test("rejects URLs that are too long", () => {
    const longUrl = "https://example.com/" + "a".repeat(MAX_URL_LENGTH);
    const result = validateUrl(longUrl);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("too_long");
    }
  });

  test("rejects invalid URL formats", () => {
    const result = validateUrl("not a url");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("invalid_url");
    }
  });

  test("rejects non-http(s) schemes", () => {
    expect(validateUrl("ftp://example.com").valid).toBe(false);
    expect(validateUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateUrl("javascript:alert(1)").valid).toBe(false);
  });

  test("rejects localhost", () => {
    expect(validateUrl("http://localhost").valid).toBe(false);
    expect(validateUrl("http://localhost:3000").valid).toBe(false);
    expect(validateUrl("http://LOCALHOST").valid).toBe(false);
  });

  test("rejects loopback IPs", () => {
    expect(validateUrl("http://127.0.0.1").valid).toBe(false);
    expect(validateUrl("http://127.0.0.1:8080").valid).toBe(false);
    expect(validateUrl("http://[::1]").valid).toBe(false);
  });

  test("rejects private IP ranges (10.x.x.x)", () => {
    expect(validateUrl("http://10.0.0.1").valid).toBe(false);
    expect(validateUrl("http://10.255.255.255").valid).toBe(false);
  });

  test("rejects private IP ranges (172.16-31.x.x)", () => {
    expect(validateUrl("http://172.16.0.1").valid).toBe(false);
    expect(validateUrl("http://172.31.255.255").valid).toBe(false);
    // 172.32 should be allowed
    expect(validateUrl("http://172.32.0.1").valid).toBe(true);
  });

  test("rejects private IP ranges (192.168.x.x)", () => {
    expect(validateUrl("http://192.168.0.1").valid).toBe(false);
    expect(validateUrl("http://192.168.1.1").valid).toBe(false);
  });

  test("rejects link-local addresses", () => {
    expect(validateUrl("http://169.254.0.1").valid).toBe(false);
    expect(validateUrl("http://169.254.169.254").valid).toBe(false);
  });

  test("rejects .local domains", () => {
    expect(validateUrl("http://myserver.local").valid).toBe(false);
    expect(validateUrl("http://printer.local:631").valid).toBe(false);
  });

  test("rejects .internal domains", () => {
    expect(validateUrl("http://api.internal").valid).toBe(false);
  });

  test("rejects .localhost domains", () => {
    expect(validateUrl("http://app.localhost").valid).toBe(false);
  });
});

describe("URL normalization", () => {
  test("lowercases hostname", () => {
    expect(normalizeUrl("https://EXAMPLE.COM/path")).toBe(
      "https://example.com/path"
    );
    expect(normalizeUrl("https://Example.Com/Path")).toBe(
      "https://example.com/Path"
    );
  });

  test("removes default ports", () => {
    expect(normalizeUrl("http://example.com:80/path")).toBe(
      "http://example.com/path"
    );
    expect(normalizeUrl("https://example.com:443/path")).toBe(
      "https://example.com/path"
    );
  });

  test("keeps non-default ports", () => {
    expect(normalizeUrl("http://example.com:8080/path")).toBe(
      "http://example.com:8080/path"
    );
    expect(normalizeUrl("https://example.com:8443/path")).toBe(
      "https://example.com:8443/path"
    );
  });

  test("removes trailing slashes from path", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path"
    );
    // Root path should keep its slash
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  test("sorts query parameters", () => {
    expect(normalizeUrl("https://example.com?z=1&a=2")).toBe(
      "https://example.com?a=2&z=1"
    );
    expect(normalizeUrl("https://example.com?c=3&b=2&a=1")).toBe(
      "https://example.com?a=1&b=2&c=3"
    );
  });

  test("removes UTM tracking parameters", () => {
    expect(
      normalizeUrl("https://example.com?utm_source=google&page=1")
    ).toBe("https://example.com?page=1");
    expect(
      normalizeUrl(
        "https://example.com?utm_medium=cpc&utm_campaign=test&id=123"
      )
    ).toBe("https://example.com?id=123");
  });

  test("removes Facebook tracking parameters", () => {
    expect(normalizeUrl("https://example.com?fbclid=abc123&page=1")).toBe(
      "https://example.com?page=1"
    );
  });

  test("removes Google tracking parameters", () => {
    expect(normalizeUrl("https://example.com?gclid=abc123&id=1")).toBe(
      "https://example.com?id=1"
    );
  });

  test("removes Microsoft tracking parameters", () => {
    expect(normalizeUrl("https://example.com?msclkid=abc&id=1")).toBe(
      "https://example.com?id=1"
    );
  });

  test("removes common tracking parameters", () => {
    expect(normalizeUrl("https://example.com?ref=twitter&id=1")).toBe(
      "https://example.com?id=1"
    );
    expect(normalizeUrl("https://example.com?source=email&id=1")).toBe(
      "https://example.com?id=1"
    );
  });

  test("removes fragments", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page"
    );
    expect(normalizeUrl("https://example.com/page?q=1#top")).toBe(
      "https://example.com/page?q=1"
    );
  });

  test("handles URLs with no query string", () => {
    expect(normalizeUrl("https://example.com/path")).toBe(
      "https://example.com/path"
    );
  });

  test("handles URLs with only tracking params", () => {
    // When all params are removed, we get the root path with trailing slash
    expect(normalizeUrl("https://example.com?utm_source=test")).toBe(
      "https://example.com/"
    );
  });
});

describe("URL hashing", () => {
  test("produces consistent hashes", async () => {
    const url = "https://example.com/test";
    const hash1 = await hashUrl(url);
    const hash2 = await hashUrl(url);
    expect(hash1).toBe(hash2);
  });

  test("produces different hashes for different URLs", async () => {
    const hash1 = await hashUrl("https://example.com/a");
    const hash2 = await hashUrl("https://example.com/b");
    expect(hash1).not.toBe(hash2);
  });

  test("produces 64-character hex strings (SHA-256)", async () => {
    const hash = await hashUrl("https://example.com");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("formatValidationError", () => {
  test("formats too_long error", () => {
    const msg = formatValidationError({
      type: "too_long",
      maxLength: 2000,
      actualLength: 2500,
    });
    expect(msg).toContain("2000");
    expect(msg).toContain("2500");
  });

  test("formats invalid_url error", () => {
    const msg = formatValidationError({
      type: "invalid_url",
      message: "Invalid URL format",
    });
    expect(msg).toContain("Invalid URL");
  });

  test("formats invalid_scheme error", () => {
    const msg = formatValidationError({
      type: "invalid_scheme",
      scheme: "ftp:",
    });
    expect(msg).toContain("ftp:");
    expect(msg).toContain("http");
  });

  test("formats private_ip error", () => {
    const msg = formatValidationError({
      type: "private_ip",
      hostname: "192.168.1.1",
    });
    expect(msg).toContain("192.168.1.1");
    expect(msg).toContain("Private");
  });

  test("formats blocked_hostname error", () => {
    const msg = formatValidationError({
      type: "blocked_hostname",
      hostname: "app.local",
    });
    expect(msg).toContain("app.local");
  });
});
