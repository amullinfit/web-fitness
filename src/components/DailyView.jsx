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

// Safe extractor for workout steps from various event shapes
const extractSteps = (workout) => {
  if (!workout) return [];

  // 1. Direct steps array on workout root
  if (Array.isArray(workout.steps) && workout.steps.length > 0) {
    return workout.steps;
  }

  // 2. steps inside workout_doc (parsed or stringified)
  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' 
        ? JSON.parse(workout.workout_doc) 
        : workout.workout_doc;
      
      if (doc?.steps && Array.isArray(doc.steps)) {
        return doc.steps;
      }
    } catch (e) {
      console.warn("Failed to parse workout_doc JSON:", e);
    }
  }

  // 3. icu_intervals fallback (for completed activities)
  if (Array.isArray(workout.icu_intervals) && workout.icu_intervals.length > 0) {
    return workout.icu_intervals.map((interval, i) => ({
      name: interval.type || `Interval ${i + 1}`,
      power: interval.average_watts,
      hr: interval.average_heartrate,
      pace: interval.average_speed ? (interval.average_speed) : null,
      value: interval.average_watts || interval.average_heartrate || 0
    }));
  }

  return [];
};

export default function DailyView() {
  const [data, setData] = useState({ planned: [], completed: [], sportSettings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_DAILY_URL)
      .then((res) => res.json())
      .then((json) => {
        console.log("Daily API Response Payload:", json);
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching daily view data:", err);
        setLoading(false);
      });
  }, []);

  const renderWorkoutList = (workoutList, isCompleted = false) => {
    if (!workoutList || workoutList.length === 0) {
      return <p>No {isCompleted ? 'completed' : 'planned'} workouts for today.</p>;
    }

    return workoutList.map((workout, idx) => {
      const durationStr = formatDuration(workout.moving_time || workout.elapsed_time);
      const distanceMi = workout.distance ? (workout.distance * 0.000621371).toFixed(1) : null;
      
      const steps = extractSteps(workout);
      const workoutId = workout.id || `daily-${isCompleted ? 'comp' : 'plan'}-${idx}`;

      return (
        <div key={workoutId} style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
            {workout.name || "Workout"} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({workout.type || 'Run'})</span>
          </div>
          
          <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
            Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
          </div>

          {/* Render Workout Chart */}
          {steps.length > 0 ? (
            <WorkoutChart 
              steps={steps} 
              sportType={workout.type || 'Run'}
              sportSettings={data.sportSettings}
              containerId={`chart-${workoutId}`} 
            />
          ) : (
            <dimport React, { useState, useEffect } from 'react';
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
            
            export default function DailyView() {
              const [data, setData] = useState({ planned: [], completed: [], sportSettings: [] });
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
            
              const renderWorkoutList = (workoutList, isCompleted = false) => {
                if (!workoutList || workoutList.length === 0) {
                  return <p>No {isCompleted ? 'completed' : 'planned'} workouts for today.</p>;
                }
            
                return workoutList.map((workout, idx) => {
                  const durationStr = formatDuration(workout.moving_time || workout.elapsed_time);
                  const distanceMi = workout.distance ? (workout.distance * 0.000621371).toFixed(1) : null;
                  
                  // Parse steps from workout_doc
                  let steps = null;
                  if (workout.workout_doc) {
                    const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
                    steps = doc?.steps;
                  }
            
                  return (
                    <div key={workout.id || idx} style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        {workout.name} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({workout.type})</span>
                      </div>
                      
                      <div style={{ fontSize: '14px', color: '#555', margin: '6px 0' }}>
                        Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
                      </div>
            
                      {Array.isArray(steps) && steps.length > 0 && (
                        <WorkoutChart 
                          steps={steps} 
                          sportType={workout.type}
                          sportSettings={data.sportSettings}
                          containerId={`${isCompleted ? 'completed' : 'planned'}-chart-${workout.id || idx}`} 
                        />
                      )}
            
                      {isCompleted && workout.gear && (
                        <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic' }}>
                          Gear Used: {workout.gear.name || workout.gear}
                        </div>
                      )}
                    </div>
                  );
                });
              };
            
              if (loading) return <div style={{ padding: '20px' }}>Loading Daily View...</div>;
            
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Planned Workouts Section */}
                  <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
                    <h2 style={{ fontSize: '18px', marginTop: 0 }}>Today's Planned Workouts</h2>
                    {renderWorkoutList(data.planned, false)}
                  </section>
            
                  {/* Completed Workouts Section */}
                  <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
                    <h2 style={{ fontSize: '18px', marginTop: 0 }}>Today's Completed Workouts</h2>
                    {renderWorkoutList(data.completed, true)}
                  </section>
                </div>
              );
            }iv style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', marginTop: '6px' }}>
              No structured target steps available for chart rendering.
            </div>
          )}

          {isCompleted && workout.gear && (
            <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic' }}>
              Gear Used: {workout.gear.name || workout.gear}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Daily View...</div>;

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