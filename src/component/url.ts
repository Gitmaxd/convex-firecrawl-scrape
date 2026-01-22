/**
 * URL utilities for normalization and validation.
 *
 * These utilities ensure consistent cache key generation and
 * prevent SSRF (Server-Side Request Forgery) attacks.
 */

import { CONFIG } from "./config.js";

/**
 * Maximum allowed URL length (characters).
 * URLs longer than this are rejected to prevent abuse.
 * @deprecated Import from CONFIG.MAX_URL_LENGTH instead. Re-exported for backwards compatibility.
 */
export const MAX_URL_LENGTH = CONFIG.MAX_URL_LENGTH;

/**
 * Tracking parameters to remove during URL normalization.
 * These are commonly used for analytics and don't affect page content.
 */
const TRACKING_PARAMS = new Set([
  // Google Analytics / Ads
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",
  "gclid",
  "gclsrc",
  "dclid",
  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fb_ref",
  // Microsoft / Bing
  "msclkid",
  // Twitter
  "twclid",
  // HubSpot
  "hsa_acc",
  "hsa_cam",
  "hsa_grp",
  "hsa_ad",
  "hsa_src",
  "hsa_tgt",
  "hsa_kw",
  "hsa_mt",
  "hsa_net",
  "hsa_ver",
  // Common tracking
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
]);

/**
 * Private IP address ranges and hostnames that should be blocked.
 */
const PRIVATE_IP_PATTERNS = [
  // Localhost
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^::1$/,
  /^\[::1\]$/,

  // Private networks (RFC 1918)
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,

  // Link-local
  /^169\.254\.\d{1,3}\.\d{1,3}$/,

  // IPv6 private
  /^fe80:/i,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,

  // Loopback aliases
  /^0\.0\.0\.0$/,
  /^\[::\]$/,
];

/**
 * Blocked hostname suffixes.
 */
const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

export type UrlValidationError =
  | { type: "too_long"; maxLength: number; actualLength: number }
  | { type: "invalid_url"; message: string }
  | { type: "invalid_scheme"; scheme: string }
  | { type: "private_ip"; hostname: string }
  | { type: "blocked_hostname"; hostname: string };

export type UrlValidationResult =
  | { valid: true }
  | { valid: false; error: UrlValidationError };

/**
 * Validates a URL for SSRF prevention and basic sanity checks.
 *
 * Blocks:
 * - URLs longer than CONFIG.MAX_URL_LENGTH characters
 * - Non-http(s) schemes
 * - Localhost and 127.0.0.1
 * - Private IP ranges (10.*, 172.16-31.*, 192.168.*)
 * - Link-local addresses (169.254.*)
 * - *.local, *.internal, *.localhost hostnames
 *
 * **Limitation:** This is hostname/pattern-based validation only.
 * It does NOT perform DNS resolution, so DNS rebinding attacks
 * (where a hostname resolves to a private IP) are not prevented.
 * For sensitive deployments, implement domain allowlists in your
 * application layer. See README.md for guidance.
 *
 * @param url - The URL string to validate
 * @returns Validation result with error details if invalid
 */
export function validateUrl(url: string): UrlValidationResult {
  // Check length
  if (url.length > CONFIG.MAX_URL_LENGTH) {
    return {
      valid: false,
      error: {
        type: "too_long",
        maxLength: CONFIG.MAX_URL_LENGTH,
        actualLength: url.length,
      },
    };
  }

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      valid: false,
      error: { type: "invalid_url", message: "Invalid URL format" },
    };
  }

  // Check scheme
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: { type: "invalid_scheme", scheme: parsed.protocol },
    };
  }

  // Check for private IPs
  const hostname = parsed.hostname.toLowerCase();
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        error: { type: "private_ip", hostname },
      };
    }
  }

  // Check for blocked hostname suffixes
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return {
        valid: false,
        error: { type: "blocked_hostname", hostname },
      };
    }
  }

  return { valid: true };
}

/**
 * Formats a URL validation error as a human-readable message.
 *
 * @param error - The validation error
 * @returns Human-readable error message
 */
export function formatValidationError(error: UrlValidationError): string {
  switch (error.type) {
    case "too_long":
      return `URL exceeds maximum length of ${error.maxLength} characters (got ${error.actualLength})`;
    case "invalid_url":
      return `Invalid URL: ${error.message}`;
    case "invalid_scheme":
      return `Invalid URL scheme: ${error.scheme}. Only http and https are allowed`;
    case "private_ip":
      return `Private/local IP addresses are not allowed: ${error.hostname}`;
    case "blocked_hostname":
      return `Blocked hostname: ${error.hostname}. Private network hostnames are not allowed`;
  }
}

/**
 * Normalizes a URL for consistent cache key generation.
 *
 * Normalization steps:
 * 1. Lowercase the hostname
 * 2. Remove default ports (80 for http, 443 for https)
 * 3. Sort query parameters alphabetically
 * 4. Remove tracking parameters (utm_*, fbclid, gclid, etc.)
 * 5. Remove trailing slashes from path
 * 6. Remove fragments (#section)
 *
 * @param url - The URL string to normalize
 * @returns Normalized URL string
 * @throws Error if the URL is invalid
 */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url);

  // Lowercase hostname
  let normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}`;

  // Add port only if non-default
  const isDefaultPort =
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443") ||
    parsed.port === "";

  if (!isDefaultPort) {
    normalized += `:${parsed.port}`;
  }

  // Normalize path - remove trailing slash from non-root paths
  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  // Sort and filter query parameters
  const params = new URLSearchParams(parsed.search);
  const sortedParams = new URLSearchParams();

  // Get all param names, filter tracking params, and sort
  const paramNames = Array.from(params.keys())
    .filter((name) => !isTrackingParam(name))
    .sort();

  for (const name of paramNames) {
    const value = params.get(name);
    if (value !== null) {
      sortedParams.set(name, value);
    }
  }

  const queryString = sortedParams.toString();

  // Add path: for root "/", only include it if there's no query string
  // This keeps "https://example.com/" but produces "https://example.com?q=1"
  if (path === "/" && queryString) {
    // Omit the trailing slash when there's a query string on root
  } else {
    normalized += path;
  }

  if (queryString) {
    normalized += `?${queryString}`;
  }

  // Fragment (#) is intentionally removed - it's client-side only

  return normalized;
}

function isTrackingParam(name: string): boolean {
  const lowerName = name.toLowerCase();

  // Check exact matches
  if (TRACKING_PARAMS.has(lowerName)) {
    return true;
  }

  // Check utm_ prefix (catch-all for any UTM params)
  if (lowerName.startsWith("utm_")) {
    return true;
  }

  return false;
}

export async function hashUrl(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
