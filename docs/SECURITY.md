# Security Guide

This document provides detailed security guidance for the Convex Firecrawl
Scrape component.

## Access Control Model

### Why `exposeApi()` is Required

This component follows Convex's component model where internal functions are
accessible to any code within your application that has access to
`components.firecrawlScrape`.

The `exposeApi()` wrapper is not just a convenience - it is the **required
security boundary** for this component. It ensures:

1. **Authentication is enforced** before any operation
2. **The Firecrawl API key is controlled** by your auth callback, not passed by
   callers
3. **Operation-specific authorization** can be implemented (e.g., only admins
   can scrape)

### Threat Model for Direct Component Access

If you expose component functions directly to clients (bypassing `exposeApi()`),
you expose your application to these risks:

| Risk                  | Impact                                         | Severity |
| --------------------- | ---------------------------------------------- | -------- |
| Unauthorized scraping | Cost abuse via your Firecrawl API key          | High     |
| Data exfiltration     | Scraping internal URLs and storing results     | High     |
| Cache poisoning       | Overwriting cached content with malicious data | Medium   |
| Resource exhaustion   | Filling storage with unwanted scrape results   | Medium   |

### Safe vs. Unsafe Patterns

```ts
// ❌ DANGEROUS - Bypasses all authentication
// Anyone with access to this file can call startScrape with arbitrary URLs
import { components } from "./_generated/api";
export const scrape = components.firecrawlScrape.lib.startScrape;

// ✅ SAFE - Auth enforced, API key controlled
import { exposeApi } from "convex-firecrawl-scrape";
export const { scrape } = exposeApi(components.firecrawlScrape, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return process.env.FIRECRAWL_API_KEY!;
  },
});
```

### Multi-Team Codebase Guidelines

For larger codebases with multiple teams:

1. Document that `components.firecrawlScrape.lib.*` functions are privileged
   internal APIs
2. Only the functions exported via `exposeApi()` should be used by application
   code
3. Consider code review policies that flag direct component access

---

## SSRF Protection

### What's Protected

This component includes built-in URL validation to prevent common Server-Side
Request Forgery (SSRF) attacks. The following are blocked:

- **Non-HTTP(S) schemes**: `file://`, `ftp://`, `gopher://`, etc.
- **Localhost and loopback addresses**: `127.0.0.1`, `::1`, `localhost`
- **Private IP ranges**:
  - `10.0.0.0/8` (10.x.x.x)
  - `172.16.0.0/12` (172.16-31.x.x)
  - `192.168.0.0/16` (192.168.x.x)
- **Link-local addresses**: `169.254.0.0/16`
- **Private hostname suffixes**: `.local`, `.internal`, `.localhost`

### Known Limitations

**URL validation is hostname/pattern-based only.** It does **not** perform DNS
resolution to verify the destination IP address.

This means:

- **DNS rebinding attacks** are not prevented (where a hostname initially
  resolves to a public IP, then later resolves to a private IP)
- **Hostnames that legitimately resolve to private IPs** will pass validation

### Why DNS Resolution Isn't Performed

1. **Architecture**: This component sends URLs to Firecrawl's API, which
   performs the actual HTTP request. DNS rebinding attacks would target
   Firecrawl's infrastructure rather than your Convex backend.

2. **Firecrawl's protections**: Firecrawl implements its own SSRF protections on
   their end.

3. **Performance**: DNS resolution would add latency to every scrape request.

---

## Recommendations for Sensitive Deployments

### 1. Domain Allowlisting

For applications where users can submit URLs, implement an allowlist:

```ts
import { exposeApi } from "convex-firecrawl-scrape";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Private: the actual scrape function with auth
const { scrape: internalScrape } = exposeApi(components.firecrawlScrape, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return process.env.FIRECRAWL_API_KEY!;
  },
});

// Configuration
const ALLOWED_DOMAINS = ["example.com", "docs.example.com", "blog.example.com"];

// Public: wrapped function with domain validation
export const scrapeAllowlisted = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const url = new URL(args.url);
    const isAllowed = ALLOWED_DOMAINS.some(
      (d) => url.hostname === d || url.hostname.endsWith(`.${d}`),
    );
    if (!isAllowed) {
      throw new Error(`Domain not in allowlist: ${url.hostname}`);
    }
    return await internalScrape(ctx, { url: args.url });
  },
});
```

### 2. Operation-Based Authorization

Restrict certain operations to specific user roles:

```ts
export const { scrape, getStatus, getContent, getCached, invalidate } =
  exposeApi(components.firecrawlScrape, {
    auth: async (ctx, operation) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthorized");

      // Require admin role for write operations
      if (operation === "scrape" || operation === "invalidate") {
        const user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) =>
            q.eq("tokenIdentifier", identity.tokenIdentifier),
          )
          .unique();

        if (user?.role !== "admin") {
          throw new Error("Admin role required for this operation");
        }
      }

      return process.env.FIRECRAWL_API_KEY!;
    },
  });
```

### 3. Per-User Rate Limiting

Prevent abuse by limiting scrape requests per user:

```ts
import { RateLimiter } from "@convex-dev/ratelimiter";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  scrapePerUser: {
    kind: "token bucket",
    rate: 10, // 10 requests
    period: 60000, // per minute
    capacity: 20, // burst capacity
  },
});

export const scrapeWithRateLimit = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const { ok, retryAfter } = await rateLimiter.limit(ctx, "scrapePerUser", {
      key: identity.tokenIdentifier,
    });

    if (!ok) {
      throw new Error(`Rate limited. Retry after ${retryAfter}ms`);
    }

    return await scrape(ctx, { url: args.url });
  },
});
```

### 4. Audit Logging

Log scrape requests for security monitoring:

```ts
export const scrapeWithAudit = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Log the request
    await ctx.db.insert("auditLog", {
      action: "scrape",
      userId: identity.tokenIdentifier,
      url: args.url,
      timestamp: Date.now(),
      ip: ctx.request?.ip, // if available
    });

    return await scrape(ctx, { url: args.url });
  },
});
```

---

## Error Codes and Security Implications

| Code | Common Causes                        | Security Implication                                      |
| ---- | ------------------------------------ | --------------------------------------------------------- |
| 402  | Insufficient Firecrawl credits       | Monitor for unexpected credit depletion (potential abuse) |
| 403  | Forbidden - target site or API issue | Check Firecrawl dashboard; may be site-level blocking     |
| 429  | Rate limit exceeded                  | May indicate abuse or need for rate limiting              |
| 500  | Server error                         | Transient; implement retry logic                          |

---

## Reporting Security Issues

If you discover a security vulnerability in this component, please report it
responsibly:

1. **Do not** open a public GitHub issue
2. Email security concerns to the maintainer
3. Allow reasonable time for a fix before public disclosure

Found a bug? Feature request?
[File it here](https://github.com/gitmaxd/convex-firecrawl-scrape/issues).
