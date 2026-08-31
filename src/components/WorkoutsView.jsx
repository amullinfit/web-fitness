import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';

// Replace with your actual Val Town HTTP URL for api_workouts
const VAL_WORKOUTS_URL = "https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run";

export default function WorkoutsView() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => res.json())
      .then((json) => {
        setWorkouts(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching upcoming workouts:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading Upcoming Workouts...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>Upcoming Workouts (Next 10)</h2>
      {workouts.length === 0 ? (
        <p>No upcoming workouts found.</p>
      ) : (
        workouts.map((w, index) => {
          const workoutDate = new Date(w.start_date_local || w.icu_start_date).toLocaleDateString();
          const durationMin = w.moving_time ? Math.round(w.moving_time / 60) : 0;
          const distanceMi = w.distance ? (w.distance * 0.000621371).toFixed(1) : null;

          return (
            <div 
              key={w.id || index}
              style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px', backgroundColor: '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>{w.name}</span>
                <span>{workoutDate}</span>
              </div>
              <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
                Duration: {durationMin} mins {distanceMi && `| Distance: ${distanceMi} mi`}
              </div>

              {/* Display graphs for the first 3 workouts if defined steps exist */}
              {index < 3 && w.workout_doc?.steps && (
                <div style={{ marginTop: '12px' }}>
                  <WorkoutChart steps={w.workout_doc.steps} containerId={`upcoming-chart-${index}`} />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}