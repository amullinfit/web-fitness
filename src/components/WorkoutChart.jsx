import React from 'react';
import './WorkoutChart.css';

// Adjustable buffer parameters (in minutes)
const SLOW_BUFFER_MINUTES = 2; // Buffer added below the slowest interval (slower pace)
const FAST_BUFFER_MINUTES = 1; // Buffer subtracted above the fastest interval (faster pace)

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
 */
const flattenSteps = (stepsList) => {
  if (!Array.isArray(stepsList)) return [];

  return stepsList.reduce((acc, step) => {
    if (Array.isArray(step.steps) && step.steps.length > 0) {
      const reps = step.reps && Number.isInteger(step.reps) && step.reps > 0 ? step.reps : 1;
      const innerFlattened = flattenSteps(step.steps);

      for (let i = 0; i < reps; i++) {
        acc.push(...innerFlattened.map((s) => ({ ...s })));
      }
    } else {
      acc.push(step);
    }
    return acc;
  }, []);
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
      const speed = step.speed ?? (typeof step.pace === 'number' ? step.pace : null);
      const computedPace = speedToPaceSeconds(speed) ?? (typeof step.pace === 'number' && step.pace > 15 ? step.pace : null);
      return {
        ...step,
        duration: step.duration || step.elapsed_time || 60,
        pace: computedPace,
        type: step.type || step.intensity || 'active'
      };
    });
  } catch (e) {
    console.error('Error parsing workout_doc:', e);
    return [];
  }
};

/**
 * Extracts and normalizes executed intervals from historical activity or paired event data
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

const extractTargetValue = (step) => {
  if (!step) return 100;

  if (step.pace && typeof step.pace === 'object') {
    const start = step.pace.start || 0;
    const end = step.pace.end || start;
    return (start + end) / 2;
  }

  const val = step.target || step.intensityPct;
  if (typeof val === 'number' && val > 0) return val;
  if (typeof val === 'object' && val !== null) {
    const start = val.start || 0;
    const end = val.end || start;
    return (start + end) / 2;
  }

  return 100;
};

const getZoneDetails = (targetPct, stepType = '') => {
  const typeLower = String(stepType).toLowerCase();

  if (typeLower.includes('warm') || typeLower.includes('cool') || typeLower.includes('rest') || targetPct < 75) {
    return { name: 'Warmup / Recovery (Z1)', color: '#6c757d' };
  }
  if (targetPct < 88) return { name: 'Endurance (Z2)', color: '#28a745' };
  if (targetPct < 96) return { name: 'Tempo (Z3)', color: '#ffc107' };
  if (targetPct <= 105) return { name: 'Threshold (Z4)', color: '#fd7e14' };
  return { name: 'Anaerobic / VO2 Max (Z5+)', color: '#dc3545' };
};

const extractStepPaceInSeconds = (step, thresholdSecPerMile) => {
  if (!step) return null;

  if (typeof step.pace === 'number' && step.pace > 0) {
    return step.pace < 15 ? 1609.344 / step.pace : step.pace;
  }

  if (typeof step.speed === 'number' && step.speed > 0) {
    return 1609.344 / step.speed;
  }

  const targetPct = extractTargetValue(step);
  if (thresholdSecPerMile && thresholdSecPerMile > 0 && targetPct > 0) {
    return thresholdSecPerMile / (targetPct / 100);
  }

  return null;
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

  // Convert thresholdPace (m/s or sec/mi) strictly into seconds per mile
  const thresholdSecPerMile = thresholdPace && thresholdPace > 0
    ? (thresholdPace < 15 ? 1609.344 / thresholdPace : thresholdPace)
    : null;

  // Collect step paces across ALL steps present in planned and executed datasets
  const allStepsCombined = [...plannedList, ...executedList];
  const stepPacesSec = allStepsCombined
    .map((s) => extractStepPaceInSeconds(s, thresholdSecPerMile))
    .filter((p) => p !== null && !isNaN(p) && p > 0);

  let yTicks = [];
  let yFastestSec = 0; // Top of chart (faster pace = smaller second count)
  let ySlowestSec = 0; // Bottom of chart (slower pace = larger second count)

  if (stepPacesSec.length > 0) {
    const fastestStepSec = Math.min(...stepPacesSec);
    const slowestStepSec = Math.max(...stepPacesSec);

    // Apply minute buffers in sec/mi space
    const rawFastSec = Math.max(30, fastestStepSec - (FAST_BUFFER_MINUTES * 60));
    const rawSlowSec = slowestStepSec + (SLOW_BUFFER_MINUTES * 60);

    // Allowed tick intervals: 1:00 (60s), 1:30 (90s), or 2:00 (120s)
    const allowedStepSecs = [60, 90, 120];

    let chosenStepSec = 60;
    let bestTickCount = -1;
    let chosenStartSec = rawFastSec;
    let chosenEndSec = rawSlowSec;

    for (const stepSec of allowedStepSecs) {
      const roundedFast = Math.floor(rawFastSec / stepSec) * stepSec;
      const roundedSlow = Math.ceil(rawSlowSec / stepSec) * stepSec;
      const count = Math.round((roundedSlow - roundedFast) / stepSec) + 1;

      // Prioritize 4 to 6 tick marks
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
  } else {
    // Fallback scaling if no explicit speed/pace values exist
    const targetPcts = allStepsCombined.map((s) => extractTargetValue(s));
    const dataMinPct = Math.min(...targetPcts);
    const dataMaxPct = Math.max(...targetPcts);

    const yMinPct = Math.max(0, dataMinPct - SLOW_BUFFER_MINUTES * 10);
    const yMaxPct = dataMaxPct + FAST_BUFFER_MINUTES * 10;

    const tickRatios = [0, 0.25, 0.5, 0.75, 1.0];
    yTicks = tickRatios.map((r) => {
      const pctVal = yMaxPct - (yMaxPct - yMinPct) * r;
      return {
        label: `${Math.round(pctVal)}%`,
        topPct: r * 100
      };
    });
  }

  // Calculate X-axis ticks (elapsed minutes) using primary track
  const primaryList = plannedList.length > 0 ? plannedList : executedList;
  let accumulatedSec = 0;
  const timeTicks = primaryList.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  const computeBarHeightPct = (step) => {
    const stepPaceSec = extractStepPaceInSeconds(step, thresholdSecPerMile);
    let effectiveTargetPct = extractTargetValue(step);
    if (thresholdSecPerMile && stepPaceSec) {
      effectiveTargetPct = (thresholdSecPerMile / stepPaceSec) * 100;
    }

    let heightPct = 50;
    if (stepPaceSec && ySlowestSec > yFastestSec) {
      heightPct = ((ySlowestSec - stepPaceSec) / (ySlowestSec - yFastestSec)) * 100;
    } else {
      const targetPcts = allStepsCombined.map((s) => extractTargetValue(s));
      const dataMinPct = Math.min(...targetPcts);
      const dataMaxPct = Math.max(...targetPcts);
      const yMinPct = Math.max(0, dataMinPct - SLOW_BUFFER_MINUTES * 10);
      const yMaxPct = dataMaxPct + FAST_BUFFER_MINUTES * 10;
      heightPct = ((effectiveTargetPct - yMinPct) / (yMaxPct - yMinPct || 1)) * 100;
    }

    return {
      heightPct: Math.min(Math.max(heightPct, 4), 100),
      effectiveTargetPct,
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

        {/* CHART TRACKS & X-AXIS */}
        <div className="workout-chart-main">
          <div className="workout-chart-tracks" style={{ height: chartHeight }}>
            {/* PLANNED BARS (Colored according to prescribed target ranges) */}
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
                  const tooltipText = `Planned Step ${idx + 1}: ${intensityFormatted} | Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;

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

            {/* EXECUTED BARS (Blue outline bars) */}
            {executedList.length > 0 && (
              <div className="workout-chart-bars track-executed">
                {executedList.map((step, idx) => {
                  const durationMins = Math.round((step.duration || 60) / 60);
                  const widthPct = ((step.duration || 60) / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  const { heightPct, effectiveTargetPct, stepPaceSec } = computeBarHeightPct(step);
                  const paceRangeFormatted = stepPaceSec ? formatSecPerMileToStr(stepPaceSec) : `${Math.round(effectiveTargetPct)}%`;
                  const tooltipText = `Executed Interval ${idx + 1}: ${intensityFormatted} | Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;

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