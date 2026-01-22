# Contributing Guide

**[Live Demo](https://convex-firecrawl-scrape.vercel.app/)** - See the component in action

## Running Locally

```sh
npm i
npm run dev
```

## Testing

```sh
npm ci
npm run build:clean
npm run typecheck
npm run lint
npm run test
```

## Architecture

### Configuration

All configurable constants are centralized in `src/component/config.ts`. This file
is the single source of truth for default values used throughout the component.

When adding new configurable values:

1. Add the constant to `CONFIG` in `src/component/config.ts` with JSDoc documentation
2. Import and use `CONFIG.YOUR_CONSTANT` - never define local duplicates
3. Document the value in README.md's Configuration section
4. If user-facing, consider whether it should be a per-request option

### Module Structure

```
src/
├── component/
│   ├── config.ts      # Centralized configuration constants
│   ├── lib.ts         # Core queries, mutations, and actions
│   ├── schema.ts      # Database schema
│   ├── url.ts         # URL validation and normalization
│   └── crons.ts       # Scheduled job definitions
└── client/
    └── index.ts       # Public API, re-exports CONFIG
```

### Key Design Decisions

- **Centralized Config**: All defaults live in `config.ts` to avoid duplication and ensure consistency between client and component code.
- **File Storage Threshold**: Content over 1MB is stored in Convex file storage rather than inline in documents, balancing query performance with storage efficiency.
- **Stuck Job Detection**: Jobs in "scraping" status for more than 5 minutes are automatically marked as failed, matching Firecrawl's maximum timeout.
- **Superset Cache Matching**: A cached result is only returned if it contains all requested formats, ensuring callers always get what they ask for.
