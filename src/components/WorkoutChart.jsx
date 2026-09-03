import React from 'react';
import './WorkoutChart.css';

const SLOW_BUFFER_MINUTES = 2; // Buffer added below the slowest pace (bottom of chart)
const FAST_BUFFER_MINUTES = 1; // Buffer subtracted above the fastest pace (top of chart)
const DEFAULT_FALLBACK_THRESHOLD_SEC = 480; // Fallback threshold pace (8:00/mi) if none supplied

/**
 * Formats raw seconds per mile into clean "MM:SS /mi".
 */
const formatSecPerMileToStr = (secPerMile) => {
  if (!secPerMile || secPerMile <= 0 || isNaN(secPerMile)) return "N/A";

  const totalSecs = Math.round(secPerMile);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

const formatIntensityTitleCase = (val) => {
  if (!val) return "Active";
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Converts speed in m/s directly into pace in SECONDS per mile.
 */
const speedToPaceSeconds = (speedMps) => {
  if (typeof speedMps !== 'number' || speedMps <= 0 || isNaN(speedMps)) return null;
  return 1609.344 / speedMps;
};

/**
 * Recursive helper to flatten nested repeat steps (reps blocks)
 * Removes parent wrapper duration/distance so child steps retain their true step duration.
 */
const flattenSteps = (stepsList) => {
  if (!Array.isArray(stepsList)) return [];

  return stepsList.reduce((acc, step) => {
    if (Array.isArray(step.steps) && step.steps.length > 0) {
      const reps = step.reps && Number.isInteger(step.reps) && step.reps > 0 ? step.reps : 1;
      const innerFlattened = flattenSteps(step.steps);

      for (let i = 0; i < reps; i++) {
        // Strip parent 'steps', 'reps', 'duration', 'distance' from repeated child clones
        acc.push(...innerFlattened.map((s) => {
          const { steps, reps, duration, distance, ...cleanStep } = s;
          return {
            ...cleanStep,
            duration: s.duration || 60
          };
        }));
      }
    } else {
      acc.push(step);
    }
    return acc;
  }, []);
};

/**
 * Extracts raw target value (percentage of threshold speed/pace) from a step object
 */
const extractTargetPct = (step) => {
  if (!step) return 100;

  // 1. Intervals.icu pace object: { start: 101, end: 115, units: "%pace" }
  if (step.pace && typeof step.pace === 'object') {
    const start = step.pace.start ?? step.pace.value ?? 0;
    const end = step.pace.end ?? start;
    if (start > 0 || end > 0) return (start + end) / 2;
  }

  // 2. Direct numeric target or intensityPct
  const val = step.target ?? step.intensityPct ?? step.intensity;
  if (typeof val === 'number' && val > 0) return val;
  if (typeof val === 'object' && val !== null) {
    const start = val.start ?? val.value ?? 0;
    const end = val.end ?? start;
    if (start > 0 || end > 0) return (start + end) / 2;
  }

  return 100;
};

/**
 * Extracts step pace in seconds per mile from direct values or threshold percentages
 */
const extractStepPaceInSeconds = (step, thresholdSecPerMile) => {
  if (!step) return null;

  // Direct speed in m/s (from executed intervals)
  const rawSpeed = parseFloat(step.average_speed ?? step.speed);
  if (!isNaN(rawSpeed) && rawSpeed > 0) {
    return speedToPaceSeconds(rawSpeed);
  }

  // Direct pace in sec/mi or m/s
  if (typeof step.pace === 'number' && step.pace > 0) {
    return step.pace < 15 ? speedToPaceSeconds(step.pace) : step.pace;
  }

  // Percentage of threshold speed (%pace)
  const targetPct = extractTargetPct(step);
  const refThresholdSec = (thresholdSecPerMile && thresholdSecPerMile > 0)
    ? thresholdSecPerMile
    : DEFAULT_FALLBACK_THRESHOLD_SEC;

  if (targetPct > 0) {
    // Speed % is inverted for pace: higher % = faster speed = fewer seconds per mile
    return refThresholdSec / (targetPct / 100);
  }

  return null;
};

/**
 * Extracts and normalizes planned steps from workout_doc
 */
const extractPlannedSteps = (workout) => {
  if (!workout?.workout_doc) return [];
  try {
    const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
    const rawSteps = doc?.steps || [];
    const flattened = flattenSteps(rawSteps);

    return flattened.map((step) => {
      return {
        ...step,
        duration: step.duration || step.elapsed_time || 60,
        type: step.type || step.text || (step.warmup ? 'Warmup' : step.cooldown ? 'Cooldown' : 'Active')
      };
    });
  } catch (e) {
    console.error('Error parsing workout_doc:', e);
    return [];
  }
};

/**
 * Extracts and normalizes executed intervals
 */
const extractExecutedSteps = (workout) => {
  if (!workout || !Array.isArray(workout.intervals) || workout.intervals.length === 0) return [];

  return workout.intervals.map((interval) => {
    const rawSpeed = parseFloat(interval.average_speed ?? interval.speed);
    const speed = !isNaN(rawSpeed) && rawSpeed > 0 ? rawSpeed : null;

    return {
      ...interval,
      duration: interval.elapsed_time || interval.duration || 60,
      pace: speedToPaceSeconds(speed),
      speed: speed,
      type: interval.type || 'Interval'
    };
  });
};

const getZoneDetails = (targetPct, stepType = '') => {
  const typeLower = String(stepType).toLowerCase();

  if (typeLower.includes('warm') || typeLower.includes('cool') || typeLower.includes('recovery') || targetPct < 75) {
    return { name: 'Warmup / Recovery (Z1)', color: '#6c757d' };
  }
  if (targetPct < 88) return { name: 'Endurance (Z2)', color: '#28a745' };
  if (targetPct < 96) return { name: 'Tempo (Z3)', color: '#ffc107' };
  if (targetPct <= 105) return { name: 'Threshold (Z4)', color: '#fd7e14' };
  return { name: 'Anaerobic / VO2 Max (Z5+)', color: '#dc3545' };
};

export default function WorkoutChart({ 
  workout, 
  thresholdPace, 
  chartHeight = '140px' 
}) {
  const plannedList = extractPlannedSteps(workout);
  const executedList = extractExecutedSteps(workout);

  if (!plannedList.length && !executedList.length) return null;

  const totalPlannedSec = plannedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalExecutedSec = executedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalDurationSec = Math.max(totalPlannedSec, totalExecutedSec, 1);

  // Normalize threshold speed to seconds per mile
  const thresholdSecPerMile = thresholdPace && thresholdPace > 0
    ? (thresholdPace < 15 ? speedToPaceSeconds(thresholdPace) : thresholdPace)
    : null;

  const allStepsCombined = [...plannedList, ...executedList];
  const stepPacesSec = allStepsCombined
    .map((s) => extractStepPaceInSeconds(s, thresholdSecPerMile))
    .filter((p) => p !== null && !isNaN(p) && p > 0);

  let yTicks = [];
  let yFastestSec = 0;
  let ySlowestSec = 0;

  if (stepPacesSec.length > 0) {
    const fastestStepSec = Math.min(...stepPacesSec);
    const slowestStepSec = Math.max(...stepPacesSec);

    const rawFastSec = Math.max(30, fastestStepSec - (FAST_BUFFER_MINUTES * 60));
    const rawSlowSec = slowestStepSec + (SLOW_BUFFER_MINUTES * 60);

    const allowedStepSecs = [60, 90, 120];

    let chosenStepSec = 60;
    let bestTickCount = -1;
    let chosenStartSec = rawFastSec;
    let chosenEndSec = rawSlowSec;

    for (const stepSec of allowedStepSecs) {
      const roundedFast = Math.floor(rawFastSec / stepSec) * stepSec;
      const roundedSlow = Math.ceil(rawSlowSec / stepSec) * stepSec;
      const count = Math.round((roundedSlow - roundedFast) / stepSec) + 1;

      if (count >= 4 && count <= 6) {
        if (count >= bestTickCount) {
          bestTickCount = count;
          chosenStepSec = stepSec;
          chosenStartSec = roundedFast;
          chosenEndSec = roundedSlow;
        }
      }
    }

    if (bestTickCount === -1) {
      chosenStepSec = 60;
      chosenStartSec = Math.floor(rawFastSec / 60) * 60;
      chosenEndSec = Math.ceil(rawSlowSec / 60) * 60;
    }

    yFastestSec = chosenStartSec;
    ySlowestSec = chosenEndSec;

    const totalTicks = Math.round((chosenEndSec - chosenStartSec) / chosenStepSec) + 1;
    for (let i = 0; i < totalTicks; i++) {
      const currentSec = chosenStartSec + i * chosenStepSec;
      const topPct = totalTicks > 1 ? (i / (totalTicks - 1)) * 100 : 0;
      yTicks.push({
        label: formatSecPerMileToStr(currentSec),
        topPct: topPct
      });
    }
  }

  const primaryList = plannedList.length > 0 ? plannedList : executedList;
  let accumulatedSec = 0;
  const timeTicks = primaryList.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  const computeBarHeightPct = (step) => {
    const stepPaceSec = extractStepPaceInSeconds(step, thresholdSecPerMile);
    const targetPct = extractTargetPct(step);

    let heightPct = 50;
    if (stepPaceSec && ySlowestSec > yFastestSec) {
      // Faster pace (smaller seconds) = taller bar
      heightPct = ((ySlowestSec - stepPaceSec) / (ySlowestSec - yFastestSec)) * 100;
    }

    return {
      heightPct: Math.min(Math.max(heightPct, 8), 100),
      effectiveTargetPct: targetPct,
      stepPaceSec
    };
  };

  return (
    <div className="workout-chart-container">
      {/* LEGEND */}
      <div className="workout-chart-legend">
        {plannedList.length > 0 && (
          <div className="workout-chart-legend-item">
            <span className="workout-chart-legend-color planned" />
            <span>Planned</span>
          </div>
        )}
        {executedList.length > 0 && (
          <div className="workout-chart-legend-item">
            <span className="workout-chart-legend-color executed" />
            <span>Executed</span>
          </div>
        )}
      </div>

      <div className="workout-chart-wrapper">
        {/* Y-AXIS LABELS */}
        <div className="workout-chart-yaxis" style={{ height: chartHeight }}>
          {yTicks.map((tick, idx) => (
            <span 
              key={idx}
              className="workout-chart-ytick"
              style={{ top: `${tick.topPct}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* CHART TRACKS */}
        <div className="workout-chart-main">
          <div className="workout-chart-tracks" style={{ height: chartHeight }}>
            {/* PLANNED BARS */}
            {plannedList.length > 0 && (
              <div className="workout-chart-bars track-planned">
                {plannedList.map((step, idx) => {
                  const durationMins = Math.round((step.duration || 60) / 60);
                  const widthPct = ((step.duration || 60) / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  const { heightPct, effectiveTargetPct, stepPaceSec } = computeBarHeightPct(step);
                  const zoneDetails = getZoneDetails(effectiveTargetPct, rawIntensity);
                  const paceRangeFormatted = stepPaceSec ? formatSecPerMileToStr(stepPaceSec) : `${Math.round(effectiveTargetPct)}%`;
                  const tooltipText = `Planned Step ${idx + 1}: ${intensityFormatted} | Target Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;

                  return (
                    <div
                      key={`plan-${idx}`}
                      title={tooltipText}
                      className="workout-chart-bar workout-chart-bar-planned"
                      style={{
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        backgroundColor: zoneDetails.color
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* EXECUTED BARS */}
            {executedList.length > 0 && (
              <div className="workout-chart-bars track-executed">
                {executedList.map((step, idx) => {
                  const durationMins = Math.round((step.duration || 60) / 60);
                  const widthPct = ((step.duration || 60) / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  const { heightPct, effectiveTargetPct, stepPaceSec } = computeBarHeightPct(step);
                  const paceRangeFormatted = stepPaceSec ? formatSecPerMileToStr(stepPaceSec) : `${Math.round(effectiveTargetPct)}%`;
                  const tooltipText = `Executed Interval ${idx + 1}: ${intensityFormatted} | Avg Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;

                  return (
                    <div
                      key={`exec-${idx}`}
                      title={tooltipText}
                      className="workout-chart-bar workout-chart-bar-executed"
                      style={{
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* X-AXIS LABELS */}
          <div className="workout-chart-xaxis">
            <span>0m</span>
            {timeTicks.map((t, i) => (
              <span key={i}>{t}m</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}