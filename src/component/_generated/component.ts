/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      deleteScrape: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        { deletedFileCount: number; success: boolean },
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          _creationTime: number;
          _id: string;
          error?: string;
          errorCode?: number | string;
          expiresAt: number;
          extractedJson?: any;
          extractedJsonFileId?: string;
          extractionSchema?: any;
          formats: Array<string>;
          html?: string;
          htmlFileId?: string;
          images?: Array<string>;
          imagesFileId?: string;
          links?: Array<string>;
          linksFileId?: string;
          markdown?: string;
          markdownFileId?: string;
          metadata?: {
            cacheControl?: string;
            contentType?: string;
            description?: string;
            language?: string;
            ogDescription?: string;
            ogImage?: string;
            ogSiteName?: string;
            ogTitle?: string;
            sourceURL?: string;
            statusCode?: number;
            title?: string;
          };
          normalizedUrl: string;
          rawHtml?: string;
          rawHtmlFileId?: string;
          scrapedAt?: number;
          scrapingAt?: number;
          screenshotFileId?: string;
          screenshotUrl?: string;
          startedAt: number;
          status: "pending" | "scraping" | "completed" | "failed";
          summary?: string;
          url: string;
          urlHash: string;
        },
        Name
      >;
      getByUrl: FunctionReference<
        "query",
        "internal",
        { url: string },
        null | {
          _creationTime: number;
          _id: string;
          error?: string;
          errorCode?: number | string;
          expiresAt: number;
          extractedJson?: any;
          extractedJsonFileId?: string;
          extractionSchema?: any;
          formats: Array<string>;
          html?: string;
          htmlFileId?: string;
          images?: Array<string>;
          imagesFileId?: string;
          links?: Array<string>;
          linksFileId?: string;
          markdown?: string;
          markdownFileId?: string;
          metadata?: {
            cacheControl?: string;
            contentType?: string;
            description?: string;
            language?: string;
            ogDescription?: string;
            ogImage?: string;
            ogSiteName?: string;
            ogTitle?: string;
            sourceURL?: string;
            statusCode?: number;
            title?: string;
          };
          normalizedUrl: string;
          rawHtml?: string;
          rawHtmlFileId?: string;
          scrapedAt?: number;
          scrapingAt?: number;
          screenshotFileId?: string;
          screenshotUrl?: string;
          startedAt: number;
          status: "pending" | "scraping" | "completed" | "failed";
          summary?: string;
          url: string;
          urlHash: string;
        },
        Name
      >;
      getCached: FunctionReference<
        "query",
        "internal",
        {
          formats?: Array<
            | "markdown"
            | "html"
            | "rawHtml"
            | "links"
            | "images"
            | "summary"
            | "screenshot"
          >;
          url: string;
        },
        null | {
          _creationTime: number;
          _id: string;
          error?: string;
          errorCode?: number | string;
          expiresAt: number;
          extractedJson?: any;
          extractedJsonFileId?: string;
          extractionSchema?: any;
          formats: Array<string>;
          html?: string;
          htmlFileId?: string;
          images?: Array<string>;
          imagesFileId?: string;
          links?: Array<string>;
          linksFileId?: string;
          markdown?: string;
          markdownFileId?: string;
          metadata?: {
            cacheControl?: string;
            contentType?: string;
            description?: string;
            language?: string;
            ogDescription?: string;
            ogImage?: string;
            ogSiteName?: string;
            ogTitle?: string;
            sourceURL?: string;
            statusCode?: number;
            title?: string;
          };
          normalizedUrl: string;
          rawHtml?: string;
          rawHtmlFileId?: string;
          scrapedAt?: number;
          scrapingAt?: number;
          screenshotFileId?: string;
          screenshotUrl?: string;
          startedAt: number;
          status: "pending" | "scraping" | "completed" | "failed";
          summary?: string;
          url: string;
          urlHash: string;
        },
        Name
      >;
      getContent: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          error?: string;
          errorCode?: number | string;
          expiresAt: number;
          extractedJson?: any;
          extractedJsonFileUrl?: string | null;
          formats: Array<string>;
          html?: string;
          htmlFileUrl?: string | null;
          images?: Array<string>;
          imagesFileUrl?: string | null;
          links?: Array<string>;
          linksFileUrl?: string | null;
          markdown?: string;
          markdownFileUrl?: string | null;
          metadata?: {
            cacheControl?: string;
            contentType?: string;
            description?: string;
            language?: string;
            ogDescription?: string;
            ogImage?: string;
            ogSiteName?: string;
            ogTitle?: string;
            sourceURL?: string;
            statusCode?: number;
            title?: string;
          };
          normalizedUrl: string;
          rawHtml?: string;
          rawHtmlFileUrl?: string | null;
          scrapedAt?: number;
          scrapingAt?: number;
          screenshotFileUrl?: string | null;
          screenshotUrl?: string;
          startedAt: number;
          status: "pending" | "scraping" | "completed" | "failed";
          summary?: string;
          url: string;
        },
        Name
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          error?: string;
          errorCode?: number | string;
          expiresAt: number;
          scrapedAt?: number;
          scrapingAt?: number;
          startedAt: number;
          status: "pending" | "scraping" | "completed" | "failed";
        },
        Name
      >;
      invalidate: FunctionReference<
        "mutation",
        "internal",
        { url: string },
        { invalidatedCount: number; success: boolean },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          limit?: number;
          status?: "pending" | "scraping" | "completed" | "failed";
        },
        {
          hasMore: boolean;
          nextCursor: null | string;
          scrapes: Array<{
            _creationTime: number;
            _id: string;
            error?: string;
            errorCode?: number | string;
            expiresAt: number;
            extractedJson?: any;
            extractedJsonFileId?: string;
            extractionSchema?: any;
            formats: Array<string>;
            html?: string;
            htmlFileId?: string;
            images?: Array<string>;
            imagesFileId?: string;
            links?: Array<string>;
            linksFileId?: string;
            markdown?: string;
            markdownFileId?: string;
            metadata?: {
              cacheControl?: string;
              contentType?: string;
              description?: string;
              language?: string;
              ogDescription?: string;
              ogImage?: string;
              ogSiteName?: string;
              ogTitle?: string;
              sourceURL?: string;
              statusCode?: number;
              title?: string;
            };
            normalizedUrl: string;
            rawHtml?: string;
            rawHtmlFileId?: string;
            scrapedAt?: number;
            scrapingAt?: number;
            screenshotFileId?: string;
            screenshotUrl?: string;
            startedAt: number;
            status: "pending" | "scraping" | "completed" | "failed";
            summary?: string;
            url: string;
            urlHash: string;
          }>;
        },
        Name
      >;
      listByStatus: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          status: "pending" | "scraping" | "completed" | "failed";
        },
        Array<{
          _creationTime: number;
          _id: string;
          error?: string;
          errorCode?: number | string;
          expiresAt: number;
          extractedJson?: any;
          extractedJsonFileId?: string;
          extractionSchema?: any;
          formats: Array<string>;
          html?: string;
          htmlFileId?: string;
          images?: Array<string>;
          imagesFileId?: string;
          links?: Array<string>;
          linksFileId?: string;
          markdown?: string;
          markdownFileId?: string;
          metadata?: {
            cacheControl?: string;
            contentType?: string;
            description?: string;
            language?: string;
            ogDescription?: string;
            ogImage?: string;
            ogSiteName?: string;
            ogTitle?: string;
            sourceURL?: string;
            statusCode?: number;
            title?: string;
          };
          normalizedUrl: string;
          rawHtml?: string;
          rawHtmlFileId?: string;
          scrapedAt?: number;
          scrapingAt?: number;
          screenshotFileId?: string;
          screenshotUrl?: string;
          startedAt: number;
          status: "pending" | "scraping" | "completed" | "failed";
          summary?: string;
          url: string;
          urlHash: string;
        }>,
        Name
      >;
      startScrape: FunctionReference<
        "mutation",
        "internal",
        {
          apiKey: string;
          options?: {
            excludeTags?: Array<string>;
            extractionSchema?: any;
            force?: boolean;
            formats?: Array<
              | "markdown"
              | "html"
              | "rawHtml"
              | "links"
              | "images"
              | "summary"
              | "screenshot"
            >;
            includeTags?: Array<string>;
            mobile?: boolean;
            onlyMainContent?: boolean;
            proxy?: "basic" | "stealth" | "auto";
            storeScreenshot?: boolean;
            ttlMs?: number;
            waitFor?: number;
          };
          url: string;
        },
        { jobId: string },
        Name
      >;
    };
  };
