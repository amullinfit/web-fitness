//
// WorkoutTextSection.jsx
//
import React, { useState } from 'react';
import './WorkoutTextSection.css';
import { formatPaceRange, parsePaceStrToSec, extractExecutedSteps } from './WorkoutChartHelpers.js';
import { getRunningThreshold } from './WorkoutTss.js';
import { estimateRunningStep, estimateRunningWorkout, getExecutedTss } from './WorkoutTss.js';

import {
  detectPaceMethod,
  calculatePaceFromPct,
  calculatePctFromPace,
  calculateZoneFromPace,
  calculatePaceFromZone,
  calculateNewPaceValue,
  metersPerSecondToPaceStr,
  secondsToPaceStr
} from '../utils/WorkoutConverter.js';

// 125 -> 2:05
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (num) => String(num).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

const formatIntensityTitleCase = (val) => {
  if (!val) return "N/A";
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Return the formatted text describing the pace(s) for the step
const formatPaceString = (s, thresholdPaceMps, zoneList, paceDetails) => {
  if (!s?.pace) return "N/A";

  const { pace } = s;
  const units = (pace.units || '').toLowerCase().replace(/\s+|range/g, '');

  // Determine if single value vs range
  const isSingle = pace.value != null;
  const val = isSingle ? pace.value : null;

  const start = Math.max(pace.start ?? 0, pace.end ?? 0);
  const end = Math.min(pace.start ?? 0, pace.end ?? 0);

  let paceStr = 'N/A';
  let paceMethodStr = null;

  switch (units) {
    // -------------------------------------------------------------------
    // 1. SECONDS PER MILE (Direct Seconds)
    // -------------------------------------------------------------------
    case 'secs':{
      if (isSingle) {
        paceStr = secondsToPaceStr(val);
      } else {
        paceStr = `${secondsToPaceStr(end)} - ${secondsToPaceStr(start)}`;
      }
      break;
    }

    // -------------------------------------------------------------------
    // 2. PERCENTAGE OF THRESHOLD (%pace)
    // -------------------------------------------------------------------
    case '%pace': {
      const thresholdSec = Number(paceDetails?.run_pace_sec || paceDetails?.threshold_pace_sec);
      const calc = (pct) => thresholdSec > 0 && Number(pct) > 0 ? thresholdSec / (Number(pct) / 100) : NaN;
      const first = isSingle ? val : pace.start;
      const last = isSingle ? val : pace.end;
      const fast = Math.min(calc(first), calc(last));
      const slow = Math.max(calc(first), calc(last));
      paceStr = Number.isFinite(fast) && Number.isFinite(slow) ? (fast === slow ? secondsToPaceStr(fast) : `${secondsToPaceStr(fast)} - ${secondsToPaceStr(slow)}`) : 'N/A';
      paceMethodStr = isSingle ? `(${val}% threshold)` : `(${Math.min(first, last)}-${Math.max(first, last)}% threshold)`;
      break;
    }

    // -------------------------------------------------------------------
    // 3. PACE ZONE (Numeric Zone IDs)
    // -------------------------------------------------------------------
    case 'pace_zone': {
      const selectedIds = isSingle ? [Number(val)] : [Number(pace.start), Number(pace.end)];
      const selectedZones = (zoneList || []).filter((z) => selectedIds.every(Number.isFinite) && Number(z.zone) >= Math.min(...selectedIds) && Number(z.zone) <= Math.max(...selectedIds));
      const parseBoundary = (value) => {
        if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
        const match = String(value || '').match(/(\d+):(\d{2})/);
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
      };
      const fastCandidates = selectedZones.map((z) => parseBoundary(z.pace_fast) || parseBoundary(z.pace_val_sec)).filter((v) => v > 0);
      const slowCandidates = selectedZones.map((z) => parseBoundary(z.pace_slow) || ((parseBoundary(z.pace_fast) || parseBoundary(z.pace_val_sec) || 0) + 120)).filter((v) => v > 0);
      if (fastCandidates.length && slowCandidates.length) {
        const fast = Math.min(...fastCandidates);
        const slow = Math.max(...slowCandidates);
        paceStr = fast === slow ? secondsToPaceStr(fast) : `${secondsToPaceStr(fast)} - ${secondsToPaceStr(slow)}`;
      } else {
        paceStr = 'N/A';
      }
      paceMethodStr = isSingle ? `(Zone ${val})` : `(Zones ${Math.min(...selectedIds)}-${Math.max(...selectedIds)})`;
      break;
    }
  }

  return paceStr + (paceMethodStr ? ` ${paceMethodStr}` : '');
};

const parseSingleStep = (s, idx, thresholdPaceMps, zoneList, paceDetails, isRunning) => {
  const rawIntensity = s.intensity || (s.warmup ? "warmup" : s.cooldown ? "cooldown" : "active");
  return {
    id: idx,
    isRepeat: false,
    tss: isRunning ? estimateRunningStep(s, paceDetails).tss : null,
    durationSec: s.duration || 0,
    intensity: formatIntensityTitleCase(rawIntensity),
    paceStr: formatPaceString(s, thresholdPaceMps, zoneList, paceDetails),
    text: s.text || "No step text"
  };
};

const parseWorkoutSteps = (stepList, thresholdPaceMps, zonelist, paceDetails, isRunning) => {
  if (!Array.isArray(stepList)) return [];

  return stepList.map((s, idx) => {
    // Handle Repeat Blocks
    if (Array.isArray(s.steps) && s.steps.length > 0) {
      const reps = s.reps && Number.isInteger(s.reps) && s.reps > 0 ? s.reps : 1;
      const innerSteps = parseWorkoutSteps(s.steps, thresholdPaceMps, zonelist, paceDetails, isRunning);
      
      const singleCycleDuration = innerSteps.reduce((sum, inner) => sum + inner.durationSec, 0);
      const totalRepeatDuration = singleCycleDuration * reps;

      return {
        id: idx,
        isRepeat: true,
        tss: estimateRunningStep(s, paceDetails).tss,
        reps,
        durationSec: totalRepeatDuration,
        innerSteps,
        text: s.text || null
      };
    }

    // Handle Standard Steps
    return parseSingleStep(s, idx, thresholdPaceMps, zonelist, paceDetails, isRunning);
  });
};

const estimateStepMiles = (step) => {
  if (step.isRepeat) return step.reps * step.innerSteps.reduce((sum, inner) => sum + estimateStepMiles(inner), 0);
  const matches = [...(step.paceStr || '').matchAll(/(\d{1,2}):(\d{2})(?!\d)/g)];
  const paceSeconds = matches.map((match) => Number(match[1]) * 60 + Number(match[2])).filter((seconds) => seconds > 0);
  if (!paceSeconds.length || !step.durationSec) return 0;
  return step.durationSec / (paceSeconds.reduce((sum, seconds) => sum + seconds, 0) / paceSeconds.length);
};

const formatTss = (value) => value === null || value === undefined ? 'TSS: — (missing data)' : `TSS: ${value.toFixed(1)}`;

// Match by elapsed-time overlap, not interval count. A recorded mile split can
// span two planned steps; distribute its distance proportionally across both.
// This is an approximation until higher-resolution activity samples are available.
const matchExecutedSteps = (planned, intervals, paces, isRunning) => {
  const flattened = [];
  const collect = (steps) => steps.forEach((step) => {
    if (step.isRepeat) {
      for (let rep = 0; rep < step.reps; rep++) collect(step.innerSteps);
    } else flattened.push(step);
  });
  collect(planned);
  const matches = new Map();
  if (!flattened.length || !intervals.length) return matches;

  const plannedDuration = flattened.reduce((sum, step) => sum + Number(step.durationSec || 0), 0);
  const recordedDuration = intervals.reduce((sum, interval) => sum + Number(interval.elapsed_time ?? interval.duration ?? 0), 0);
  if (!(plannedDuration > 0) || !(recordedDuration > 0)) return matches;
  // Intervals may include mile splits and lap markers. Do not reject the
  // entire workout because its summed interval durations differ from the plan.

  const threshold = isRunning ? getRunningThreshold(paces) : null;
  let recordedOffset = 0;
  const spans = intervals.map((interval) => {
    const seconds = Number(interval.elapsed_time ?? interval.duration);
    const speed = Number(interval.average_speed ?? interval.speed);
    const rawDistance = Number(interval.distance);
    const start = recordedOffset;
    recordedOffset += Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    return {
      start, end: recordedOffset, seconds,
      distanceMeters: rawDistance > 0 ? rawDistance : speed > 0 ? speed * seconds : null
    };
  });

  let plannedOffset = 0;
  flattened.forEach((step, index) => {
    const start = plannedOffset;
    const duration = Number(step.durationSec || 0);
    plannedOffset += duration;
    if (!(duration > 0)) return;

    let coveredSeconds = 0;
    let distanceMeters = 0;
    let complete = true;
    for (const span of spans) {
      const overlap = Math.max(0, Math.min(plannedOffset, span.end) - Math.max(start, span.start));
      if (!overlap) continue;
      coveredSeconds += overlap;
      if (!(span.seconds > 0) || !(span.distanceMeters > 0)) {
        complete = false;
        continue;
      }
      distanceMeters += span.distanceMeters * overlap / span.seconds;
    }
    if (!complete || coveredSeconds < duration * 0.8 || !(distanceMeters > 0)) return;
    const miles = distanceMeters / 1609.344;
    const pace = coveredSeconds / miles;
    matches.set(index, {
      seconds: coveredSeconds, pace, miles,
      partial: coveredSeconds < duration - 1,
      tss: threshold ? 100 * (coveredSeconds / 3600) * (threshold / pace) ** 2 : null
    });
  });
  // Capture recorded intervals beyond the end of the planned timeline.
  // Do not assign these to the last planned step.
  let extraSeconds = 0;
  let extraMeters = 0;
  let extraComplete = true;
  for (const span of spans) {
    const overlap = Math.max(0, span.end - Math.max(plannedDuration, span.start));
    if (!overlap) continue;
    extraSeconds += overlap;
    if (!(span.seconds > 0) || !(span.distanceMeters > 0)) extraComplete = false;
    else extraMeters += span.distanceMeters * overlap / span.seconds;
  }
  if (extraSeconds > 1) {
    const miles = extraComplete && extraMeters > 0 ? extraMeters / 1609.344 : null;
    const pace = miles ? extraSeconds / miles : null;
    matches.extra = {
      seconds: extraSeconds, miles, pace,
      tss: threshold && pace ? 100 * (extraSeconds / 3600) * (threshold / pace) ** 2 : null
    };
  }
  return matches;
};

const RenderExecutedInterval = ({ interval, index, threshold, running }) => {
  const seconds = Number(interval.elapsed_time ?? interval.duration);
  const speed = Number(interval.average_speed ?? interval.speed);
  const rawDistance = Number(interval.distance);
  const miles = rawDistance > 0 ? rawDistance / 1609.344
    : seconds > 0 && speed > 0 ? seconds * speed / 1609.344 : null;
  const pace = seconds > 0 && miles > 0 ? seconds / miles : null;
  const tss = running && threshold && pace && seconds > 0
    ? 100 * (seconds / 3600) * (threshold / pace) ** 2 : null;
  return (
    <div className="workout-step-card workout-executed-only-step">
      <strong>Executed interval {index + 1}</strong>
      <span>Time: {seconds > 0 ? formatDuration(seconds) : '—'}</span>
      <span>Pace: {pace ? secondsToPaceStr(pace) : '—'}</span>
      <span>Distance: {miles !== null ? miles.toFixed(2) + ' mi' : '—'}</span>
      {running && <span>{formatTss(tss)}</span>}
    </div>
  );
};

// Aggregate the same flattened step matches used by each repetition card.
// The counter points to the first executed step inside this repeat block.
const countRepeatLeaves = (steps) => steps.reduce((total, step) =>
  total + (step.isRepeat ? step.reps * countRepeatLeaves(step.innerSteps) : 1), 0);

const summarizeRepeatExecution = (step, matches, startIndex, isRunning) => {
  const count = step.reps * countRepeatLeaves(step.innerSteps);
  const entries = Array.from({ length: count }, (_, index) => matches.get(startIndex + index));
  const matched = entries.filter(Boolean);
  if (!matched.length) return null;
  const seconds = matched.reduce((total, entry) => total + entry.seconds, 0);
  const miles = matched.reduce((total, entry) => total + entry.miles, 0);
  const hasAll = matched.length === count;
  const tssAvailable = isRunning && matched.every((entry) => entry.tss !== null && Number.isFinite(entry.tss));
  return {
    seconds, miles, pace: miles > 0 ? seconds / miles : null,
    tss: tssAvailable ? matched.reduce((total, entry) => total + entry.tss, 0) : null,
    partial: !hasAll || matched.some((entry) => entry.partial)
  };
};

const RenderStepCard = ({ step, matches, counter, hasExecution, isRunning }) => {
  if (step.isRepeat) {
    const repeatExecuted = hasExecution
      ? summarizeRepeatExecution(step, matches, counter.current, isRunning)
      : null;
    return (
      <div className="workout-step-card workout-repeat-block">
        <div className="workout-repeat-header">
          <span className="workout-repeat-title">
            Repeat {step.reps}x
          </span>
          {step.text && (
            <span className="workout-repeat-note-inline">
              "{step.text}"
            </span>
          )}
          <span className="workout-section-badge">
            Repeat Time: {formatDuration(step.durationSec)}
          </span>
          <span className="workout-section-badge">Est. Distance: {estimateStepMiles(step).toFixed(2)} mi</span>
          <span className="workout-section-badge">{isRunning ? formatTss(step.tss) : 'TSS: — (not supported)'}</span>
          {hasExecution && (
            <span className="workout-repeat-executed-summary">
              <strong>Executed{repeatExecuted?.partial ? ' (partial)' : ''}</strong>
              {repeatExecuted ? (
                <>
                  <span>Time: {formatDuration(repeatExecuted.seconds)}</span>
                  <span>Distance: {repeatExecuted.miles.toFixed(2)} mi</span>
                  <span>Pace: {repeatExecuted.pace ? secondsToPaceStr(repeatExecuted.pace) : '—'}</span>
                  <span>{isRunning ? formatTss(repeatExecuted.tss) : 'TSS: — (not supported)'}</span>
                </>
              ) : <span>Not matched</span>}
            </span>
          )}
        </div>

        <div className="workout-repeat-inner-list">
          {Array.from({ length: step.reps }, (_, repetition) => (
            <React.Fragment key={repetition}>
              {step.reps > 1 && <div className="workout-repeat-iteration">Repetition {repetition + 1}</div>}
              {step.innerSteps.map((innerStep, iIdx) => (
                <RenderStepCard key={iIdx} step={innerStep} matches={matches} counter={counter} hasExecution={hasExecution} isRunning={isRunning} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  const executed = matches.get(counter.current++);
  return (
    <div className={`workout-step-card ${hasExecution ? "workout-step-comparison" : ""}`}>
      <div className="workout-step-planned">
      {/* Line 1: Details */}
      <div className="workout-step-row">
        <span className="workout-step-label">Details:</span>
        <span className="workout-step-details-inline">
          <span className="workout-step-value">{step.intensity}</span>
          <span className="workout-step-connector">for</span>
          <span className="workout-step-value">{formatDuration(step.durationSec)}</span>
          <span className="workout-step-connector">at</span>
          <span className="workout-step-value">{step.paceStr}</span>
          <span className="workout-step-connector">· est.</span>
          <span className="workout-step-value">{estimateStepMiles(step).toFixed(2)} mi</span>
          <span className="workout-step-connector">·</span>
          <span className="workout-step-value">{isRunning ? formatTss(step.tss) : "TSS: — (not supported)"}</span>
        </span>
      </div>

      {/* Line 2: Text */}
      <div className="workout-step-row">
        <span className="workout-step-label">Text:</span>
        <span className="workout-step-text">"{step.text}"</span>
      </div>
      </div>
      {hasExecution && <div className="workout-step-executed">
        <strong>Executed {executed?.partial ? '(partial)' : ''}</strong>
        {executed ? (
          <>
            <div>Time: {formatDuration(executed.seconds)}</div>
            <div>Pace: {secondsToPaceStr(executed.pace)}</div>
            <div>Distance: {executed.miles.toFixed(2)} mi</div>
            <div>{isRunning ? formatTss(executed.tss) : 'TSS: — (not supported)'}</div>
          </>
        ) : <div className="workout-execution-unmatched">Not matched</div>}
      </div>}
    </div>
  );
};

  // 
  //
  // --------------------------------------------------------------------- //
  // MAIN FUNCTION SECTION
  // --------------------------------------------------------------------- //
  //
  //
  export default function WorkoutTextSection({ workout, thresholdPace = null, paceDetails }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workout) return null;

  let rawSteps = [];
  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      rawSteps = doc?.steps || [];
    } catch (e) {
      console.error("Failed to parse workout_doc", e);
    }
  }

  // thresholdPace passes as sec/mi (3.2512 for 8:15/mi pace)
  const thresholdPaceMps = thresholdPace;

  const zoneList = paceDetails?.preset_colors;

  const isRunning = /run|running/i.test(String(workout.type || workout.sport || ''));
  const parsedSteps = parseWorkoutSteps(rawSteps, thresholdPaceMps, zoneList, paceDetails, isRunning);
  const executedIntervals = extractExecutedSteps(workout);
  const hasExecution = executedIntervals.length > 0;
  const runningThreshold = isRunning ? getRunningThreshold(paceDetails) : null;
  const executedMatches = matchExecutedSteps(parsedSteps, executedIntervals, paceDetails, isRunning);
  const executionCounter = { current: 0 };
  const plannedTss = estimateRunningWorkout(workout, paceDetails).tss;
  const validPositive = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  // Prefer activity-level totals; intervals can contain extra splits/laps.
  const executedTime = validPositive(workout.moving_time) ?? validPositive(workout.elapsed_time) ??
    (hasExecution ? executedIntervals.reduce((total, interval) => total + (validPositive(interval.elapsed_time ?? interval.duration) ?? 0), 0) : null);
  const executedDistance = validPositive(workout.distance) ??
    (hasExecution && executedIntervals.every((interval) => validPositive(interval.distance) !== null)
      ? executedIntervals.reduce((total, interval) => total + Number(interval.distance), 0) : null);
  const executedTss = getExecutedTss(workout);

  const extraRecorded = executedMatches.extra ?? null;
  // If the activity total extends beyond the available interval timeline, report
  // the remaining time without inventing pace, distance, or step TSS.
  const unmatchedExtraSeconds = executedTime !== null
    ? Math.max(0, executedTime - Math.max(
        parsedSteps.reduce((sum, step) => sum + step.durationSec, 0) + (extraRecorded?.seconds ?? 0),
        executedIntervals.reduce((sum, interval) => sum + (validPositive(interval.elapsed_time ?? interval.duration) ?? 0), 0)
      ))
    : 0;
  const estimatedDistanceMiles = parsedSteps.reduce((sum, step) => sum + estimateStepMiles(step), 0);

  // Calculate Total Overall Workout Duration
  const totalWorkoutDurationSec = parsedSteps.reduce((sum, step) => sum + step.durationSec, 0);

  // 
  //
  // --------------------------------------------------------------------- //
  // Return the text for the WORKOUT details
  // --------------------------------------------------------------------- //
  //
  //
  return (
    <div className="workout-section-container">
      <div className="workout-section-header-box">
        <div 
          onClick={() => setIsOpen((prev) => !prev)}
          className="workout-section-toggle"
        >
          <span className="workout-section-title">
            {isOpen ? '▼' : '►'} Workout Details ({parsedSteps.length || executedIntervals.length} block{(parsedSteps.length || executedIntervals.length) === 1 ? '' : 's'})
          </span>
          <span className="workout-section-summary workout-section-summary-stacked">
            {parsedSteps.length > 0 && (
              <span className="workout-section-summary-line">
                <span className="workout-section-summary-label">Planned</span>
                <span className="workout-section-badge">Time: {formatDuration(totalWorkoutDurationSec)}</span>
                <span className="workout-section-badge">Distance: {estimatedDistanceMiles.toFixed(2)} mi</span>
                <span className="workout-section-badge">{formatTss(plannedTss)}</span>
              </span>
            )}
            {hasExecution && (
              <span className="workout-section-summary-line">
                <span className="workout-section-summary-label">Executed</span>
                <span className="workout-section-badge">Time: {executedTime !== null ? formatDuration(executedTime) : '—'}</span>
                <span className="workout-section-badge">Distance: {executedDistance !== null ? (executedDistance / 1609.344).toFixed(2) + ' mi' : '—'}</span>
                <span className="workout-section-badge">{formatTss(executedTss)}</span>
              </span>
            )}
          </span>
        </div>

        {isOpen && (
          <div className="workout-section-content">
            {parsedSteps.length === 0 ? (
              hasExecution ? (
                <div className="workout-steps-list">
                  {executedIntervals.map((interval, index) => (
                    <RenderExecutedInterval key={index} interval={interval} index={index} threshold={runningThreshold} running={isRunning} />
                  ))}
                </div>
              ) : <div className="workout-section-empty">No planned or executed step data available.</div>
            ) : (
              <div className="workout-steps-list">
                {parsedSteps.map((step, sIdx) => (
                  <RenderStepCard key={sIdx} step={step} matches={hasExecution ? executedMatches : new Map()} counter={executionCounter} hasExecution={hasExecution} isRunning={isRunning} />
                ))}
                {extraRecorded && (
                  <div className="workout-step-card workout-extra-execution">
                    <strong>Additional Executed (after planned workout)</strong>
                    <span>Time: {formatDuration(extraRecorded.seconds)}</span>
                    <span>Pace: {extraRecorded.pace ? secondsToPaceStr(extraRecorded.pace) : '—'}</span>
                    <span>Distance: {extraRecorded.miles !== null ? extraRecorded.miles.toFixed(2) + ' mi' : '—'}</span>
                    <span>{isRunning ? formatTss(extraRecorded.tss) : 'TSS: — (not supported)'}</span>
                  </div>
                )}
                {unmatchedExtraSeconds > 1 && (
                  <div className="workout-step-card workout-extra-execution">
                    <strong>Additional recorded time (no matching interval details)</strong>
                    <span>Time: {formatDuration(unmatchedExtraSeconds)}</span>
                    <span>Pace, distance and step TSS unavailable</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
