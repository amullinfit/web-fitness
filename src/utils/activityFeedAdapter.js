// Stage 5D compatibility adapter: canonical activity records -> existing calendar card fields.
// Keep planned and actual values distinct in the source record; do not fabricate intervals.
export const adaptActivityRecord = (record) => {
  if (!record || !record.key || !record.date) return null;
  const planned = record.planned || null;
  const actual = record.actual || null;
  const completed = Boolean(actual);
  const eventId = record.eventId ?? planned?.id ?? null;
  const activityId = record.activityId ?? actual?.id ?? null;
  const name = planned?.name || record.name || actual?.name || 'Workout';
  const date = record.date;
  const base = completed ? (actual || {}) : (planned || {});
  const intervals = completed
    ? (actual?.intervals_status === 'unavailable' ? [] : (actual?.intervals ?? []))
    : (planned?.intervals ?? null);

  return {
    ...base,
    // Retain raw source fields for callers needing explicit prescribed/executed data.
    canonicalKey: record.key,
    canonicalStatus: record.status,
    canonicalPlanned: planned,
    canonicalActual: actual,
    id: completed ? activityId : eventId,
    _id: completed ? activityId : eventId,
    icu_activity_id: activityId,
    activity_id: activityId,
    event_id: eventId,
    paired_event_id: completed ? eventId : null,
    paired_activity_id: activityId,
    feedSource: completed ? 'HISTORICAL' : 'WORKOUTS',
    name,
    title: name,
    date,
    start_date_local: planned?.start_date_local || actual?.start_date_local || date,
    type: record.type || base.type || planned?.type || null,
    description: planned?.description || actual?.description || '',
    workout_doc: planned?.workout_doc ?? actual?.workout_doc ?? null,
    intervals,
    intervals_status: actual?.intervals_status ?? null,
    gear_id: actual?.gear_id ?? base.gear_id ?? null,
    shoe_name: actual?.shoe_name ?? base.shoe_name ?? null,
    // Preserve existing pace/speed units; chart helpers handle display conversion.
    average_speed: actual?.average_speed ?? base.average_speed ?? null,
    average_watts: actual?.average_watts ?? base.average_watts ?? null,
  };
};

export const adaptActivityRecords = (records) =>
  (Array.isArray(records) ? records : []).map(adaptActivityRecord).filter(Boolean);
