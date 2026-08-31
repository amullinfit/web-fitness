import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';

// Update with your actual Val Town endpoint URL
const VAL_WORKOUTS_URL = "https://andrewmullin-api_workouts.web.val.run";

export default function WorkoutsView() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        // Ensure data is an array before setting state
        if (Array.isArray(json)) {
          setWorkouts(json);
        } else {
          console.error("Expected array from API but got:", json);
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
          // Fallback date handling
          const rawDate = w.start_date_local || w.icu_start_date || w.start_date;
          const workoutDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'TBD';
          
          const durationMin = w.moving_time ? Math.round(w.moving_time / 60) : 0;
          const distanceMi = w.distance ? (w.distance * 0.000621371).toFixed(1) : null;
          
          // Safe access to nested workout doc steps
          const steps = w.workout_doc?.steps;

          return (
            <div 
              key={w.id || index}
              style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px', backgroundColor: '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>{w.name || "Workout"}</span>
                <span>{workoutDate}</span>
              </div>
              <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
                Duration: {durationMin} mins {distanceMi && `| Distance: ${distanceMi} mi`}
              </div>

              {/* Only render chart if steps exist and index < 3 */}
              {index < 3 && Array.isArray(steps) && steps.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <WorkoutChart steps={steps} containerId={`upcoming-chart-${w.id || index}`} />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}