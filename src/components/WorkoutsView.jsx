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

export default function WorkoutsView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.workouts && Array.isArray(json.workouts)) {
          setWorkouts(json.workouts);
          setSportSettings(json.sportSettings || []);
        } else if (Array.isArray(json)) {
          setWorkouts(json);
        } else {
          setWorkouts([]);
          if (json.error) setError(json.error);
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
          const rawDate = w.start_date_local || w.icu_start_date || w.start_date;
          const workoutDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'TBD';
          
          const durationStr = formatDuration(w.moving_time || w.elapsed_time);
          const distanceMi = w.distance ? (w.distance * 0.000621371).toFixed(1) : null;
          
          // Parse steps from workout_doc
          let steps = null;
          if (w.workout_doc) {
            const doc = typeof w.workout_doc === 'string' ? JSON.parse(w.workout_doc) : w.workout_doc;
            steps = doc?.steps;
          }

          return (
            <div 
              key={w.id || index}
              style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px', backgroundColor: '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>{w.name || "Workout"} ({w.type || 'Run'})</span>
                <span>{workoutDate}</span>
              </div>
              <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
                Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
              </div>

              {/* Render chart for first 3 workouts using target conversions */}
              {index < 3 && Array.isArray(steps) && steps.length > 0 && (
                <WorkoutChart 
                  steps={steps} 
                  sportType={w.type}
                  sportSettings={sportSettings}
                  containerId={`upcoming-chart-${w.id || index}`} 
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}