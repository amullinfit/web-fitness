import React from 'react';

const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Color Palette Definition
const ZONE_COLORS = {
  warmup: '#ffe066',   // Yellow
  cooldown: '#8ce99a', // Light Green
  z1: '#74c0fc',       // Light Blue (< 65%)
  z2: '#4dabf7',       // Moderate Blue (65-75%)
  z3: '#b197fc',       // Purple (75-85%)
  z4: '#ff922b',       // Orange (85-95%)
  z5: '#ff6b6b'        // Red (95%+)
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

          let intensityPct = 60;
          if (step.pace) {
            const start = step.pace.start || 60;
            const end = step.pace.end || start;
            intensityPct = (start + end) / 2;
          }

          // Dynamic Zone Coloring
          let barColor = ZONE_COLORS.z1;
          if (step.warmup) barColor = ZONE_COLORS.warmup;
          else if (step.cooldown) barColor = ZONE_COLORS.cooldown;
          else if (intensityPct >= 95) barColor = ZONE_COLORS.z5;
          else if (intensityPct >= 85) barColor = ZONE_COLORS.z4;
          else if (intensityPct >= 75) barColor = ZONE_COLORS.z3;
          else if (intensityPct >= 65) barColor = ZONE_COLORS.z2;

          // Height Scaling (20% to 100%)
          const heightPct = Math.min(Math.max((intensityPct / 100) * 100, 20), 100);

          let paceDisplay = `${Math.round(intensityPct)}%`;
          if (thresholdPace) {
            const stepMps = thresholdPace * (intensityPct / 100);
            paceDisplay = metersPerSecondToPaceStr(stepMps);
          }

          return (
            <div
              key={idx}
              title={`${step.text || 'Step ' + (idx + 1)}: ${Math.round(duration / 60)}m @ ${paceDisplay}`}
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
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#212529', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {Math.round(duration / 60)}m
              </span>
              <span style={{ fontSize: '9px', color: '#495057', fontWeight: '500' }}>
                {paceDisplay}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}