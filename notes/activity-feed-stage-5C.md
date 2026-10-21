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

## 5C benchmark pass — 2026-10-21
Read-only calls to the deployed Val (not browser or Val internal duration), one run per range:
| Inclusive range | Days | Tool-observed elapsed | Caveat |
|---|---:|---:|---|
| 2026-10-19..2026-10-20 | 2 | 3.5s | Tool response truncated |
| 2026-09-22..2026-11-24 | 64 | 11.2s | Tool response truncated |
| 2026-08-25..2026-09-21 | 28 | 13.1s | Tool response truncated |

Tool response is capped at approximately 20,000 characters and includes truncation metadata; diagnostic counts and full response byte size could not be extracted reliably. These timings include connector/tool overhead and must not be presented as Val internal durations. The earlier 28-day range may contain more completed activities than the 64-day forward-heavy window. No source-data or UI behavior changed in this pass.

**Next 5C action:** add lightweight, explicitly defined aggregate request metrics to the Val diagnostics (interval attempt count, rate-limit retries, final failed interval lookups, optional payload bytes) so full-window performance can be checked without printing all records. Avoid exposing athlete credentials. Retest with representative windows and compare `duration_ms`, counts, and errors. Do not change concurrency/response schema for workouts without a focused test.

## 5C diagnostic instrumentation — 2026-10-21
Updated Val Town `amullinfit/api_activity_feed` (main Val branch) with request-scoped counters:
- `intervalRequests`: HTTP interval fetch attempts, including retries.
- `intervalRateLimited`: HTTP 429 responses received.
- `intervalRetries`: retries initiated after a 429 response.
- `intervalFailures`: final failed activity interval fetches (same count as `errors` under current behavior).

Counters are per HTTP feed invocation; no activity records, matching rules, request bounds, or frontend consumers were changed. Verified a 2027-01-01..2027-01-02 empty-range response: status 200, all counters 0, diagnostics duration_ms 211. The full-range response exceeds connector display limits, so representative full-window counter values remain to be checked separately. Note `intervalRequests` counts attempts begun; a thrown network error is counted even without an HTTP status. No power/pace/chart changes.
