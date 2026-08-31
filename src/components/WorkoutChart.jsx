import React from 'react';

// Adjustable buffer parameters (in minutes) for easy debugging
const SLOW_BUFFER_MINUTES = 4; // Buffer added below the slowest interval (slower pace)
const FAST_BUFFER_MINUTES = 2; // Buffer subtracted above the fastest interval (faster pace)

// Converts meters per second to "mm:ss /mi"
const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

// Formats raw seconds per mile to "mm:ss /mi"
const formatSecPerMileToStr = (secPerMile) => {
  if (!secPerMile || secPerMile <= 0) return "N/A";
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

const formatIntensityTitleCase = (val) => {
  if (!val) return "Active";
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const extractTargetValue = (step) => {
  if (!step) return 80;

  if (step.pace && typeof step.pace === 'object') {
    const start = step.pace.start || 0;
    const end = step.pace.end || start;
    return (start + end) / 2;
  }

  const val = step.target || step.intensityPct || step.pace;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    const start = val.start || 0;
    const end = val.end || start;
    return (start + end) / 2;
  }

  return 80;
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

  // Extract step target percentages
  const targetPcts = steps.map((s) => extractTargetValue(s));
  const dataMinPct = Math.min(...targetPcts); // Slowest step
  const dataMaxPct = Math.max(...targetPcts); // Fastest step

  let yMin, yMax;
  let yTicks = [];

  if (thresholdPace && thresholdPace > 0) {
    const thresholdSecPerMile = 1609.34 / thresholdPace;

    // Convert step bounds to sec/mi
    const fastestStepSec = thresholdSecPerMile / (dataMaxPct / 100);
    const slowestStepSec = thresholdSecPerMile / (dataMinPct / 100);

    // Apply minute buffers in sec/mi space
    const rawFastSec = Math.max(30, fastestStepSec - (FAST_BUFFER_MINUTES * 60));
    const rawSlowSec = slowestStepSec + (SLOW_BUFFER_MINUTES * 60);

    // Allowed tick intervals (in seconds): 60s (1:00), 90s (1:30), 120s (2:00)
    const allowedStepSecs = [60, 90, 120];

    let chosenStepSec = 60;
    let bestTickCount = -1;
    let chosenStartSec = rawFastSec;
    let chosenEndSec = rawSlowSec;

    // Evaluate allowed step intervals to pick 4-6 ticks (preferring higher tick count)
    for (const stepSec of allowedStepSecs) {
      // Round fast end (top of chart/lower sec) down to nearest step interval
      const roundedFast = Math.floor(rawFastSec / stepSec) * stepSec;
      // Round slow end (bottom of chart/higher sec) up to nearest step interval
      const roundedSlow = Math.ceil(rawSlowSec / stepSec) * stepSec;

      const count = Math.round((roundedSlow - roundedFast) / stepSec) + 1;

      if (count >= 4 && count <= 6) {
        if (count >= bestTickCount) { // Pick highest tick count among valid choices
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

    // Build pace ticks from fastest (top) to slowest (bottom)
    const paceTicksSec = [];
    for (let sec = chosenStartSec; sec <= chosenEndSec; sec += chosenStepSec) {
      paceTicksSec.push(sec);
    }

    // Convert rounded boundaries back to percentage space for rendering
    yMax = (thresholdSecPerMile / chosenStartSec) * 100;
    yMin = Math.max(1, (thresholdSecPerMile / chosenEndSec) * 100);

    yTicks = paceTicksSec.map((sec) => {
      const pct = (thresholdSecPerMile / sec) * 100;
      return {
        label: formatSecPerMileToStr(sec),
        pct: pct
      };
    });

  } else {
    // Percentage fallback mode
    const slowBufferPct = SLOW_BUFFER_MINUTES * 10;
    const fastBufferPct = FAST_BUFFER_MINUTES * 10;
    yMin = Math.max(0, dataMinPct - slowBufferPct);
    yMax = dataMaxPct + fastBufferPct;

    const tickRatios = [1.0, 0.75, 0.5, 0.25, 0];
    yTicks = tickRatios.map((r) => {
      const pct = yMin + (yMax - yMin) * r;
      return { label: `${Math.round(pct)}%`, pct };
    });
  }

  const ySpan = yMax - yMin || 1;

  let accumulatedSec = 0;
  const timeTicks = steps.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  return (
    <div style={{ margin: '16px 0', border: '1px solid #e9ecef', borderRadius: '8px', padding: '16px', backgroundColor: '#fcfcfc' }}>
      <div style={{ display: 'flex' }}>
        {/* DYNAMIC Y-AXIS LABELS */}
        <div 
          style={{ 
            position: 'relative',
            height: chartHeight, 
            width: '65px',
            marginRight: '12px', 
            fontSize: '10px', 
            color: '#6c757d', 
            fontWeight: '600',
            lineHeight: '1'
          }}
        >
          {yTicks.map((tick, idx) => {
            // Compute visual position (0% = top, 100% = bottom)
            const topPct = Math.min(Math.max((1 - (tick.pct - yMin) / ySpan) * 100, 0), 100);
            return (
              <span 
                key={idx}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: `${topPct}%`,
                  transform: 'translateY(-50%)',
                  whiteSpace: 'nowrap'
                }}
              >
                {tick.label}
              </span>
            );
          })}
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

              let startPaceStr = "N/A";
              let endPaceStr = "N/A";
              let avgPaceStr = "N/A";

              const startPct = step.pace?.start || targetPct;
              const endPct = step.pace?.end || startPct;

              if (thresholdPace) {
                startPaceStr = metersPerSecondToPaceStr(thresholdPace * (startPct / 100));
                endPaceStr = metersPerSecondToPaceStr(thresholdPace * (endPct / 100));
                avgPaceStr = metersPerSecondToPaceStr(thresholdPace * (targetPct / 100));
              } else {
                startPaceStr = `${startPct}%`;
                endPaceStr = `${endPct}%`;
                avgPaceStr = `${Math.round(targetPct)}%`;
              }

              const paceRangeFormatted = startPaceStr === endPaceStr ? avgPaceStr : `${startPaceStr} - ${endPaceStr}`;
              
              // Dynamic height positioning bounded to calculated scale
              const heightPct = Math.min(Math.max(((targetPct - yMin) / ySpan) * 100, 4), 100);

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