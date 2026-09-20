import React, { useId, useState } from 'react';
import '../CSS/WorkoutChart.css';
import { usePaces } from '../utils/PacesContext.jsx';
import {
  formatIntensityTitleCase,
  parseBoolProp,
  speedToPaceSeconds,
  formatSecPerMileToStr,
  extractPlannedSteps,
  extractExecutedSteps,
  flattenSteps,
  generateWavyBarPath,
} from '../utils/WorkoutChartHelpers.js';

const SLOW_BUFFER_MINUTES = 1;
const FAST_BUFFER_MINUTES = 1;
const DEFAULT_FALLBACK_THRESHOLD_SEC = 480;

// Fallback zone config if PacesContext is not available
const DEFAULT_PACE_ZONES = [80, 92, 94.3, 100, 103.4, 111.5, 150];
const DEFAULT_PACE_ZONE_NAMES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5a", "Zone 5b", "Zone 5c"];
const DEFAULT_PACE_ZONE_COLORS = ["#88d8b0", "#fd7e14", "#fd7e14", "#ff6b6b", "#dc3545", "#6f42c1", "#343a40"];

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

/**
 * Dynamically resolves zone details using PacesContext zones, names, and colors.
 */
const getZoneDetailsFromPaces = (targetPct, stepType = '', pacesData) => {
  const typeLower = String(stepType).toLowerCase();

  const zones = pacesData?.pace_zones || DEFAULT_PACE_ZONES;
  const names = pacesData?.pace_zone_names || DEFAULT_PACE_ZONE_NAMES;
  const colors = pacesData?.pace_zone_colors || DEFAULT_PACE_ZONE_COLORS;

  if (typeLower.includes('warm') || typeLower.includes('cool') || typeLower.includes('recovery')) {
    return { name: names[0] || 'Recovery (Z1)', color: colors[0] || '#88d8b0' };
  }

  // Iterate through pace zone thresholds
  for (let i = 0; i < zones.length; i++) {
    if (targetPct <= zones[i]) {
      return {
        name: names[i] || `Zone ${i + 1}`,
        color: colors[i] || '#28a745'
      };
    }
  }

  // Fallback for extreme efforts above highest threshold
  const lastIdx = zones.length - 1;
  return {
    name: names[lastIdx] || `Zone ${zones.length}`,
    color: colors[lastIdx] || '#343a40'
  };
};

//
//
//
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
//
//
//
// START OF THE WORKOUTCHART CODE
//
export default function WorkoutChart({ 
  workout, 
  chartHeight = '140px',
  showYAxis,
  showWorkoutName = true,
  showThresholdPace = true,
  showYAxisLabels = true,
  showLegend = true,
  minimalXAxis = false,
  showHoverDetails = true
}) {
  const clipId = useId();
  const { pacesData } = usePaces();
  const [executedOnTop, setExecutedOnTop] = useState(true);
  const [isChartHovered, setIsChartHovered] = useState(false);

  // Safely parse boolean props
  const isWorkoutNameVisible = parseBoolProp(showWorkoutName, true);
  const isThresholdPaceVisible = parseBoolProp(showThresholdPace, true);
  const isLegendVisible = parseBoolProp(showLegend, true);
  const isMinimalXAxis = parseBoolProp(minimalXAxis, false);
  const isHoverDetailsEnabled = parseBoolProp(showHoverDetails, true);
  
  const renderYAxis = showYAxis !== undefined 
    ? parseBoolProp(showYAxis, true) 
    : parseBoolProp(showYAxisLabels, true);

  const workoutTitleStr = workout?.name || workout?.title || 'Workout';

  const plannedList = extractPlannedSteps(workout);
  const executedList = extractExecutedSteps(workout);

  if (!plannedList.length && !executedList.length) return null;

  const totalPlannedSec = plannedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalExecutedSec = executedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalDurationSec = Math.max(totalPlannedSec, totalExecutedSec, 1);
  const totalDurationMins = Math.round(totalDurationSec / 60);

  // Retrieve threshold pace directly from pacesData context
  const effectiveThreshold = pacesData?.threshold_pace || pacesData?.run_pace_sec;
  const thresholdSecPerMile = effectiveThreshold && effectiveThreshold > 0
    ? (effectiveThreshold < 15 ? speedToPaceSeconds(effectiveThreshold) : effectiveThreshold)
    : null;

  const thresholdDisplayStr = thresholdSecPerMile ? formatSecPerMileToStr(thresholdSecPerMile) : "Not Set";
  console.log("[App Debug] thresholdSecPerMile:", thresholdSecPerMile);

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

    const fastestMinuteRounded = Math.floor(fastestStepSec / 60) * 60;
    const chosenStartSec = Math.max(0, fastestMinuteRounded - (FAST_BUFFER_MINUTES * 60));

    const slowestMinuteRounded = Math.ceil(slowestStepSec / 60) * 60;
    const chosenEndSec = slowestMinuteRounded + (SLOW_BUFFER_MINUTES * 60);

    yFastestSec = chosenStartSec;
    ySlowestSec = chosenEndSec;

    const chosenStepSec = 60;
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
  const rawTimeTicks = primaryList.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  const maxLabels = 6;
  const stepInterval = Math.ceil(rawTimeTicks.length / maxLabels);
  const timeTicks = rawTimeTicks.filter((_, idx) => idx % stepInterval === 0 || idx === rawTimeTicks.length - 1);

  const computePaceToHeightPct = (paceSec) => {
    if (!paceSec || ySlowestSec <= yFastestSec) return 50;
    const pct = ((ySlowestSec - paceSec) / (ySlowestSec - yFastestSec)) * 100;
    return Math.min(Math.max(pct, 0), 100);
  };

  const hasHiddenDetails = !isWorkoutNameVisible || !isThresholdPaceVisible;
  const showTopBar = isWorkoutNameVisible || isLegendVisible || isThresholdPaceVisible;

  return (
    <div 
      className="workout-chart-container"
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsChartHovered(true)}
      onMouseLeave={() => setIsChartHovered(false)}
      onTouchStart={() => setIsChartHovered(true)}
    >
      {/* Top Header Row */}
      {showTopBar && (
        <div className="workout-chart-top-bar">
          {isWorkoutNameVisible && (
            <span className="workout-chart-title" style={{ fontWeight: 600, fontSize: '12px' }}>
              {workoutTitleStr}
            </span>
          )}

          {isLegendVisible && (
            <div className="workout-chart-legend">
              {plannedList.length > 0 && (
                <div className="workout-chart-legend-item">
                  <span className="workout-chart-legend-color planned" />
                  <span>Planned Pace</span>
                </div>
              )}
              {executedList.length > 0 && (
                <div className="workout-chart-legend-item">
                  <span className="workout-chart-legend-color executed" />
                  <span>Executed</span>
                </div>
              )}

              {plannedList.length > 0 && executedList.length > 0 && (
                <button
                  type="button"
                  className="workout-layer-swap-btn"
                  onClick={() => setExecutedOnTop((prev) => !prev)}
                  title={executedOnTop ? "Executed is in front. Click to bring Planned to front." : "Planned is in front. Click to bring Executed to front."}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    marginLeft: '8px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    color: 'inherit'
                  }}
                >
                  ⇄
                </button>
              )}
            </div>
          )}

          {isThresholdPaceVisible && (
            <span className="workout-section-badge">
              Threshold ({workout?.type || 'Sport'}): {thresholdDisplayStr}
            </span>
          )}
        </div>
      )}

      <div className="workout-chart-wrapper">
        {renderYAxis && (
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
        )}

        <div className="workout-chart-main">
          <div className="workout-chart-tracks" style={{ height: chartHeight }}>
            {/* PLANNED BARS LAYER */}
            {plannedList.length > 0 && (
              <div 
                className="workout-chart-bars track-planned" 
                style={{ zIndex: executedOnTop ? 1 : 2 }}
              >
                {plannedList.map((step, idx) => {
                  const durationMins = Math.round((step.duration || 60) / 60);
                  const widthPct = ((step.duration || 60) / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  const range = extractPaceRangeInSeconds(step, thresholdSecPerMile);
                  const zoneDetails = getZoneDetailsFromPaces(range.rangePct.mid, rawIntensity, pacesData);

                  const fastHeightPct = computePaceToHeightPct(range.fastSec);
                  const slowHeightPct = computePaceToHeightPct(range.slowSec);

                  const fastPaceStr = formatSecPerMileToStr(range.fastSec);
                  const slowPaceStr = formatSecPerMileToStr(range.slowSec);
                  const tooltipText = `Planned Step ${idx + 1}: ${intensityFormatted} (${zoneDetails.name}) | Target Range: ${fastPaceStr} - ${slowPaceStr} | Duration: ${durationMins}m`;

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
              <div 
                className="workout-chart-bars track-executed" 
                style={{ zIndex: executedOnTop ? 2 : 1, opacity: 0.65 }}
              >
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
                  
                  const durationMinutes = durationSec / 60;
                  const pathData = generateWavyBarPath(durationMinutes);

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
            {isMinimalXAxis ? (
              <>
                <span>0m</span>
                <span>{totalDurationMins}m</span>
              </>
            ) : (
              <>
                <span>0m</span>
                {timeTicks.map((t, i) => (
                  <span key={i}>{t}m</span>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hover tooltip for hidden fields */}
      {isHoverDetailsEnabled && hasHiddenDetails && isChartHovered && (
        <div 
          className="workout-chart-hover-tooltip"
          style={{
            position: 'absolute',
            top: '-8px',
            right: '12px',
            transform: 'translateY(-100%)',
            backgroundColor: 'rgba(33, 37, 41, 0.92)',
            color: '#ffffff',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'nowrap'
          }}
        >
          {!isWorkoutNameVisible && (
            <div><strong>Workout Name:</strong> {workoutTitleStr}</div>
          )}
          {!isThresholdPaceVisible && (
            <div><strong>Threshold Pace:</strong> {thresholdDisplayStr}</div>
          )}
        </div>
      )}
    </div>
  );
}