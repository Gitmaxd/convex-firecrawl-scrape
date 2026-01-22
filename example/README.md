# Example App

Demo application for the Convex Firecrawl Scrape component.

## Quick Start

From the repository root:

```sh
npm install
npx convex dev --once
npx convex env set FIRECRAWL_API_KEY your_key_here
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## What This Demonstrates

- URL input with validation
- Format selection (markdown, HTML, links, images, screenshot)
- Proxy options (basic, stealth, auto)
- Force refresh to bypass cache
- Reactive status updates via Convex subscriptions
- Recent scrapes history with thumbnails and delete
- Tabbed results panel with count badges
- Cached result management

## Troubleshooting

If you encounter issues:

1. Ensure `FIRECRAWL_API_KEY` is set: `npx convex env list`
2. Check Convex Dashboard logs for errors
3. See the [main README](../README.md) for detailed documentation

## Learn More

- [Component Documentation](../README.md)
- [Convex Docs](https://docs.convex.dev)
- [Firecrawl Docs](https://docs.firecrawl.dev)
