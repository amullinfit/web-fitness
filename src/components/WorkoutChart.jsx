import React from 'react';

const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
          const widthPct = (duration / totalDuration) * 100;

          // Determine step type for zone identification
          const stepType = step.intensity || (step.warmup ? 'warmup' : step.cooldown ? 'cooldown' : step.type || '');
          
          // Extract intensity target value using the helper
          const targetPct = extractTargetValue(step.pace || step.target || step.intensityPct);

          // Retrieve color and zone metadata using getZoneDetails
          const zoneDetails = getZoneDetails(targetPct, stepType);
          const barColor = zoneDetails.color;

          // Height Scaling (20% to 100%)
          const heightPct = Math.min(Math.max((targetPct / 100) * 100, 20), 100);

          let paceDisplay = `${Math.round(targetPct)}%`;
          if (thresholdPace) {
            const stepMps = thresholdPace * (targetPct / 100);
            paceDisplay = metersPerSecondToPaceStr(stepMps);
          }

          return (
            <div
              key={idx}
              title={`${step.text || 'Step ' + (idx + 1)}: ${Math.round(duration / 60)}m @ ${paceDisplay} (${zoneDetails.name})`}
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
                {Math.round(duration / 60)}m
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