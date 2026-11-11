/**
 * Stage 6-TSS-1: one source for running workout estimates.
 * Planned TSS is derived from CURRENT threshold pace, never written to intervals.icu.
 * TSS = 100 * hours * (target speed / threshold speed)^2.
 * Unavailable estimates are null, never zero. Totals remain null if any step lacks data.
 */
const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const firstPositive = (...values) => values.map(positive).find((n) => n !== null) ?? null;
const milesFromMeters = (meters) => meters / 1609.344;
export const getRunningThreshold = (paces) => positive(paces?.run_pace_sec) ?? positive(paces?.threshold_pace_sec);

export function estimateRunningPace(step, paces) {
  const pace = step?.pace;
  if (!pace || typeof pace !== 'object') return null;
  const units = String(pace.units || '').toLowerCase();
  const threshold = getRunningThreshold(paces);
  const toSeconds = (value) => {
    const n = positive(value);
    if (n === null) return null;
    if (units.includes('sec')) return n;
    if (units.includes('min')) return n * 60;
    if (units.includes('%') || units.includes('pct')) return threshold ? threshold / (n / 100) : null;
    if (units.includes('zone')) {
      const zones = paces?.preset_colors || [];
      const zone = zones.find((z) => String(z.zone) === String(value));
      return positive(zone?.pace_val_sec) ?? positive(paces?.pace_val_sec?.[Number(value) - 1]);
    }
    return null;
  };
  const a = toSeconds(pace.start ?? pace.value);
  const b = toSeconds(pace.end ?? pace.value);
  if (!a || !b) return null;
  // Midpoint of SPEED, not arithmetic midpoint of seconds/mile.
  return 2 / (1 / a + 1 / b);
}

export function estimateRunningStep(step, paces) {
  if (!step || typeof step !== 'object') return { seconds: null, miles: null, tss: null, reason: 'missing_step' };
  if (Array.isArray(step.steps)) {
    const children = step.steps.map((child) => estimateRunningStep(child, paces));
    const reps = firstPositive(step.reps, step.iterations) ?? 1;
    const sum = (key) => children.every((child) => child[key] !== null)
      ? children.reduce((n, child) => n + child[key], 0) * reps : null;
    return {
      seconds: sum('seconds'), miles: sum('miles'), tss: sum('tss'),
      repetitions: reps, children,
      reason: children.find((child) => child.reason)?.reason ?? null,
    };
  }
  const paceSec = estimateRunningPace(step, paces);
  const secondsInput = firstPositive(step.duration, step.duration_seconds, step.durationSec, step.elapsed_time);
  const milesInput = firstPositive(step.distanceMiles, step.distance_miles)
    ?? (positive(step.distance) && String(step.durationType || step.stepMode || '').toLowerCase().includes('meter')
      ? milesFromMeters(Number(step.distance)) : positive(step.distance));
  const seconds = secondsInput ?? (milesInput && paceSec ? milesInput * paceSec : null);
  const miles = milesInput ?? (seconds && paceSec ? seconds / paceSec : null);
  const threshold = getRunningThreshold(paces);
  const tss = seconds && paceSec && threshold
    ? 100 * (seconds / 3600) * (threshold / paceSec) ** 2 : null;
  return {
    seconds, miles, tss, paceSec,
    reason: !threshold ? 'missing_threshold' : !paceSec ? 'missing_pace' : !seconds ? 'missing_duration' : null,
  };
}

export function estimateRunningWorkout(workout, paces) {
  const sport = workout?.type || workout?.sport || workout?.workout_doc?.type || 'Run';
  if (!/run|running/i.test(String(sport))) {
    return { seconds: null, miles: null, tss: null, steps: [], reason: 'unsupported_sport' };
  }
  let doc = workout?.workout_doc;
  if (typeof doc === 'string') {
    try { doc = JSON.parse(doc); } catch { return { seconds: null, miles: null, tss: null, steps: [], reason: 'invalid_workout_doc' }; }
  }
  const steps = (Array.isArray(doc?.steps) ? doc.steps : Array.isArray(workout?.steps) ? workout.steps : [])
    .map((step) => estimateRunningStep(step, paces));
  const sum = (key) => steps.length && steps.every((step) => step[key] !== null)
    ? steps.reduce((n, step) => n + step[key], 0) : null;
  return {
    seconds: sum('seconds'), miles: sum('miles'), tss: sum('tss'), steps,
    reason: steps.find((step) => step.reason)?.reason ?? (steps.length ? null : 'missing_steps'),
  };
}

/** Actual workout-level training load is authoritative from intervals.icu. */
export function getExecutedTss(workout) {
  const value = workout?.icu_training_load;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
