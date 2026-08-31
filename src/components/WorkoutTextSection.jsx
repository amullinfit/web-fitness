import React, { useState } from 'react';

const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (num) => String(num).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

const safeStringLower = (val) => {
  if (!val) return "";
  if (typeof val === 'string') return val.toLowerCase();
  return String(val.id || val.type || val.name || val).toLowerCase();
};

const getThresholdPaceForSport = (sportType, sportSettings) => {
  if (!sportType || !Array.isArray(sportSettings)) return null;
  const normalizedSport = safeStringLower(sportType);
  const match = sportSettings.find((s) => {
    if (!s) return false;
    const settingType = safeStringLower(s.type || s.id || s.sport);
    let typesList = Array.isArray(s.types) ? s.types.map((t) => safeStringLower(t)) : [];
    return settingType === normalizedSport || typesList.includes(normalizedSport);
  });
  return match?.threshold_pace || match?.pace_threshold || null;
};

const parseWorkoutSteps = (stepList, thresholdPaceMps) => {
  if (!Array.isArray(stepList)) return [];

  return stepList.map((s, idx) => {
    let paceRangeStr = "N/A";
    let calcPaceMps = null;

    if (s.pace) {
      const startPct = s.pace.start || 0;
      const endPct = s.pace.end || 0;
      paceRangeStr = `${startPct}-${endPct}% pace`;

      if (thresholdPaceMps) {
        const avgPct = (startPct + endPct) / 2;
        calcPaceMps = thresholdPaceMps * (avgPct / 100);
      }
    }

    let stepName = s.text || s.name || (s.warmup ? "Warmup" : s.cooldown ? "Cooldown" : `Step ${idx + 1}`);
    const calculatedPaceStr = calcPaceMps ? metersPerSecondToPaceStr(calcPaceMps) : null;
    const finalPaceStr = calculatedPaceStr ? `${paceRangeStr} (${calculatedPaceStr})` : paceRangeStr;

    return {
      id: idx,
      name: stepName,
      durationSec: s.duration || 0,
      intensity: s.intensity || (s.warmup ? "warmup" : s.cooldown ? "cooldown" : "active"),
      paceStr: finalPaceStr,
      text: s.text || "No step text"
    };
  });
};

export default function WorkoutTextSection({ workout, sportSettings = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workout) return null;

  // Extract raw steps safely from workout_doc
  let rawSteps = [];
  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      rawSteps = doc?.steps || [];
    } catch (e) {
      console.error("Failed to parse workout_doc", e);
    }
  }

  const thresholdPaceMps = getThresholdPaceForSport(workout.type, sportSettings);
  const thresholdPaceStr = thresholdPaceMps ? metersPerSecondToPaceStr(thresholdPaceMps) : "Not Set";
  const debugSteps = parseWorkoutSteps(rawSteps, thresholdPaceMps);

  return (
    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
      {/* Clickable Header Bar matching requested layout */}
      <div 
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#495057', textTransform: 'uppercase' }}>
          {isOpen ? '▼' : '►'} Step Debug Write-up ({debugSteps.length} step{debugSteps.length === 1 ? '' : 's'})
        </span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#0d6efd', backgroundColor: '#e7f1ff', padding: '2px 8px', borderRadius: '4px' }}>
          Threshold Pace ({workout.type || 'Sport'}): {thresholdPaceStr}
        </span>
      </div>

      {/* Collapsible Content Area */}
      {isOpen && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e9ecef' }}>
          {debugSteps.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#6c757d' }}>No parsed step data available in workout_doc.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#212529' }}>
              {debugSteps.map((step, sIdx) => (
                <li key={sIdx} style={{ marginBottom: '4px' }}>
                  <strong>{step.name}</strong> — Intensity: <code>{step.intensity}</code> | Target Pace: <code>{step.paceStr}</code> | Duration: <code>{formatDuration(step.durationSec)}</code>
                  <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '1px' }}>
                    Text: "{step.text}"
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}