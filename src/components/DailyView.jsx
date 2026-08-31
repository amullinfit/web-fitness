import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';

const VAL_DAILY_URL = "https://amullinfit--50c3784ea4ce11f1bcc71607ee4eb77e.web.val.run";

// Helper function to format seconds into H:MM:SS
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
};

// Convert speed in m/s to pace in mm:ss per mile or km
const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  // Seconds per mile
  const secPerMile = 1609.34 / mps;
  const mins = Math.floor(secPerMile / 60);
  const secs = Math.round(secPerMile % 60);
  const padSecs = String(secs).padStart(2, '0');
  return `${mins}:${padSecs} /mi`;
};

// Recursively parse steps and build a linear diagnostic list
const parseStepsForDebug = (stepList) => {
  let result = [];
  if (!Array.isArray(stepList)) return result;

  stepList.forEach((s, idx) => {
    if (!s) return;

    if (Array.isArray(s.steps)) {
      const repeats = s.repetition || 1;
      for (let r = 0; r < repeats; r++) {
        result = result.concat(parseStepsForDebug(s.steps));
      }
    } else {
      // Extract intensity % (Power/HR/Target)
      let intensityPct = "N/A";
      let paceMps = null;

      if (s.power) {
        intensityPct = typeof s.power === 'object' ? `${s.power.value || s.power.start || 0}% Power` : `${s.power}% Power`;
      } else if (s.hr) {
        intensityPct = typeof s.hr === 'object' ? `${s.hr.value || s.hr.start || 0}% HR` : `${s.hr}% HR`;
      } else if (s.pace) {
        intensityPct = typeof s.pace === 'object' ? `${s.pace.value || s.pace.start || 0}% Pace` : `${s.pace}% Pace`;
        if (typeof s.pace === 'object' && s.pace.value) paceMps = s.pace.value;
      } else if (s.target) {
        intensityPct = typeof s.target === 'object' ? `${s.target.value || 0}% Target` : `${s.target}% Target`;
      }

      // Fallback pace check if direct speed is provided on step
      if (!paceMps && s.speed) paceMps = s.speed;

      result.push({
        id: idx,
        name: s.name || s.type || `Step ${idx + 1}`,
        durationSec: s.duration || s.moving_time || 0,
        intensity: intensityPct,
        paceStr: paceMps ? metersPerSecondToPaceStr(paceMps) : "N/A",
        text: s.description || s.text || s.notes || "No description text"
      });
    }
  });

  return result;
};

export default function DailyView() {
  const [data, setData] = useState({ planned: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(VAL_DAILY_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json && typeof json === 'object') {
          setData({
            planned: Array.isArray(json.planned) ? json.planned : [],
            completed: Array.isArray(json.completed) ? json.completed : []
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching daily view data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const renderWorkoutList = (workoutList, isCompleted = false) => {
    if (!Array.isArray(workoutList) || workoutList.length === 0) {
      return <p>No {isCompleted ? 'completed' : 'planned'} workouts for today.</p>;
    }

    return workoutList.map((workout, idx) => {
      if (!workout) return null;

      const durationStr = formatDuration(workout.moving_time || workout.elapsed_time);
      const distanceMi = workout.distance ? (workout.distance * 0.000621371).toFixed(1) : null;
      
      let rawSteps = null;
      if (workout.workout_doc) {
        try {
          const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
          rawSteps = doc?.steps;
        } catch (e) {
          console.warn("Failed to parse workout_doc", e);
        }
      }

      const debugSteps = parseStepsForDebug(rawSteps);
      let gearName = null;
      if (workout.gear) {
        gearName = typeof workout.gear === 'object' ? workout.gear.name : workout.gear;
      }

      const workoutId = workout.id || `workout-${isCompleted ? 'comp' : 'plan'}-${idx}`;

      return (
        <div key={workoutId} style={{ marginBottom: '24px', borderBottom: '2px solid #e0e0e0', paddingBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
            {workout.name || "Workout"} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({workout.type || 'Activity'})</span>
          </div>
          
          <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
            Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
          </div>

          {/* Highcharts Chart */}
          {Array.isArray(rawSteps) && rawSteps.length > 0 ? (
            <WorkoutChart 
              steps={rawSteps} 
              containerId={`chart-${workoutId}`} 
            />
          ) : (
            <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', margin: '8px 0' }}>
              (No target steps found for chart rendering)
            </div>
          )}

          {/* Debug / Diagnostic Breakdown List */}
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '6px', color: '#495057', textTransform: 'uppercase' }}>
              Step Debug Write-up ({debugSteps.length} step{debugSteps.length === 1 ? '' : 's'})
            </div>
            
            {debugSteps.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#6c757d' }}>No parsed step data available in workout_doc.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#212529' }}>
                {debugSteps.map((step, sIdx) => (
                  <li key={sIdx} style={{ marginBottom: '4px' }}>
                    <strong>{step.name}</strong> — Intensity: <code>{step.intensity}</code> | Pace: <code>{step.paceStr}</code> | Duration: <code>{formatDuration(step.durationSec)}</code>
                    <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '1px' }}>
                      Text: "{step.text}"
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isCompleted && gearName && (
            <div style={{ marginTop: '8px', fontSize: '13px', fontStyle: 'italic', color: '#555' }}>
              Gear Used: {gearName}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Daily View...</div>;

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '6px' }}>
        <h3>Failed to load Daily View</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>Today's Planned Workouts</h2>
        {renderWorkoutList(data.planned, false)}
      </section>

      <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>Today's Completed Workouts</h2>
        {renderWorkoutList(data.completed, true)}
      </section>
    </div>
  );
}