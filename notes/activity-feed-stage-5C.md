# Stage 5C — range and payload optimization

Status: in progress. Branch: `activity-feed-merge`. The Stage 5B Val is already live and remains the canonical read-only data source.

## Existing server behavior confirmed in Stage 5B
- Inclusive `start` and `end` parameters; default Detroit-local today minus 28 days to plus 35 days.
- Explicit date range capped at 366 days.
- Event/activity pairing by intervals.icu IDs, with distinct planned-only, matched, and completed-only records.
- Executed interval detail requests limited to three concurrent workers, spaced by at least 250ms, with up to four HTTP 429 retries.
- Diagnostic counts, interval errors, and elapsed API time. Completed records survive interval-detail failures.
- Activity-level and interval-level watts preserved when present.
- Redundant `diagnostics.records` removed.

## Stage 5C work / acceptance criteria
1. Measure representative 64-day and expanded requests: elapsed time, upstream request counts, response bytes, interval errors, and duplicate activity requests.
2. Review actual payload fields against the Stage 5A consumer audit before removing any. Do not trim nested `workout_doc.steps`, power metrics, IDs, or chart/gear fields prematurely.
3. Preserve explicit inclusive date semantics and avoid fetching more than the requested range.
4. Ensure partial interval failures are visible and retryable when the shared client cache is introduced; don't mark incomplete windows fully healthy.
5. Define client cache windows and missing-range extension logic before Stage 5D implementation. Initial -28/+35 days, then 28-day directional extensions; dedupe in-flight overlapping windows and stable record keys.
6. Test month boundaries, same-day multiple records, paired/unpaired workouts, 429 behavior, and an empty range.
7. Keep DailyView, MonthlyView, TrainingPlanEditor, WorkoutChart and WorkoutChartHelpers unchanged during 5C. Client integration is Stage 5D/5E.

## Stage boundary
5C optimizes and validates the API contract and prepares the client-side range strategy. 5D migrates DailyView and MonthlyView to a shared range cache. 5E migrates other calendar consumers. No frontend data-source switch before Stage 5D approval.
