import React from 'react';
import './WorkoutChart.css';

// Adjustable buffer parameters (in minutes) for easy debugging
const SLOW_BUFFER_MINUTES = 2; // Buffer added below the slowest interval (slower pace)
const FAST_BUFFER_MINUTES = 1; // Buffer subtracted above the fastest interval (faster pace)

/**
 * Formats raw seconds per mile into clean "MM:SS /mi".
 * e.g., 753.87s -> "12:34 /mi"
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
 * Helper to normalize raw interval / event step objects into uniform structures.
 */
const normalizeStep = (step) => {
  if (!step) return null;

  const duration = step.duration || step.elapsed_time || 60;
  let pace = step.pace || null;

  // Handle intervals average speed (m/s) if pace isn't pre-calculated
  if (!pace && typeof step.average_speed === 'number' && step.average_speed > 0) {
    pace = 1609.344 / step.average_speed;
  } else if (!pace && typeof step.speed === 'number' && step.speed > 0) {
    pace = 1609.344 / step.speed;
  }

  return {
    ...step,
    duration,
    pace,
    type: step.type || step.intensity || 'active',
  };
};

/**
 * Helper to get pace in seconds per mile from a step object.
 */
const extractStepPaceInSeconds = (step, thresholdPaceSec) => {
  if (!step) return null;

  // 1. Direct step pace in seconds per mile
  if (typeof step.pace === 'number' && step.pace > 0) {
    return step.pace < 15 ? 1609.344 / step.pace : step.pace;
  }

  // 2. Direct speed property (m/s)
  if (typeof step.speed === 'number' && step.speed > 0) {
    return 1609.344 / step.speed;
  }

  // 3. Structured target range or intensity %
  const targetPct = extractTargetValue(step);
  if (thresholdPaceSec && thresholdPaceSec > 0 && targetPct > 0) {
    return thresholdPaceSec / (targetPct / 100);
  }

  return null;
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

  // Explicit check for warm/cool/rest tags
  if (typeLower.includes('warm') || typeLower.includes('cool') || typeLower.includes('rest') || targetPct < 75) {
    return { name: 'Warmup / Recovery (Z1)', color: '#6c757d' };
  }
  if (targetPct < 88) return { name: 'Endurance (Z2)', color: '#28a745' };
  if (targetPct < 96) return { name: 'Tempo (Z3)', color: '#ffc107' };
  if (targetPct <= 105) return { name: 'Threshold (Z4)', color: '#fd7e14' };
  return { name: 'Anaerobic / VO2 Max (Z5+)', color: '#dc3545' };
};

export default function WorkoutChart({ 
  plannedSteps = [], 
  executedSteps = [], 
  steps = [], 
  thresholdPace, 
  chartHeight = '140px' 
}) {
  // Support backwards compatibility with legacy `steps` prop
  const rawPlanned = Array.isArray(plannedSteps) && plannedSteps.length > 0 ? plannedSteps : steps;
  const rawExecuted = Array.isArray(executedSteps) ? executedSteps : [];

  const plannedList = rawPlanned.map(normalizeStep).filter(Boolean);
  const executedList = rawExecuted.map(normalizeStep).filter(Boolean);

  if (!plannedList.length && !executedList.length) return null;

  const totalPlannedSec = plannedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalExecutedSec = executedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalDurationSec = Math.max(totalPlannedSec, totalExecutedSec, 1);

  // Convert thresholdPace (m/s or sec/mi) strictly into seconds per mile
  const thresholdSecPerMile = thresholdPace && thresholdPace > 0
    ? (thresholdPace < 15 ? 1609.344 / thresholdPace : thresholdPace)
    : null;

  // Collect step paces across BOTH planned and executed datasets for accurate scale alignment
  const allStepsCombined = [...plannedList, ...executedList];
  const stepPacesSec = allStepsCombined
    .map((s) => extractStepPaceInSeconds(s, thresholdSecPerMile))
    .filter((p) => p !== null && !isNaN(p) && p > 0);

  let yTicks = [];
  let yFastestSec = 0; // Pace at top of chart
  let ySlowestSec = 0; // Pace at bottom of chart

  if (stepPacesSec.length > 0) {
    const fastestStepSec = Math.min(...stepPacesSec);
    const slowestStepSec = Math.max(...stepPacesSec);

    // Apply minute buffers in sec/mi space
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

  } else {
    const targetPcts = allStepsCombined.map((s) => extractTargetValue(s));
    const dataMinPct = Math.min(...targetPcts);
    const dataMaxPct = Math.max(...targetPcts);

    const slowBufferPct = SLOW_BUFFER_MINUTES * 10;
    const fastBufferPct = FAST_BUFFER_MINUTES * 10;
    const yMinPct = Math.max(0, dataMinPct - slowBufferPct);
    const yMaxPct = dataMaxPct + fastBufferPct;

    const tickRatios = [0, 0.25, 0.5, 0.75, 1.0];
    yTicks = tickRatios.map((r) => {
      const pctVal = yMaxPct - (yMaxPct - yMinPct) * r;
      return {
        label: `${Math.round(pctVal)}%`,
        topPct: r * 100
      };
    });
  }

  // Calculate cumulative X-axis timestamps (based on planned list or fallback)
  const primaryList = plannedList.length > 0 ? plannedList : executedList;
  let accumulatedSec = 0;
  const timeTicks = primaryList.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  /**
   * Helper to compute height % based on step metrics and chart limits
   */
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
      {/* CHART LEGEND */}
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

        {/* CHART & X-AXIS */}
        <div className="workout-chart-main">
          <div className="workout-chart-tracks" style={{ height: chartHeight }}>
            {/* PLANNED WORKOUT TRACK */}
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

            {/* EXECUTED WORKOUT TRACK */}
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