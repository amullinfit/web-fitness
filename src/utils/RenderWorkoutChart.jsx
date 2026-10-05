import React from 'react';
import { formatDistance, formatTime, formatMMSS, PRESET_COLORS } from './WorkoutBuilderHelpers.js';

export default function RenderWorkoutChart({ steps, height, workoutMode, presets }) {
  const flattenSteps = (list) => {
    let result = [];
    if (!Array.isArray(list)) return result;

    list.forEach((s) => {
      if (s.type === 'repeat') {
        const reps = s.iterations || 1;
        for (let i = 0; i < reps; i++) {
          result = result.concat(flattenSteps(s.steps || []));
        }
      } else {
        result.push(s);
      }
    });
    return result;
  };

  const flatSteps = flattenSteps(steps);
  const totalWeight = flatSteps.reduce((acc, curr) => {
    const val = workoutMode === 'distance' 
      ? (curr.distanceMiles || 0) 
      : (curr.durationSec || 0);
    return acc + val;
  }, 0) || 1;

  const velocities = flatSteps.map((s) => (s.targetPaceSec > 0 ? 1 / s.targetPaceSec : 0));
  const maxVel = Math.max(...velocities, 0.0001);
  const minVel = Math.min(...velocities, maxVel);

  const getBarColor = (paceSec) => {
    if (!paceSec || paceSec <= 0) return PRESET_COLORS[0];
    if (!presets || presets.length === 0) return PRESET_COLORS[0];

    let closestColor = PRESET_COLORS[0];
    let smallestDiff = Infinity;

    presets.forEach((p) => {
      const diff = Math.abs(p.targetPaceSec - paceSec);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestColor = p.color;
      }
    });

    return closestColor;
  };

  return (
    <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'flex-end', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
      {flatSteps.map((step, idx) => {
        const stepWeight = workoutMode === 'distance' 
          ? (step.distanceMiles || 0) 
          : (step.durationSec || 0);
        const widthPct = (stepWeight / totalWeight) * 100;
        const currentVel = step.targetPaceSec > 0 ? 1 / step.targetPaceSec : 0;
        const barHeightPct = maxVel === minVel ? 60 : 25 + ((currentVel - minVel) / (maxVel - minVel)) * 70;
        const barColor = getBarColor(step.targetPaceSec);

        const durLabel = workoutMode === 'distance' 
          ? formatDistance(step.distanceMiles) 
          : formatTime(step.durationSec);

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              height: `${barHeightPct}%`,
              backgroundColor: barColor,
              borderRight: '1px solid rgba(255,255,255,0.4)',
            }}
            title={`${(step.type || 'run').toUpperCase()}: ${durLabel} @ ${formatMMSS(step.targetPaceSec)}/mi`}
          />
        );
      })}
    </div>
  );
}