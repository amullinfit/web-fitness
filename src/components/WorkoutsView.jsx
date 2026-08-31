import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';

const VAL_WORKOUTS_URL = "https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run";

// Helper function to format seconds into H:MM:SS
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
};

// Convert speed in m/s to pace in mm:ss per mile, rounded to nearest 5 seconds
const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  
  // Total seconds per mile
  const secPerMile = 1609.34 / mps;
  
  // Round to nearest 5 seconds
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  const padSecs = String(secs).padStart(2, '0');
  
  return `${mins}:${padSecs} /mi`;
};

// Safely convert any value to lower-case string
const safeStringLower = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val.toLowerCase();
  if (typeof val === 'object') {
    return (val.id || val.type || val.name || JSON.stringify(val)).toLowerCase();
  }
  return String(val).toLowerCase();
};

// Find matching threshold_pace from sportSettings safely
const getThresholdPaceForSport = (sportType, sportSettings) => {
  if (!sportType || !Array.isArray(sportSettings)) return null;

  const normalizedSport = safeStringLower(sportType);
  
  const match = sportSettings.find((s) => {
    if (!s) return false;

    const settingType = safeStringLower(s.type || s.id || s.sport);
    
    let typesList = [];
    if (Array.isArray(s.types)) {
      typesList = s.types.map((t) => safeStringLower(t));
    }

    return settingType === normalizedSport || typesList.includes(normalizedSport);
  });

  return match?.threshold_pace || match?.pace_threshold || null;
};

// Helper to extract an averaged numeric value if target is an object with ranges (start/end or min/max)
const extractTargetValue = (targetObj) => {
  if (typeof targetObj === 'number') return targetObj;
  if (!targetObj || typeof targetObj !== 'object') return null;

  const start = targetObj.start ?? targetObj.min ?? targetObj.value;
  const end = targetObj.end ?? targetObj.max;

  if (start !== undefined && end !== undefined && start !== end) {
    return (Number(start) + Number(end)) / 2;
  }
  
  return start !== undefined ? Number(start) : null;
};

// Recursively parse steps and evaluate target pace using threshold_pace
const parseStepsForDebug = (stepList, thresholdPaceMps) => {
  let result = [];
  if (!Array.isArray(stepList)) return result;

  stepList.forEach((s, idx) => {
    if (!s) return;

    if (Array.isArray(s.steps)) {
      const repeats = s.repetition || 1;
      for (let r = 0; r < repeats; r++) {
        result = result.concat(parseStepsForDebug(s.steps, thresholdPaceMps));
      }
    } else {
      let intensityPctVal = null;
      let intensityPctStr = "N/A";
      let calculatedPaceMps = null;

      // Extract raw target/intensity (handles single value or ranges)
      if (s.pace) {
        intensityPctVal = extractTargetValue(s.pace);
        intensityPctStr = `${Math.round(intensityPctVal)}% Pace`;
      } else if (s.power) {
        intensityPctVal = extractTargetValue(s.power);
        intensityPctStr = `${Math.round(intensityPctVal)}% Power`;
      } else if (s.hr) {
        intensityPctVal = extractTargetValue(s.hr);
        intensityPctStr = `${Math.round(intensityPctVal)}% HR`;
      } else if (s.target) {
        intensityPctVal = extractTargetValue(s.target);
        intensityPctStr = `${Math.round(intensityPctVal)}% Target`;
      }

      // Check for direct step speed/pace
      if (s.speed) {
        calculatedPaceMps = extractTargetValue(s.speed);
      } else if (typeof s.pace === 'object' && s.pace.value && s.pace.value > 15) {
        calculatedPaceMps = extractTargetValue(s.pace);
      } else if (thresholdPaceMps && intensityPctVal) {
        calculatedPaceMps = thresholdPaceMps * (intensityPctVal / 100);
      }

      result.push({
        id: idx,
        name: s.name || s.type || `Step ${idx + 1}`,
        durationSec: s.duration || s.moving_time || 0,
        intensity: intensityPctStr,
        paceStr: calculatedPaceMps ? metersPerSecondToPaceStr(calculatedPaceMps) : "N/A",
        text: s.description || s.text || s.notes || "No description text"
      });
    }
  });

  return result;
};

export default function WorkoutsView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json && typeof json === 'object') {
          if (Array.isArray(json.workouts)) {
            setWorkouts(json.workouts);
          } else if (Array.isArray(json)) {
            setWorkouts(json);
          } else {
            setWorkouts([]);
          }

          if (Array.isArray(json.sportSettings)) {
            setSportSettings(json.sportSettings);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching upcoming workouts:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading Upcoming Workouts...</div>;

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '6px' }}>
        <h3>Error Loading Workouts</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>Upcoming Workouts (Next 10)</h2>
      {workouts.length === 0 ? (
        <p>No upcoming workouts found.</p>
      ) : (
        workouts.map((w, index) => {
          if (!w) return null;

          const rawDate = w.start_date_local || w.icu_start_date || w.start_date;
          const workoutDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'TBD';
          
          const durationStr = formatDuration(w.moving_time || w.elapsed_time);
          const distanceMi = w.distance ? (w.distance * 0.000621371).toFixed(1) : null;
          
          let rawSteps = null;
          if (w.workout_doc) {
            try {
              const doc = typeof w.workout_doc === 'string' ? JSON.parse(w.workout_doc) : w.workout_doc;
              rawSteps = doc?.steps;
            } catch (e) {
              console.warn("Failed to parse workout_doc", e);
            }
          }

          const thresholdPaceMps = getThresholdPaceForSport(w.type, sportSettings);
          const thresholdPaceStr = thresholdPaceMps ? metersPerSecondToPaceStr(thresholdPaceMps) : "Not Set";
          const debugSteps = parseStepsForDebug(rawSteps, thresholdPaceMps);

          const workoutId = w.id || `upcoming-${index}`;

          return (
            <div 
              key={workoutId}
              style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>{w.name || "Workout"} ({w.type || 'Run'})</span>
                <span>{workoutDate}</span>
              </div>
              <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
                Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
              </div>

              {/* Render chart for first 3 workouts */}
              {index < 3 && Array.isArray(rawSteps) && rawSteps.length > 0 && (
                <WorkoutChart 
                  steps={rawSteps} 
                  containerId={`upcoming-chart-${workoutId}`} 
                  thresholdPace={thresholdPaceMps}
                />
              )}

              {/* Step Debug & Threshold Breakdown */}
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#495057', textTransform: 'uppercase' }}>
                    Step Write-up ({debugSteps.length} step{debugSteps.length === 1 ? '' : 's'})
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#0d6efd', backgroundColor: '#e7f1ff', padding: '2px 8px', borderRadius: '4px' }}>
                    Threshold Pace ({w.type || 'Sport'}): {thresholdPaceStr}
                  </span>
                </div>
                
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
            </div>
          );
        })
      )}
    </div>
  );
}