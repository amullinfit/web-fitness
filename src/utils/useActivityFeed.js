import { useEffect, useMemo, useState } from 'react';
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
// Shared gear catalog, fetched once for both calendar views.
let gearPromise;
let gearCatalog = [];
const loadGear = () => {
  if (!gearPromise) gearPromise = fetch('/api/val-gear').then((r) => {
    if (!r.ok) throw new Error('Gear catalog HTTP ' + r.status);
    return r.json();
  }).then((body) => {
    gearCatalog = Array.isArray(body) ? body : body?.gear || body?.items || [];
    return gearCatalog;
  }).catch((error) => { gearPromise = null; throw error; });
  return gearPromise;
};
const addGearNames = (workouts) => workouts.map((w) => {
  if (!w.gear_id || w.shoe_name) return w;
  const gear = gearCatalog.find((g) => String(g.id ?? g.gear_id) === String(w.gear_id));
  return gear ? { ...w, shoe_name: gear.name, gear_name: gear.name, gear: [gear] } : w;
});
export function useActivityFeed(visibleStart, visibleEnd, refresh = 0) {
  const [revision, setRevision] = useState(activityFeedCache.getSnapshot());
  const [gearRevision, setGearRevision] = useState(0);
  const [loading, setLoading] = useState(() => activityFeedCache.getCoverage().length === 0);
  const [error, setError] = useState(null);
  useEffect(() => activityFeedCache.subscribe(() => setRevision(activityFeedCache.getSnapshot())), []);
  useEffect(() => {
    let active = true;
    loadGear().then(() => { if (active) setGearRevision((n) => n + 1); })
      .catch((err) => console.error('Gear catalog:', err));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setError(null);
    const today = new Date();
    const initialStart = addDays(today, -28);
    const initialEnd = addDays(today, 35);
    const hasAnyData = activityFeedCache.getCoverage().length > 0;
    if (!hasAnyData) setLoading(true);
    (async () => {
      try {
        if (refresh > 0) activityFeedCache.invalidate(visibleStart, visibleEnd);
        await activityFeedCache.ensure(initialStart, initialEnd, 64);
        // Extend by a complete 28-day block when a visible edge crosses coverage.
        await activityFeedCache.ensureDirectional(visibleStart, visibleEnd);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [visibleStart, visibleEnd, refresh]);
  const workouts = useMemo(() => addGearNames(adaptActivityRecords(activityFeedCache.getRecords(visibleStart, visibleEnd))), [visibleStart, visibleEnd, revision, gearRevision]);
  return { workouts, loading, error, invalidate: activityFeedCache.invalidate };
}
