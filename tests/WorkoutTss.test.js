import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRunningPace, estimateRunningStep, estimateRunningWorkout, getExecutedTss } from '../src/utils/WorkoutTss.js';

const paces = { run_pace_sec: 480 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `expected ${expected}, got ${actual}`);

test('one hour at threshold is 100 TSS', () => {
  const result = estimateRunningStep({ duration: 3600, pace: { units: 'secs', value: 480 } }, paces);
  near(result.tss, 100);
  near(result.miles, 7.5);
});

test('pace range midpoint uses speed, not arithmetic pace', () => {
  const pace = estimateRunningPace({ pace: { units: 'secs', start: 420, end: 600 } }, paces);
  near(pace, 2 / (1 / 420 + 1 / 600));
});

test('distance-based step derives time', () => {
  const result = estimateRunningStep({ distance: 2, pace: { units: 'secs', value: 480 } }, paces);
  near(result.seconds, 960);
  near(result.tss, 100 * 960 / 3600);
});

test('repeat displays one-step children and multiplied parent total', () => {
  const step = { reps: 3, steps: [
    { duration: 600, pace: { units: 'secs', value: 480 } },
    { duration: 300, pace: { units: 'secs', value: 600 } },
  ] };
  const result = estimateRunningStep(step, paces);
  near(result.children[0].tss, 100 * 600 / 3600);
  near(result.tss, 3 * (100 * 600 / 3600 + 100 * 300 / 3600 * (480 / 600) ** 2));
});

test('workout totals include recovery and cooldown', () => {
  const workout = { type: 'Run', workout_doc: { steps: [
    { duration: 600, pace: { units: 'secs', value: 600 } },
    { duration: 1200, pace: { units: 'secs', value: 480 } },
    { duration: 600, pace: { units: 'secs', value: 600 } },
  ] } };
  const result = estimateRunningWorkout(workout, paces);
  near(result.tss, result.steps.reduce((sum, step) => sum + step.tss, 0));
});

test('missing pace and threshold report unavailable, not zero', () => {
  assert.equal(estimateRunningStep({ duration: 600 }, paces).tss, null);
  assert.equal(estimateRunningStep({ duration: 600, pace: { units: 'secs', value: 480 } }, {}).reason, 'missing_threshold');
  assert.equal(estimateRunningWorkout({ type: 'Bike', workout_doc: { steps: [] } }, paces).reason, 'unsupported_sport');
});

test('actual TSS uses intervals.icu field, including valid zero', () => {
  assert.equal(getExecutedTss({ icu_training_load: 72.5 }), 72.5);
  assert.equal(getExecutedTss({ icu_training_load: 0 }), 0);
  assert.equal(getExecutedTss({}), null);
  assert.equal(getExecutedTss({ icu_training_load: null }), null);
});

test('distance mode ignores stale duration and derives time from distance', () => {
  const result = estimateRunningStep({ stepMode: 'distance', duration: 600, distanceMiles: 2, pace: { units: 'secs', value: 480 } }, paces);
  near(result.seconds, 960);
  near(result.miles, 2);
});

test('time mode derives mileage from duration, not stale distance', () => {
  const result = estimateRunningStep({ stepMode: 'time', duration: 600, distanceMiles: 3, pace: { units: 'secs', value: 480 } }, paces);
  near(result.miles, 1.25);
});
