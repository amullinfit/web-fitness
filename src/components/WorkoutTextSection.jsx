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

    return {
      id: idx,
      name: stepName,
      durationSec: s.duration || 0,
      intensity: s.intensity || (s.warmup ? "warmup" : s.cooldown ? "cooldown" : "active"),
      pacePctStr: paceRangeStr,
      calculatedPaceStr: calcPaceMps ? metersPerSecondToPaceStr(calcPaceMps) : "N/A",
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
  const parsedSteps = parseWorkoutSteps(rawSteps, thresholdPaceMps);

  return (
    <div style={{ marginTop: '12px', border: '1px solid #e9ecef', borderRadius: '6px', backgroundColor: '#f8f9fa', overflow: 'hidden' }}>
      {/* Clickable Header Bar (Single Line) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isOpen ? '#eef2f6' : '#f8f9fa'
        }}
      >
        <div style={{ fontSize: '13px', color: '#495057' }}>
          <span style={{ fontWeight: 'bold' }}>
            {isOpen ? '▼' : '►'} Steps ({parsedSteps.length})
          </span>
          <span style={{ marginLeft: '12px', color: '#0d6efd', fontWeight: '600' }}>
            Threshold Pace: {thresholdPaceStr}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#6c757d', fontStyle: 'italic' }}>
          {isOpen ? 'Click to collapse' : 'Click to expand'}
        </span>
      </div>

      {/* Expanded Content View */}
      {isOpen && (
        <div style={{ padding: '12px 14px 14px 14px', borderTop: '1px solid #e9ecef', backgroundColor: '#fff' }}>
          {parsedSteps.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#6c757d' }}>No parsed step text available.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#212529' }}>
              {parsedSteps.map((step) => (
                <li key={step.id} style={{ marginBottom: '8px' }}>
                  <strong>{step.name}</strong> — Intensity: <code>{step.intensity}</code> | Pace: <code>{step.pacePctStr}</code> ({step.calculatedPaceStr}) | Duration: <code>{formatDuration(step.durationSec)}</code>
                  <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                    Notes: "{step.text}"
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