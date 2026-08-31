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

// Extracts numerical target percentage from step objects safely
const extractTargetValue = (step) => {
  if (!step) return 60;

  // Handle step.pace = { start: X, end: Y }
  if (step.pace && typeof step.pace === 'object') {
    const start = step.pace.start || 0;
    const end = step.pace.end || start;
    return (start + end) / 2;
  }

  // Handle step.target or step.intensityPct
  const val = step.target || step.intensityPct || step.pace;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    const start = val.start || 0;
    const end = val.end || start;
    return (start + end) / 2;
  }

  return 60;
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

  // Compute pace bounds
  const targetPcts = steps.map((s) => extractTargetValue(s));
  const maxPct = Math.max(...targetPcts, 100);
  const minPct = Math.min(...targetPcts, 50);

  // Evenly distribute 4 Y-Axis ticks (Top, Upper-Mid, Lower-Mid, Bottom)
  const yTicksPct = [
    maxPct,
    maxPct - (maxPct - minPct) * (1 / 3),
    maxPct - (maxPct - minPct) * (2 / 3),
    minPct
  ];

  const yTickLabels = yTicksPct.map((pct) => {
    if (thresholdPace) {
      // Calculate speed in m/s based on percentage of threshold pace
      return metersPerSecondToPaceStr(thresholdPace * (pct / 100));
    }
    return `${Math.round(pct)}%`;
  });

  // Calculate accumulated minute ticks for X-Axis
  let accumulatedSec = 0;
  const timeTicks = steps.map((step) => {
    accumulatedSec += step.duration || 0;
    return Math.round(accumulatedSec / 60);
  });

  return (
    <div style={{ margin: '16px 0', border: '1px solid #e9ecef', borderRadius: '8px', padding: '16px', backgroundColor: '#fcfcfc' }}>
      <div style={{ display: 'flex' }}>
        {/* EVENLY DISTRIBUTED Y-AXIS LABELS */}
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justify: 'space-between', 
            height: chartHeight, 
            paddingRight: '12px', 
            fontSize: '10px', 
            color: '#6c757d', 
            textAlign: 'right',
            fontWeight: '600',
            lineHeight: '1'
          }}
        >
          {yTickLabels.map((label, idx) => (
            <span key={idx}>{label}</span>
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

              // Compute Pace for Tooltip and Bar Label in mm:ss /mi
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
              
              // Scale bar height dynamically between minPct and maxPct
              const heightPct = Math.min(Math.max(((targetPct - minPct) / (maxPct - minPct || 1)) * 85 + 15, 15), 100);

              const tooltipText = `Intensity: ${intensityFormatted} | Pace: ${paceRangeFormatted} | Duration: ${durationMins}m`;

              return (
                <div
                  key={idx}
                  title={tooltipText}
                  style={{
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: barColor,
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '4px 1px',
                    boxSizing: 'border-box',
                    transition: 'transform 0.15s ease, filter 0.15s ease',
                    cursor: 'pointer',
                    minWidth: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(0.9)';
                    e.currentTarget.style.transform = 'scaleY(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'none';
                    e.currentTarget.style.transform = 'scaleY(1)';
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: '600', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {durationMins}m
                  </span>
                  <span style={{ fontSize: '9px', color: '#ffffff', fontWeight: '500' }}>
                    {avgPaceStr}
                  </span>
                </div>
              );
            })}
          </div>

          {/* X-AXIS LABELS (Minutes) */}
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