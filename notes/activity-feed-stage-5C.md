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

## Diagnostic status naming update — 2026-10-21
At user request, Val Town feed diagnostics renamed `partial` to `success` and inverted its meaning: `success: true` means all interval-detail lookups succeeded; `success: false` means one or more ultimately failed. Empty range verified HTTP 200 with `success:true`. This is a response-contract change; future frontend cache must use `success === false` to treat a window as incomplete/retryable.

## 5C follow-up diagnostic tests — 2026-10-21
Read-only Val endpoint calls with successful full diagnostics (API-internal duration, not connector wall time):
| Range | Events | Activities | Matched | Planned-only | Interval attempts | 429s | Retries | Failures | Success | duration_ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| Oct 19 | 1 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | true | 579 |
| Oct 20 | 2 | 2 | 2 | 0 | 2 | 0 | 0 | 0 | true | 494 |
| Oct 21 | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | true | 124 |
| Jan 1–2 2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | true | 126 |

These narrow-window tests verify success semantics and request counting; they do **not** establish full-window retry/error performance. The combined payload for 64 days still exceeds connector output limits. Do not optimize the concurrency policy or change chart fields on the strength of these tests alone.

## 5C shared cache contract — approved design candidate for Stage 5D
This section defines behavior only; no frontend integration in 5C.

1. **Window coordinates:** ISO date-only `YYYY-MM-DD`, inclusive, using the app's Detroit-local calendar date convention. Avoid converting date-only values to UTC timestamps for range arithmetic. Validate start <= end. Never request >366 inclusive days.
2. **Initial window:** today minus 28 calendar days through today plus 35 calendar days (64 days inclusive). This is a fetch coverage window, not a retention limit.
3. **Directional extension:** when a displayed date falls outside covered dates, fetch only missing dates in adjacent 28-day inclusive blocks. For a month view, ensure all visible calendar cells are covered, not only first/last dates of the named month. Never re-fetch already healthy covered dates merely because another component mounts.
4. **Coverage model:** track requested inclusive windows and their status separately from record data. A response with `diagnostics.success === true` marks the window healthy, including empty windows. A response with `success === false` merges usable records but leaves its window incomplete and retryable. HTTP/network errors also do not mark coverage healthy. Never infer completeness from record count.
5. **Concurrency:** one shared in-flight promise per exact window; overlapping requests should compute uncovered subranges and await existing in-flight coverage rather than dispatch duplicates. Coalesce adjacent uncovered date blocks where practical while staying within the API cap. Do not let DailyView and MonthlyView independently request identical windows.
6. **Stable identity:** prefer server `record.key` as the primary key; preserve eventId/activityId for mutations and matching. Replace an existing record with the same key on refreshed ranges rather than appending a duplicate. Multiple records per day remain distinct.
7. **Refresh and writes:** invalidate only affected date ranges after calendar mutations; invalidate relevant gear-derived display fields when gear data changes. An incomplete window may be retried by explicit refresh or subsequent navigation. A stale response must not overwrite a newer refresh.
8. **UI compatibility:** adapters for DailyView and MonthlyView must preserve planned-vs-actual distinction, matched planned name, workout_doc nested steps, chart helpers, pace, watts, gear identifiers, and multiple same-day records. Do not show planned chart as executed intervals if `intervals_status === "unavailable"`.
9. **Safety:** keep the existing three-worker/250ms/429 retry server controls; never retry all successful interval records simply because one failed unless the API later supports targeted repair. Cache retry may temporarily re-fetch a window; consider narrower repair if this becomes a measurable issue.
10. **Diagnostics:** surface `success`, duration_ms, intervalRequests, intervalRateLimited, intervalRetries, intervalFailures; avoid treating a 429 that recovered as failure.

### Additional boundary verification
Read-only request 2026-09-30..2026-10-01 returned events=2, activities=2, matched=2, success=true, intervalRequests=2, retries=0, duration_ms=851. This verifies the cross-month range responds successfully, but does not by itself prove all UI month navigation behaviors.

### Remaining 5C gates
- Full 64-day and historical-expanded-window aggregate diagnostics are still unverified because the connector truncates large bodies; need a non-destructive summary-only diagnostic read or another bounded observation method.
- Verify multiple same-day records and completed-only examples in small, non-truncated windows.
- Review server payload fields against Stage 5A consumer needs before any trimming; preserve all fields until evidence supports removal.
- No 5D frontend switch until user approves the stage transition.
