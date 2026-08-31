import React from 'react';

const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatIntensityTitleCase = (val) => {
  if (!val) return "Active";
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Helper to extract numeric value from intensity object/range
const extractTargetValue = (targetObj) => {
  if (typeof targetObj === 'number') return targetObj;
  if (typeof targetObj === 'object' && targetObj !== null) {
    const start = targetObj.start || 0;
    const end = targetObj.end || start;
    return (start + end) / 2;
  }
  return 60; // default fallback percentage
};

// Helper to determine zone name and color based on target percentage and step type
const getZoneDetails = (targetPct, stepType = '') => {
  const typeLower = String(stepType).toLowerCase();

  // Handle explicit warmups, cooldowns, or recoveries
  if (typeLower.includes('warm') || typeLower.includes('cool') || typeLower.includes('rest') || targetPct < 75) {
    return { name: 'Warmup / Recovery (Z1)', color: '#6c757d' }; // Gray
  }
  if (targetPct < 88) {
    return { name: 'Endurance (Z2)', color: '#28a745' }; // Green
  }
  if (targetPct < 96) {
    return { name: 'Tempo (Z3)', color: '#ffc107' }; // Yellow/Amber
  }
  if (targetPct <= 105) {
    return { name: 'Threshold (Z4)', color: '#fd7e14' }; // Orange
  }
  return { name: 'Anaerobic / VO2 Max (Z5+)', color: '#dc3545' }; // Red
};

export default function WorkoutChart({ steps = [], thresholdPace, chartHeight = '140px' }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0) || 1;

  return (
    <div style={{ margin: '16px 0', border: '1px solid #e9ecef', borderRadius: '8px', padding: '16px', backgroundColor: '#fcfcfc' }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'flex-end', 
          height: chartHeight, 
          gap: '3px', 
          paddingBottom: '4px', 
          borderBottom: '2px solid #dee2e6' 
        }}
      >
        {steps.map((step, idx) => {
          const duration = step.duration || 60;
          const durationMins = Math.round(duration / 60);
          const widthPct = (duration / totalDuration) * 100;

          // Determine step type & intensity
          const rawIntensity = step.intensity || (step.warmup ? 'warmup' : step.cooldown ? 'cooldown' : step.type || 'active');
          const intensityFormatted = formatIntensityTitleCase(rawIntensity);
          
          // Extract target value and zone color details
          const targetPct = extractTargetValue(step.pace || step.target || step.intensityPct);
          const zoneDetails = getZoneDetails(targetPct, rawIntensity);
          const barColor = zoneDetails.color;

          // Compute pace string for bar label and tooltip
          let paceDisplay = `${Math.round(targetPct)}%`;
          let paceRangeDisplay = paceDisplay;

          if (step.pace && (step.pace.start !== undefined || step.pace.end !== undefined)) {
            const start = step.pace.start || 0;
            const end = step.pace.end || start;
            paceRangeDisplay = `${start}-${end}% pace`;
          }

          if (thresholdPace) {
            const stepMps = thresholdPace * (targetPct / 100);
            paceDisplay = metersPerSecondToPaceStr(stepMps);
          }

          // Height Scaling (20% to 100%)
          const heightPct = Math.min(Math.max((targetPct / 100) * 100, 20), 100);

          // Construct tooltip showing Intensity, Target Pace Range, and Duration
          const tooltipText = `Intensity: ${intensityFormatted} | Target Pace: ${paceRangeDisplay} | Duration: ${durationMins}m`;

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
                {paceDisplay}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}