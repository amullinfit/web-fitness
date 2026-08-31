import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from './WorkoutTextSection';

const VAL_WORKOUTS_URL = "https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run";

const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (num) => String(num).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

export default function DailyView() {
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => res.json())
      .then((json) => {
        if (json) {
          // Extract planned array safely regardless of wrapping depth
          let plannedList = [];
          if (Array.isArray(json.planned)) {
            plannedList = json.planned;
          } else if (Array.isArray(json)) {
            plannedList = json;
          } else if (json.planned && typeof json.planned === 'object') {
            plannedList = [json.planned];
          }

          // Pick the first available workout object from planned array
          if (plannedList.length > 0) {
            setTodayWorkout(plannedList[0]);
          }

          if (Array.isArray(json.sportSettings)) {
            setSportSettings(json.sportSettings);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching daily view:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px', color: '#6c757d' }}>Loading Daily Workout...</div>;

  if (!todayWorkout) {
    return (
      <div style={{ padding: '20px', color: '#6c757d' }}>
        No scheduled workouts found for today.
      </div>
    );
  }

  const rawDate = todayWorkout.start_date_local || todayWorkout.icu_start_date || todayWorkout.start_date;
  const workoutDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'Today';
  const durationStr = formatDuration(todayWorkout.moving_time || todayWorkout.elapsed_time);
  const distanceMi = todayWorkout.distance ? (todayWorkout.distance * 0.000621371).toFixed(1) : null;

  // Extract steps from workout_doc
  let rawSteps = [];
  if (todayWorkout.workout_doc) {
    try {
      const doc = typeof todayWorkout.workout_doc === 'string' 
        ? JSON.parse(todayWorkout.workout_doc) 
        : todayWorkout.workout_doc;
      rawSteps = doc?.steps || [];
    } catch (e) {
      console.error("Error parsing workout_doc steps:", e);
    }
  }

  return (
    <div style={{ padding: '10px' }}>
      <h2>Today's Workout</h2>
      <div style={{ border: '1px solid #ced4da', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
          <span>{todayWorkout.name || "Daily Session"} ({todayWorkout.type || 'Run'})</span>
          <span>{workoutDate}</span>
        </div>

        <div style={{ fontSize: '14px', color: '#555', margin: '8px 0 14px 0' }}>
          Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
        </div>

        {/* Graphic Workout Chart */}
        {rawSteps.length > 0 && (
          <WorkoutChart 
            steps={rawSteps} 
            containerId="chart-daily-workout" 
          />
        )}

        {/* Unified Text & Step Details Component */}
        <WorkoutTextSection 
          workout={todayWorkout} 
          sportSettings={sportSettings} 
        />
      </div>
    </div>
  );
}