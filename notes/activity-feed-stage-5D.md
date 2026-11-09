# Stage 5D — shared activity feed migration

Status: in progress. Branch: `activity-feed-merge`. `APP_TITLE` set to `Web Fitness – 5D`.

## Completed first increment
- Added `src/utils/activityFeedCache.js` as a shared module singleton for date-window requests.
- Uses `/api/val-activity-feed?start=...&end=...` as the planned proxy route (proxy not yet implemented).
- Inclusive date-only range calculations; 28-day missing-range batches.
- Tracks complete windows separately from records; `diagnostics.success === true` required for complete coverage.
- Merges records by `record.key`; exposes subscriptions and date-scoped invalidation.
- Shares in-flight requests at module scope.

## Not yet complete
- Implement Vercel proxy with existing server-side endpoint conventions.
- Audit and implement canonical-to-legacy adapter for existing WorkoutChart, gear and options actions.
- Wire DailyView and MonthlyView to the cache; handle initial 64-day and visible month grid coverage.
- Preserve sportSettings separately if not provided by feed.
- Add cache tests for overlapping requests, failures, invalidation and stale responses.
- Validate Preview build and interactive Daily/Monthly rendering before considering 5D complete.

Do not claim frontend data-source migration or Preview build validation yet. WorkoutChart and WorkoutChartHelpers remain unchanged.
