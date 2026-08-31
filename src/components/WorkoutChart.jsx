import React from 'react';

// Converts meters per second to "mm:ss /mi"
const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
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

  // Extract values strictly from current step data
  const targetPcts = steps.map((s) => extractTargetValue(s));
  const dataMin = Math.min(...targetPcts);
  const dataMax = Math.max(...targetPcts);
  
  // Dynamic scale: span strictly between actual data bounds with 5% margin
  const range = (dataMax - dataMin) || 20;
  const yMax = dataMax + range * 0.05;
  const yMin = Math.max(0, dataMin - range * 0.05);
  const ySpan = yMax - yMin || 1;

  // Generate 4 perfectly spaced tick values (0%, 33%, 66%, 100% of range)
  const yTickPercentages = [1.0, 0.666, 0.333, 0];
  const yTicksPct = yTickPercentages.map((ratio) => yMin + ySpan * ratio);

  const yTickLabels = yTicksPct.map((pct) => {
    if (thresholdPace) {
      return metersPerSecondToPaceStr(thresholdPace * (pct / 100));
    }
    return `${Math.round(pct)}%`;
  });

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
            width: '60px',
            marginRight: '12px', 
            fontSize: '10px', 
            color: '#6c757d', 
            fontWeight: '600',
            lineHeight: '1'
          }}
        >
          {yTickLabels.map((label, idx) => {
            const topPct = (1 - yTickPercentages[idx]) * 100;
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
                {label}
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
              
              // Scale height across the full dynamic range (min 4% to remain visible)
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