import React, { useState } from 'react';

const formatDurationMinutes = (seconds) => {
  if (!seconds) return '0m';
  const mins = Math.round(seconds / 60);
  return `${mins}m`;
};

const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return null;
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

export default function WorkoutTextSection({ workout, sportSettings = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workout) return null;

  // Extract steps safely
  let steps = [];
  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      steps = doc?.steps || [];
    } catch (e) {
      console.error("Error parsing workout_doc", e);
    }
  }

  const thresholdPaceMps = getThresholdPaceForSport(workout.type, sportSettings);

  return (
    <div style={{ marginTop: '14px', border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff' }}>
      {/* Clickable Header Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px 14px',
          backgroundColor: '#f8f9fa',
          border: 'none',
          borderBottom: isOpen ? '1px solid #dee2e6' : 'none',
          textAlign: 'left',
          fontWeight: '600',
          fontSize: '13px',
          color: '#343a40',
          cursor: 'pointer',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>
          {isOpen ? '▼' : '►'} Workout Details & Steps ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
        </span>
        <span style={{ fontSize: '11px', color: '#6c757d' }}>
          {isOpen ? 'Hide Details' : 'Show Details'}
        </span>
      </button>

      {/* Expanded Details matching DailyView original format */}
      {isOpen && (
        <div style={{ padding: '14px', backgroundColor: '#ffffff', fontSize: '14px', lineHeight: '1.6' }}>
          {/* Raw Description if present */}
          {workout.description && (
            <div style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #eee', whiteSpace: 'pre-line', color: '#495057' }}>
              {workout.description}
            </div>
          )}

          {/* Formatted Steps List */}
          {steps.length > 0 && (
            <div>
              <strong style={{ display: 'block', marginBottom: '8px', color: '#212529' }}>Step Breakdown:</strong>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                {steps.map((step, idx) => {
                  const durationStr = formatDurationMinutes(step.duration);
                  let paceStr = '';

                  if (step.pace) {
                    const startPct = step.pace.start || 0;
                    const endPct = step.pace.end || startPct;
                    paceStr = `${startPct}-${endPct}% pace`;

                    if (thresholdPaceMps) {
                      const avgPct = (startPct + endPct) / 2;
                      const calculatedMps = thresholdPaceMps * (avgPct / 100);
                      const targetPaceStr = metersPerSecondToPaceStr(calculatedMps);
                      if (targetPaceStr) {
                        paceStr += ` (${targetPaceStr})`;
                      }
                    }
                  }

                  const stepText = step.text ? ` - ${step.text}` : '';
                  const prefix = step.warmup ? '[Warmup] ' : step.cooldown ? '[Cooldown] ' : '';

                  return (
                    <li key={idx} style={{ marginBottom: '4px' }}>
                      <strong>{prefix}{durationStr}</strong> {paceStr && `@ ${paceStr}`}{stepText}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}