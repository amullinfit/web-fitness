import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';

const VAL_DAILY_URL = "https://amullinfit--50c3784ea4ce11f1bcc71607ee4eb77e.web.val.run";

const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
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
      
      let steps = null;
      if (workout.workout_doc) {
        try {
          const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
          steps = doc?.steps;
        } catch (e) {
          console.warn("Failed to parse workout_doc", e);
        }
      }

      let gearName = null;
      if (workout.gear) {
        gearName = typeof workout.gear === 'object' ? workout.gear.name : workout.gear;
      }

      const workoutId = workout.id || `workout-${isCompleted ? 'comp' : 'plan'}-${idx}`;

      return (
        <div key={workoutId} style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
            {workout.name || "Workout"} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({workout.type || 'Activity'})</span>
          </div>
          
          <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
            Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
          </div>

          {Array.isArray(steps) && steps.length > 0 && (
            <WorkoutChart 
              steps={steps} 
              containerId={`chart-${workoutId}`} 
            />
          )}

          {isCompleted && gearName && (
            <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic' }}>
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