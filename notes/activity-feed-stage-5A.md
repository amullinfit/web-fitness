# Activity Feed Merge — Stage 5A audit and proposed contract

Status: design proposal, no feed implementation. Branch: `activity-feed-merge`.

## Agreed boundaries
- One canonical calendar activity feed, with separate `planned` and `actual` data.
- Do **not** modify `WorkoutChart.jsx` or `WorkoutChartHelpers.js` as part of this feature. Provide existing flat input fields through a compatibility adapter.
- Initial date coverage: today -28 through today +35, inclusive (64 days). Extend only missing dates by 28-day directional chunks; include executed intervals with each batch.
- Keep workout library, training-plan CRUD, and authenticated calendar write endpoints distinct.
- Preserve existing `average_pace` behavior until independently audited; raw `average_speed` is meters/second and must not be reinterpreted.

## Confirmed consumers
| Consumer | Existing dependencies | Migration requirement |
|---|---|---|
| DailyView | /api/val-workouts + /api/val-historical; mergeDailyWorkoutFeeds; feedSource; workout_doc; intervals; sportSettings; date fields; gear | Shared range cache, canonical-to-legacy adapter, preserve options on uncompleted workouts |
| MonthlyView | Same endpoints; mergeMonthlyWorkoutFeeds; chart and zoom modal; feedSource for drag and options; gear | Same shared records, consistent status and date grouping |
| WorkoutChart | extractPlannedSteps reads workout_doc.steps; extractExecutedSteps reads intervals[].average_speed, elapsed_time and type | **No changes**; adapter provides `workout_doc` and `intervals` |
| MonthlyModal_ZoomWorkout | feedSource and icu_activity_id for edit actions; gear | Explicit planned/editable status via adapter or minimal consumer change |
| useGearManagement / MonthlyViewHelpers | feedSource, paired_event_id, gear_id, shoe_name, completion | Completed-only gear and normalized completion |
| TrainingPlanEditor scheduling preview | action=calendar_range, events[], category, start_date_local, workout_doc.steps, name/id; overlaps and mini charts | Preserve scheduled event semantics; don't confuse completed-only activities with planned events |
| CalendarWorkoutActions move dialog | action=calendar_range, events[], date, name; library fetched independently | Reuse cached scheduled calendar data, preserve conflict indicators |
| TrainingPlanEditor estimateWorkout | workout_doc.steps, type, duration, distance | Library definition semantics unchanged |

## Current defects / inconsistencies
- `mergeDailyWorkoutFeeds` and `mergeMonthlyWorkoutFeeds` apply different planned name/description/interval fallback rules.
- Both views fetch planned and historical data independently, with independent error handling.
- Completed status and editability rely on `feedSource`, not a stable domain status.
- Historical interval fetch is an unbounded per-activity Promise.all; bound concurrency and distinguish unavailable details from truly empty arrays.
- `api_workouts` default response truncates events; canonical date-range endpoint must not silently truncate.
- Date ranges and local timezone differ across existing Vals; normalize date key from `start_date_local` and document inclusive date semantics.
- `icu_intervals[].type` may be WORK even during slow/recovery portions; never infer prescribed effort from it.
- `icu_groups` are aggregates, not necessarily contiguous workout steps.

## Proposed endpoint
`GET /api/val-activity-feed?start=YYYY-MM-DD&end=YYYY-MM-DD` via Vercel proxy to Val Town `api_activity_feed`.
Both dates optional together for the agreed initial default; explicit dates inclusive. Reject invalid dates and oversized ranges; define the precise upper limit in 5B/5C. The server must not depend on the browser's timezone to interpret date keys.

Proposed response:
```json
{
  "start": "2026-09-22",
  "end": "2026-11-24",
  "records": [
    {
      "key": "event:144449333",
      "date": "2026-10-19",
      "status": "completed",
      "kind": "workout",
      "eventId": "144449333",
      "activityId": "i199233082",
      "planned": {
        "name": "Tempo Alternations",
        "start_date_local": "2026-10-19T09:00:00",
        "category": "WORKOUT",
        "type": "Run",
        "description": null,
        "duration": 4200,
        "distance": 11138.583,
        "workout_doc": {"steps": []}
      },
      "actual": {
        "start_date_local": null,
        "type": "Run",
        "elapsed_time": null,
        "distance": null,
        "average_speed": null,
        "gear_id": null,
        "shoe_name": null,
        "intervals": []
      }
    }
  ],
  "diagnostics": {"partial": false, "intervalErrors": []}
}
```
Illustrative shape: nulls and empty arrays are placeholders, **not** verified activity values; planned workout_doc.steps shown abbreviated. Do not ship example as a fixture.

Matching rules:
0. A matched completed activity takes the planned event's display name.
1. Join activity `paired_event_id` to event `id` (string-normalized).
2. Also inspect event `paired_activity_id` and validate reciprocal linkage; use it when activity-side linkage is missing and unambiguous.
3. No name/date heuristic joins. Preserve planned-only, activity-only and multiple activities/day.
4. Distinguish scheduled event `id` from completed activity `id`; choose stable `key` without collisions.
5. Keep event date for scheduled preview; activity date for actual-only. Confirm handling of paired workouts spanning local midnight.
6. `status` and `kind` must not be inferred from interval type.

## Allowlist candidates (must validate against every consumer before implementation)
Planned: id, paired_activity_id, name, start_date_local, category, type, description, moving_time, duration, distance, workout_doc.steps plus required nested step keys. Preserve nested repeats, ramps, pace objects and step metadata without reordering.
Actual summary: id, paired_event_id, start_date_local, start_date, type, elapsed_time, distance, average_speed, gear_id, shoe_name, training load/fitness metrics and HR fields **only where consumed**.
Executed interval: id, type, start_time, end_time, moving_time, elapsed_time, distance, average_speed, average_heartrate, average_cadence, zone, intensity. Review additional metrics and null semantics before final trim.
Do not include `icu_groups` unless a consumer requires them. Retain raw pace/speed values; presentation conversion stays in existing helpers.

## User-confirmed behavior (2026-10-20)
- Planned-only, completed-only and matched activity records remain visible, including multiple on one date.
- Matched completed activities use the planned workout name.
- Training-plan preview red overlap border is triggered by **any existing calendar activity** on a proposed workout day, whether planned/uncompleted, planned/completed, unplanned/completed, or multiple activities. It is informational, not a scheduling block.
- When executed intervals are missing or their fetch fails, show the completed activity summary; if paired with a planned workout, keep its planned-only chart. Without planned steps, show no fabricated chart. Preserve a separate interval availability/error state.

## Batching and cache contract
- Fetch full initial inclusive 64-day window around local today.
- On calendar navigation, calculate visible grid bounds, then fetch only missing ranges, extending in 28-day increments in the required direction.
- Each fetched window includes completed activity intervals; no on-demand interval requests from chart components.
- Merge windows and records by stable keys; dedupe inflight overlapping requests and ignore stale results.
- Do not mark a range fully loaded if its upstream interval requests failed. Expose partial failures and permit retry.
- Invalidate affected date ranges on successful calendar writes; gear changes invalidate relevant activity records; keep unrelated ranges.
- Bound interval request concurrency, log upstream call count/latency/response size; tune after measurement.

## Test matrix
1. 2026-10-19 planned event 144449333 paired with activity i199233082, planned duration 4200 distinct from executed interval end time 3986.
2. 2026-10-20 planned events 144449339 and 144449354 uncompleted, same day.
3. Nested `reps`, decreasing ramp pace percentages and planned chart unchanged.
4. Completed-only activities, unmatched planned events, multiple completed activities on same date; any existing activity triggers informational red border on a proposed plan day.
5. Reciprocal/nonreciprocal IDs; duplicate events and activities; no fallback matching.
6. Interval duration uses elapsed_time; moving_time separate; average_speed stays m/s; all-WORK sample does not imply no recovery.
7. Day/month and schedule preview charts remain identical; no edits to WorkoutChart.
8. Monthly grid spanning months; 28/35 default, 28-day directional extensions, no duplicate network requests.
9. Partial upstream failures, zero intervals vs failed fetch, rate limits, timeouts, retries and oversized ranges. A matched completed activity with missing executed intervals still shows the planned chart; unmatched completed activity shows summary without invented chart.
10. Read-only mode, workout options, drag/move, gear, plan scheduling, authenticated write and cache refresh.
11. Compare response payload bytes, upstream request count, total load time, chart render against existing Vals.

## Open verification before 5B
- Audit full executed activity summary sample from intervals.icu; verify activity-side pairing, displayed metrics and real values.
- Audit remaining code paths and all nested step properties used by charts and text.
- Decide canonical record representation when one event links multiple activities; preserve distinct activities without duplicate planned cards.
- Determine timezone contract (Intervals.icu athlete timezone versus server clock) and exact upper bound for range requests.
- Verify `api_workouts` and `api_historical` current Val source: Val Town file browser works but read_file currently returns empty; earlier pasted code used provisionally.
- Confirmed: training-plan preview overlap indicators include any existing calendar activity (planned-only, matched, completed-only, multiple); overlap is informational and never blocks scheduling.

## Stage gates
5A: design + audit approval only. 5B: create new Val alongside old, no frontend behavior change. 5C: optimize ranges and payload. 5D: migrate Daily/Monthly shared cache. 5E: migrate remaining calendar consumers. 5F: regressions, cleanup, restore APP_TITLE, approval before merge.
