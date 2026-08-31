import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';

// Replace with your actual Val Town HTTP URL for api_daily
const VAL_DAILY_URL = "https://andrewmullin-api_daily.web.val.run";

export default function DailyView() {
  const [data, setData] = useState({ planned: [], completed: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_DAILY_URL)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching daily view data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading Daily View...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Planned Workouts Section */}
      <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>Today's Planned Workouts</h2>
        {data.planned && data.planned.length > 0 ? (
          data.planned.map((workout, idx) => (
            <div key={workout.id || idx} style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                {workout.name} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({workout.type})</span>
              </div>
              {workout.workout_doc?.steps && (
                <WorkoutChart steps={workout.workout_doc.steps} containerId={`planned-chart-${idx}`} />
              )}
            </div>
          ))
        ) : (
          <p>No planned workouts for today.</p>
        )}
      </section>

      {/* Completed Workouts Section */}
      <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>Today's Completed Workouts</h2>
        {data.completed && data.completed.length > 0 ? (
          data.completed.map((workout, idx) => (
            <div key={workout.id || idx} style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                {workout.name} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({workout.type})</span>
              </div>
              {workout.workout_doc?.steps && (
                <WorkoutChart steps={workout.workout_doc.steps} containerId={`completed-chart-${idx}`} />
              )}
              {/* Gear used indication */}
              {workout.gear && (
                <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic' }}>
                  Gear Used: {workout.gear.name || workout.gear}
                </div>
              )}
            </div>
          ))
        ) : (
          <p>No completed workouts logged today.</p>
        )}
      </section>
    </div>
  );
}