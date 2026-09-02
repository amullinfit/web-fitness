import React from 'react';

// Adjustable buffer parameters (in minutes) for easy debugging
const SLOW_BUFFER_MINUTES = 2; // Buffer added below the slowest interval (slower pace)
const FAST_BUFFER_MINUTES = 1; // Buffer subtracted above the fastest interval (faster pace)

/**
 * Converts meters per second (m/s) or raw seconds-per-mile into "MM:SS /mi" string.
 * Handles edge cases like 2.13476 m/s -> 12:34 /mi.
 */
const metersPerSecondToPaceStr = (mpsOrSec) => {
  if (!mpsOrSec || mpsOrSec <= 0 || isNaN(mpsOrSec)) return "N/A";

  // If value is small (e.g., < 15), assume m/s. Otherwise assume seconds per mile.
  const secPerMile = mpsOrSec < 15 ? 1609.344 / mpsOrSec : mpsOrSec;
  return formatSecPerMileToStr(secPerMile);
};

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
 * Helper to get pace in seconds per mile from a step object.
 */
const extractStepPaceInSeconds = (step, thresholdPaceSec) => {
  if (!step) return null;

  // 1. Direct step pace in seconds per mile (e.g., calculated via speedToPaceSeconds)
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

  return 100; // Default to 100% threshold effort rather than 80% if unassigned
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

export default function WorkoutChart({ steps = [], thresholdPace, chartHeight = '140px' }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const totalDurationSec = steps.reduce((sum, s) => sum + (s.duration || 0), 0) || 1;

  // Convert thresholdPace (m/s or sec/mi) strictly into seconds per mile
  const thresholdSecPerMile = thresholdPace && thresholdPace > 0
    ? (thresholdPace < 15 ? 1609.344 / thresholdPace : thresholdPace)
    : null;

  // Collect step paces in seconds per mile
  const stepPacesSec = steps
    .map((s) => extractStepPaceInSeconds(s, thresholdSecPerMile))
    .filter((p) => p !== null && !isNaN(p) && p > 0);

  let yTicks = [];
  let yFastestSec = 0; // Pace at the top of chart (lowest seconds/mile value)
  let ySlowestSec = 0; // Pace at the bottom of chart (highest seconds/mile value)

  if (stepPacesSec.length > 0) {
    const fastestStepSec = Math.min(...stepPacesSec);
    const slowestStepSec = Math.max(...stepPacesSec);

    // Apply minute buffers in sec/mi space
    const rawFastSec = Math.max(30, fastestStepSec - (FAST_BUFFER_MINUTES * 60));
    const rawSlowSec = slowestStepSec + (SLOW_BUFFER_MINUTES * 60);

    // Allowed tick step intervals (in seconds): 60s (1:00), 90s (1:30), 120s (2:00)
    const allowedStepSecs = [60, 90, 120];

    let chosenStepSec = 60;
    let bestTickCount = -1;
    let chosenStartSec = rawFastSec;
    let chosenEndSec = rawSlowSec;

    // Evaluate allowed step intervals to pick 4-6 ticks
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

    // Fallback if bounds fall outside standard 4-6 range
    if (bestTickCount === -1) {
      chosenStepSec = 60;
      chosenStartSec = Math.floor(rawFastSec / 60) * 60;
      chosenEndSec = Math.ceil(rawSlowSec / 60) * 60;
    }

    yFastestSec = chosenStartSec;
    ySlowestSec = chosenEndSec;

    // Generate tick objects (evenly spaced from top to bottom)
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
    // Percentage fallback mode
    const targetPcts = steps.map((s) => extractTargetValue(s));
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

  let accumulatedSec = 0;
  const timeTicks = steps.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  return (
    <div style={{ margin: '16px 0', border: '1px solid #e9ecef', borderRadius: '8px', padding: '16px', backgroundColor: '#fcfcfc' }}>
      <div style={{ display: 'flex' }}>
        {/* EVENLY SPACED Y-AXIS LABELS */}
        <div 
          style={{ 
            position: 'relative',
            height: chartHeight, 
            width: '75px',
            marginRight: '12px', 
            fontSize: '10px', 
            color: '#6c757d', 
            fontWeight: '600',
            lineHeight: '1'
          }}
        >
          {yTicks.map((tick, idx) => (
            <span 
              key={idx}
              style={{
                position: 'absolute',
                right: 0,
                top: `${tick.topPct}%`,
                transform: 'translateY(-50%)',
                whiteSpace: 'nowrap'
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* CHART & X-AXIS AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Bars Container */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              height: chartHeight, 
              gap: '3px', 
              paddingBottom: '4px', 
              borderBottom: '2px solid #dee2e6',
              borderLeft: '1px solid #dee2e6',
              position: 'relative'
            }}
          >
            {steps.map((step, idx) => {
              const duration = step.duration || 60;
              const durationMins = Math.round(duration / 60);
              const widthPct = (duration / totalDurationSec) * 100;

              const rawIntensity = step.intensity || (step.warmup ? 'warmup' : step.cooldown ? 'cooldown' : step.type || 'active');
              const intensityFormatted = formatIntensityTitleCase(rawIntensity);
              
              const targetPct = extractTargetValue(step);
              const zoneDetails = getZoneDetails(targetPct, rawIntensity);
              const barColor = zoneDetails.color;

              const stepPaceSec = extractStepPaceInSeconds(step, thresholdSecPerMile);
              const paceRangeFormatted = stepPaceSec ? formatSecPerMileToStr(stepPaceSec) : `${Math.round(targetPct)}%`;
              
              // Calculate height directly from tick pace bounds
              let heightPct = 50;
              if (stepPaceSec && ySlowestSec > yFastestSec) {
                // Scale height based on position between slowest (bottom = 0%) and fastest (top = 100%)
                heightPct = ((ySlowestSec - stepPaceSec) / (ySlowestSec - yFastestSec)) * 100;
              } else {
                const targetPcts = steps.map((s) => extractTargetValue(s));
                const dataMinPct = Math.min(...targetPcts);
                const dataMaxPct = Math.max(...targetPcts);
                const yMinPct = Math.max(0, dataMinPct - SLOW_BUFFER_MINUTES * 10);
                const yMaxPct = dataMaxPct + FAST_BUFFER_MINUTES * 10;
                heightPct = ((targetPct - yMinPct) / (yMaxPct - yMinPct || 1)) * 100;
              }

              heightPct = Math.min(Math.max(heightPct, 4), 100);

              const tooltipText = `Step ${idx + 1}: ${intensityFormatted} | Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;

              return (
                <div
                  key={idx}
                  title={tooltipText}
                  style={{
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: barColor,
                    borderRadius: '3px 3px 0 0',
                    boxSizing: 'border-box',
                    transition: 'transform 0.15s ease, filter 0.15s ease',
                    cursor: 'pointer',
                    minWidth: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(0.85)';
                    e.currentTarget.style.transform = 'scaleY(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'none';
                    e.currentTarget.style.transform = 'scaleY(1)';
                  }}
                />
              );
            })}
          </div>

          {/* X-AXIS LABELS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', fontSize: '10px', color: '#6c757d' }}>
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