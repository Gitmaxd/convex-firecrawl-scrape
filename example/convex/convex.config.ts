import { defineApp } from "convex/server";
import firecrawlScrape from "convex-firecrawl-scrape/convex.config.js";

const app = defineApp();
app.use(firecrawlScrape);

export default app;
