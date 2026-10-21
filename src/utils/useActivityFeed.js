import { useEffect, useState } from 'react';
import { activityFeedCache } from './activityFeedCache.js';
import { adaptActivityRecords } from './activityFeedAdapter.js';

const iso = (date) => {
  const d = new Date(date);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return iso(d);
};

// Shared module cache persists when switching between Daily and Monthly views.
export function useActivityFeed(visibleStart, visibleEnd, refresh = 0) {
  const [revision, setRevision] = useState(activityFeedCache.getSnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => activityFeedCache.subscribe(() => setRevision(activityFeedCache.getSnapshot())), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const today = new Date();
    const initialStart = addDays(today, -28);
    const initialEnd = addDays(today, 35);
    (async () => {
      try {
        if (refresh > 0) activityFeedCache.invalidate(visibleStart, visibleEnd);
        await activityFeedCache.ensure(initialStart, initialEnd);
        if (visibleStart < initialStart || visibleEnd > initialEnd) {
          await activityFeedCache.ensure(visibleStart, visibleEnd);
        }
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [visibleStart, visibleEnd, refresh]);
  // revision subscription makes this update when another view completes a fetch.
  void revision;
  return {
    workouts: adaptActivityRecords(activityFeedCache.getRecords(visibleStart, visibleEnd)),
    loading,
    error,
    invalidate: activityFeedCache.invalidate,
  };
}
