//
// WorkoutChart.jsx
//
import React, { useId, useState } from 'react';
import '../CSS/WorkoutChart.css';
import { estimateRunningStep, getRunningThreshold } from '../utils/WorkoutTss.js';
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
  extractPaceRangeInSeconds,
  getZoneDetailsFromPaces,
  extractStepPaceRange
} from '../utils/WorkoutChartHelpers.js';

import { 
  convertWorkoutToTargetFormat,
  getDescriptiveText
} from '../utils/WorkoutConverter.js';

const SLOW_BUFFER_MINUTES = 1;
const FAST_BUFFER_MINUTES = 1;

// Helper to format total duration seconds into "#m#s" string
const formatDurationMinsSecs = (totalSec) => {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

//
// START OF THE WORKOUTCHART CODE
//
export default function WorkoutChart({ 
  workout, 
  chartHeight = '140px',
  showYAxis = true,
  showWorkoutName = true,
  showThresholdPace = true,
  showYAxisLabels = true,
  showLegend = true,
  minimalXAxis = false,
  showHoverDetails = true,
  showBarPace = false,
  enableTssToggle = true
}) {

  const clipId = useId();

  // Consume Paces Context
  const { paces, loading: pacesLoading } = usePaces();

  const [executedOnTop, setExecutedOnTop] = useState(true);
  const [chartMetric, setChartMetric] = useState('pace');
  const [isChartHovered, setIsChartHovered] = useState(false);

  // Safely parse boolean props
  const isWorkoutNameVisible = parseBoolProp(showWorkoutName, true);
  const isThresholdPaceVisible = parseBoolProp(showThresholdPace, true);
  const isLegendVisible = parseBoolProp(showLegend, true);
  const isMinimalXAxis = parseBoolProp(minimalXAxis, false);
  const isHoverDetailsEnabled = parseBoolProp(showHoverDetails, true);
  const isBarPaceVisible = parseBoolProp(showBarPace, false);
  
  const renderYAxis = showYAxis !== undefined 
    ? parseBoolProp(showYAxis, true) 
    : parseBoolProp(showYAxisLabels, true);

  const workoutTitleStr = workout?.name || workout?.title || 'Workout';

  const plannedList = extractPlannedSteps(workout);
  const executedList = extractExecutedSteps(workout);

  if (!plannedList.length && !executedList.length) return null;

  const isTssMode = enableTssToggle && chartMetric === 'tss';
  const runningSport = /run/i.test(String(workout?.type || workout?.sport || workout?.workout_doc?.type || 'Run'));
  const thresholdForTss = getRunningThreshold(paces);
  const plannedTss = plannedList.map((step) => runningSport ? estimateRunningStep(step, paces).tss : null);
  const executedTss = executedList.map((step) => {
    const seconds = Number(step.elapsed_time ?? step.duration);
    // An executed step must have recorded speed, not a planned pace or placeholder.
    const speed = Number(step.average_speed ?? step.speed);
    const pace = speed > 0 ? 1609.344 / speed : NaN;
    return runningSport && thresholdForTss && seconds > 0 && pace > 0
      ? 100 * (seconds / 3600) * (thresholdForTss / pace) ** 2 : null;
  });
  const validTss = [...plannedTss, ...executedTss].filter((value) => Number.isFinite(value) && value >= 0);
  const maxTss = Math.max(1, ...validTss);
  const tssAxisMax = Math.max(5, Math.ceil(maxTss / 5) * 5);
  // Use half-point tick increments and a top boundary rounded to a multiple of five.
  const tickStep = Math.max(0.5, Math.ceil((tssAxisMax / 6) * 2) / 2);
  const tssTicks = [{ label: tssAxisMax.toFixed(1), topPct: 0 }];
  for (let value = Math.floor((tssAxisMax - 0.001) / tickStep) * tickStep; value > 0; value -= tickStep) {
    tssTicks.push({ label: value.toFixed(1), topPct: (1 - value / tssAxisMax) * 100 });
  }
  tssTicks.push({ label: '0.0', topPct: 100 });
  const tssHeight = (value) => value === null || !Number.isFinite(value) ? 0 : Math.max(0, value / tssAxisMax * 100);

  const totalPlannedSec = plannedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalExecutedSec = executedList.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalDurationSec = Math.max(totalPlannedSec, totalExecutedSec, 1);
  const totalDurationMins = Math.round(totalDurationSec / 60);

  // thresholdSecPerMile will result in 495 for 8:15 pace.
  const thresholdSecPerMile = paces?.run_pace_sec;

  const thresholdDisplayStr = thresholdSecPerMile ? formatSecPerMileToStr(thresholdSecPerMile) : "Not Set";

  const allStepsCombined = [...plannedList, ...executedList];
  const stepPacesSec = [];

  allStepsCombined.forEach((s) => {
    const parsed = s.pace && typeof s.pace === 'object' && s.pace.units
      ? extractStepPaceRange(s.pace, paces)
      : extractPaceRangeInSeconds(s, thresholdSecPerMile, paces);
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

    // Choose a 30-second-aligned interval that keeps the axis readable.
    // Retain the full pace domain so planned/executed bars do not get clipped.
    const rangeSec = chosenEndSec - chosenStartSec;
    const chosenStepSec = Math.max(30, Math.ceil(rangeSec / (7 - 1) / 30) * 30);
    const totalTicks = Math.floor(rangeSec / chosenStepSec) + 1;

    for (let i = 0; i < totalTicks; i++) {
      const currentSec = chosenStartSec + i * chosenStepSec;
      const topPct = rangeSec > 0 ? ((currentSec - chosenStartSec) / rangeSec) * 100 : 0;
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
  const showTopBar = isWorkoutNameVisible || isLegendVisible || isThresholdPaceVisible || enableTssToggle;

  return (
    <div 
      className="workout-chart-container"
      style={{ position: 'relative' }}
      onMouseEnter={() => {
        setIsChartHovered(true);
      }}
      onMouseLeave={() => {
        setIsChartHovered(false);
      }}
      onTouchStart={() => {
        setIsChartHovered(true);
      }}
    >

      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Top Header Row */}
      {/* ------------------------------------------------------------------------------------------------ */}

      {showTopBar && (
        <div className="workout-chart-top-bar">
          {isWorkoutNameVisible && (
            <span className="workout-chart-title" style={{ fontWeight: 600, fontSize: '12px' }}>
              {workoutTitleStr}
            </span>
          )}

          {enableTssToggle && (
            <div className="workout-chart-header-slot workout-chart-metric-toggle">
              <span className={!isTssMode ? 'metric-active' : ''}>Pace</span>
              <button
                type="button"
                className="workout-chart-metric-switch"
                role="switch"
                aria-label="Show TSS instead of pace"
                aria-checked={isTssMode}
                onClick={() => setChartMetric(isTssMode ? 'pace' : 'tss')}
              ><span className="workout-chart-metric-thumb" /></button>
              <span className={isTssMode ? 'metric-active' : ''}>TSS</span>
            </div>
          )}
          {isLegendVisible && (
            <div className="workout-chart-legend workout-chart-header-slot">
              {plannedList.length > 0 && executedList.length > 0 ? (
                <div className="workout-chart-metric-toggle" title={executedOnTop ? 'Executed bars in front' : 'Planned bars in front'}>
                  <span className={executedOnTop ? '' : 'metric-active'}>
                    <span className="workout-chart-legend-color planned" /> Planned
                  </span>
                  <button
                    type="button"
                    className="workout-chart-metric-switch"
                    role="switch"
                    aria-label="Show executed bars in front of planned bars"
                    aria-checked={executedOnTop}
                    onClick={() => setExecutedOnTop((previous) => !previous)}
                  ><span className="workout-chart-metric-thumb" /></button>
                  <span className={executedOnTop ? 'metric-active' : ''}>
                    <span className="workout-chart-legend-color executed" /> Executed
                  </span>
                </div>
              ) : (
                <>
                  {plannedList.length > 0 && (
                    <div className="workout-chart-legend-item">
                      <span className="workout-chart-legend-color planned" />
                      <span>{isTssMode ? 'Planned TSS' : 'Planned Pace'}</span>
                    </div>
                  )}
                  {executedList.length > 0 && (
                    <div className="workout-chart-legend-item">
                      <span className="workout-chart-legend-color executed" />
                      <span>Executed</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="workout-chart-header-slot workout-chart-threshold-slot">
            {isThresholdPaceVisible && !isTssMode && (
              <span className="workout-section-badge">
                Threshold ({workout?.type || 'Sport'}): {thresholdDisplayStr}
              </span>
            )}
          </div>
        </div>
      )}


      {/* ------------------------------------------------------------------------------------------------ */}
      {/* MAIN CHART AREA */}
      {/* ------------------------------------------------------------------------------------------------ */}

      <div className="workout-chart-wrapper">

        {/* -------------------------------------------------------------------------------------- */}
        {/* Y-AXIS LABELS */}
        {/* -------------------------------------------------------------------------------------- */}

        {renderYAxis && (
          <div className="workout-chart-yaxis" style={{ height: chartHeight }}>
            {(isTssMode ? tssTicks : yTicks).map((tick, idx) => (
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


            {/* -------------------------------------------------------------------------------------- */}
            {/* PLANNED WORKOUT PRESENTATION */}
            {/* -------------------------------------------------------------------------------------- */}

            {plannedList.length > 0 && (
              <div 
                className="workout-chart-bars track-planned" 
                style={{ zIndex: executedOnTop ? 1 : 2 }}
              >

                {plannedList.map((step, idx) => {
                  const durationSecs = step.duration || 60;
                  const durationFormatted = formatDurationMinsSecs(durationSecs);
                  const widthPct = (durationSecs / totalDurationSec) * 100;
                  const rawIntensity = step.type || 'active';
                  const intensityFormatted = formatIntensityTitleCase(rawIntensity);

                  // Extract pace details using extractStepPaceRange
                  const range = extractStepPaceRange(step.pace, paces);


                  // zoneDetails (name and color) are derived from the fast pace
                  const zoneDetails = getZoneDetailsFromPaces(range.fastSec, paces);

                  const fastHeightPct = computePaceToHeightPct(range.fastSec);
                  const slowHeightPct = computePaceToHeightPct(range.slowSec);

                  // Get descriptive text for zone or fallback to extracted/formatted range strings
                  const descriptivePaceStr = getDescriptiveText(step.pace, paces);

                  const paceDetails = range.formattedText || descriptivePaceStr || 'N/A';

                  const tss = plannedTss[idx];
                  const tooltipText = isTssMode ? `${durationFormatted} · ${tss === null ? 'TSS unavailable' : `${tss.toFixed(1)} TSS`}` : `${durationFormatted} @ ${paceDetails}`;

                  return (
                    <div
                      key={`plan-${idx}`}
                      title={tooltipText}
                      className="workout-chart-bar-container"
                      style={{ width: `${widthPct}%`, position: 'relative' }}
                    >
                      {!isTssMode && fastHeightPct > slowHeightPct && (
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
                          height: `${isTssMode ? tssHeight(tss) : slowHeightPct}%`,
                          backgroundColor: zoneDetails.color
                        }}
                      />

                      {/* Display target pace on bar */}
                      {isBarPaceVisible && !isTssMode && (
                        <span
                          className="workout-chart-bar-label"
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '10px',
                            color: '#ffffff',
                            fontWeight: 600,
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            zIndex: 3
                          }}
                        >
                          {range.fastSec > 0 && range.slowSec > 0 ? formatPaceRange(range.fastSec, range.slowSec) : 'N/A'}
                        </span>
                      )}
                    </div>
                  );
                })}

              </div>
            )}


            {/* ------------------------------------------------------------------------------------- */}
            {/* EXECUTED WORKOUT PRESENTATION */}
            {/* ------------------------------------------------------------------------------------- */}

            {executedList.length > 0 && (
              <div 
                className="workout-chart-bars track-executed" 
                style={{ zIndex: executedOnTop ? 2 : 1, opacity: 0.65 }}
              >
                  {executedList.map((step, idx) => {
                    const durationSecs = step.duration || 60;
                    const durationFormatted = formatDurationMinsSecs(durationSecs);
                    const widthPct = (durationSecs / totalDurationSec) * 100;
                    const rawIntensity = step.type || 'active';
                    const intensityFormatted = formatIntensityTitleCase(rawIntensity);
  
                    // Extract step pace range for executed steps
                    const stepPace = { value: Math.round(step.pace), units: 'secs' };
                    const range = extractStepPaceRange(stepPace, paces);

                    const heightPct = computePaceToHeightPct(range.midSec);
  
                    const paceRangeFormatted = formatSecPerMileToStr(range.midSec);
                    const tss = executedTss[idx];
                    const tooltipText = isTssMode ? `${durationFormatted} · ${tss === null ? 'TSS unavailable' : `${tss.toFixed(1)} TSS`}` : `${durationFormatted} @ ${paceRangeFormatted}`;
                  
                    const durationMinutes = durationSecs / 60;
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
                          height: `${isTssMode ? tssHeight(tss) : heightPct}%`
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

          {/* -------------------------------------------------------------------------------------- */}
          {/* X-AXIS LABELS */}
          {/* -------------------------------------------------------------------------------------- */}

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

      {/* -------------------------------------------------------------------------------------- */}
      {/* HOVER TOOLTIPS */}
      {/* -------------------------------------------------------------------------------------- */}

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