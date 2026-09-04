import React, { useId } from 'react';
import './WorkoutChart.css';

// --- CHART CONFIGURATION CONSTANTS ---
const WAVES_PER_MINUTE = 5.0; // Number of wave cycles per minute of duration
const WAVE_AMPLITUDE = 0.5;   // Wave amplitude in SVG viewBox height units (0-100 scale)

const SLOW_BUFFER_MINUTES = 2;
const FAST_BUFFER_MINUTES = 1;
const DEFAULT_FALLBACK_THRESHOLD_SEC = 480;

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

const speedToPaceSeconds = (speedMps) => {
  if (typeof speedMps !== 'number' || speedMps <= 0 || isNaN(speedMps)) return null;
  return 1609.344 / speedMps;
};

const flattenSteps = (stepsList) => {
  if (!Array.isArray(stepsList)) return [];

  return stepsList.reduce((acc, step) => {
    if (Array.isArray(step.steps) && step.steps.length > 0) {
      const reps = step.reps && Number.isInteger(step.reps) && step.reps > 0 ? step.reps : 1;
      const innerFlattened = flattenSteps(step.steps);

      for (let i = 0; i < reps; i++) {
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

const extractPaceRangePct = (step) => {
  if (!step) return { start: 100, end: 100, mid: 100 };

  if (step.pace && typeof step.pace === 'object') {
    const start = step.pace.start ?? step.pace.value ?? 100;
    const end = step.pace.end ?? start;
    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
      mid: (start + end) / 2
    };
  }

  const val = step.target ?? step.intensityPct ?? step.intensity;
  if (typeof val === 'number' && val > 0) {
    return { start: val, end: val, mid: val };
  }

  if (typeof val === 'object' && val !== null) {
    const start = val.start ?? val.value ?? 100;
    const end = val.end ?? start;
    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
      mid: (start + end) / 2
    };
  }

  return { start: 100, end: 100, mid: 100 };
};

const extractPaceRangeInSeconds = (step, thresholdSecPerMile) => {
  if (!step) return null;

  const rawSpeed = parseFloat(step.average_speed ?? step.speed);
  if (!isNaN(rawSpeed) && rawSpeed > 0) {
    const sec = speedToPaceSeconds(rawSpeed);
    return { fastSec: sec, slowSec: sec, midSec: sec, rangePct: { start: 100, end: 100, mid: 100 } };
  }

  if (typeof step.pace === 'number' && step.pace > 0) {
    const sec = step.pace < 15 ? speedToPaceSeconds(step.pace) : step.pace;
    return { fastSec: sec, slowSec: sec, midSec: sec, rangePct: { start: 100, end: 100, mid: 100 } };
  }

  const rangePct = extractPaceRangePct(step);
  const refThresholdSec = (thresholdSecPerMile && thresholdSecPerMile > 0)
    ? thresholdSecPerMile
    : DEFAULT_FALLBACK_THRESHOLD_SEC;

  const fastSec = rangePct.end > 0 ? refThresholdSec / (rangePct.end / 100) : refThresholdSec;
  const slowSec = rangePct.start > 0 ? refThresholdSec / (rangePct.start / 100) : refThresholdSec;
  const midSec = rangePct.mid > 0 ? refThresholdSec / (rangePct.mid / 100) : refThresholdSec;

  return { fastSec, slowSec, midSec, rangePct };
};

const extractPlannedSteps = (workout) => {
  if (!workout?.workout_doc) return [];
  try {
    const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
    const rawSteps = doc?.steps || [];
    const flattened = flattenSteps(rawSteps);

    return flattened.map((step) => ({
      ...step,
      duration: step.duration || step.elapsed_time || 60,
      type: step.type || step.text || (step.warmup ? 'Warmup' : step.cooldown ? 'Cooldown' : 'Active')
    }));
  } catch (e) {
    console.error('Error parsing workout_doc:', e);
    return [];
  }
};

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

/**
 * Generates an SVG path with an adjustable wave frequency and amplitude.
 * @param {number} cycles - Number of wave cycles across the top edge.
 * @param {number} amplitude - Wave amplitude height in viewBox percentage units.
 */
const generateWavyBarPath = (cycles = 6, amplitude = WAVE_AMPLITUDE) => {
  const amp = amplitude;
  const step = 100 / cycles;

  let topPath = `M 0 ${amp}`;
  for (let i = 0; i < cycles; i++) {
    const startX = i * step;
    const endX = startX + step;
    const cp1Y = i % 2 === 0 ? -amp : amp * 2;
    const cp2Y = i % 2 === 0 ? amp * 2 : -amp;

    topPath += ` C ${startX + step * 0.25} ${cp1Y}, ${startX + step * 0.75} ${cp2Y}, ${endX} ${i % 2 === 0 ? amp : 0}`;
  }

  return `
    ${topPath}
    L 100 100
    L 0 100
    Z
  `;
};

export default function WorkoutChart({ 
  workout, 
  thresholdPace, 
  chartHeight = '140px' 
}) {
  const clipId = useId();
  const plannedList = extractPlannedSteps(workout);
  const executedList = extractExecutedSteps(workout);

  if (!plannedList.length && !executedList.length) return null;

  const totalPlannedSec = plannedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalExecutedSec = executedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalDurationSec = Math.max(totalPlannedSec, totalExecutedSec, 1);

  const thresholdSecPerMile = thresholdPace && thresholdPace > 0
    ? (thresholdPace < 15 ? speedToPaceSeconds(thresholdPace) : thresholdPace)
    : null;

  const allStepsCombined = [...plannedList, ...executedList];
  const stepPacesSec = [];

  allStepsCombined.forEach((s) => {
    const parsed = extractPaceRangeInSeconds(s, thresholdSecPerMile);
    if (parsed) {
      if (parsed.fastSec) stepPacesSec.push(parsed.fastSec);
      if (parsed.slowSec) stepPacesSec.push(parsed.slowSec);
    }
  });

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

  const computePaceToHeightPct = (paceSec) => {
    if (!paceSec || ySlowestSec <= yFastestSec) return 50;
    const pct = ((ySlowestSec - paceSec) / (ySlowestSec - yFastestSec)) * 100;
    return Math.min(Math.max(pct, 0), 100);
  };

  return (
    <div className="workout-chart-container">
      <div className="workout-chart-legend">
        {plannedList.length > 0 && (
          <div className="workout-chart-legend-item">
            <span className="workout-chart-legend-color planned" />
            <span>Planned Pace Range</span>
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

        <div className="workout-chart-main">
          <div className="workout-chart-tracks" style={{ height: chartHeight }}>
            {/* PLANNED BARS LAYER */}
            {plannedList.length > 0 && (
              <div className="workout-chart-bars track-planned">
                {plannedList.map((step, idx) => {
                  const durationMins = Math.round((step.duration || 60) / 60);
                  const widthPct = ((step.duration || 60) / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  const range = extractPaceRangeInSeconds(step, thresholdSecPerMile);
                  const zoneDetails = getZoneDetails(range.rangePct.mid, rawIntensity);

                  const fastHeightPct = computePaceToHeightPct(range.fastSec);
                  const slowHeightPct = computePaceToHeightPct(range.slowSec);

                  const fastPaceStr = formatSecPerMileToStr(range.fastSec);
                  const slowPaceStr = formatSecPerMileToStr(range.slowSec);
                  const tooltipText = `Planned Step ${idx + 1}: ${intensityFormatted} | Target Range: ${fastPaceStr} - ${slowPaceStr} | Duration: ${durationMins}m`;

                  return (
                    <div
                      key={`plan-${idx}`}
                      title={tooltipText}
                      className="workout-chart-bar-container"
                      style={{ width: `${widthPct}%` }}
                    >
                      {fastHeightPct > slowHeightPct && (
                        <div
                          className="workout-chart-bar workout-chart-bar-planned-fast"
                          style={{
                            bottom: 0,
                            height: `${fastHeightPct}%`,
                            backgroundColor: zoneDetails.color
                          }}
                        />
                      )}

                      <div
                        className="workout-chart-bar workout-chart-bar-planned-slow"
                        style={{
                          bottom: 0,
                          height: `${slowHeightPct}%`,
                          backgroundColor: zoneDetails.color
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* EXECUTED BARS LAYER */}
            {executedList.length > 0 && (
              <div className="workout-chart-bars track-executed">
                {executedList.map((step, idx) => {
                  const durationSec = step.duration || 60;
                  const durationMins = Math.round(durationSec / 60);
                  const widthPct = (durationSec / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  const range = extractPaceRangeInSeconds(step, thresholdSecPerMile);
                  const heightPct = computePaceToHeightPct(range.midSec);

                  const paceRangeFormatted = formatSecPerMileToStr(range.midSec);
                  const tooltipText = `Executed Interval ${idx + 1}: ${intensityFormatted} | Avg Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;
                  
                  // Calculate wave cycles based on minutes elapsed
                  const durationMinutes = durationSec / 60;
                  const waveCycles = Math.max(2, Math.round(durationMinutes * WAVES_PER_MINUTE));
                  const pathData = generateWavyBarPath(waveCycles, WAVE_AMPLITUDE);

                  return (
                    <div
                      key={`exec-${idx}`}
                      title={tooltipText}
                      className="workout-chart-bar-container executed-wavy-container"
                      style={{ width: `${widthPct}%` }}
                    >
                      <svg
                        className="workout-chart-bar-executed-svg"
                        style={{
                          bottom: 0,
                          height: `${heightPct}%`
                        }}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <path
                          d={pathData}
                          className="executed-wavy-path"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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