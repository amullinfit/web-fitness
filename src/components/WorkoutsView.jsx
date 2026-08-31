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

export default function WorkoutsView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => res.json())
      .then((json) => {
        if (json) {
          const list = json.planned || json.workouts || (Array.isArray(json) ? json : []);
          setWorkouts(list);
          setSportSettings(Array.isArray(json.sportSettings) ? json.sportSettings : []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching workouts:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px', color: '#6c757d' }}>Loading Upcoming Workouts...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px' }}>
      <h2>Upcoming Workouts</h2>
      {workouts.map((w, index) => {
        const rawDate = w.start_date_local || w.icu_start_date || w.start_date;
        const workoutDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'TBD';
        const durationStr = formatDuration(w.moving_time || w.elapsed_time);
        const distanceMi = w.distance ? (w.distance * 0.000621371).toFixed(1) : null;
        
        let rawSteps = [];
        if (w.workout_doc) {
          const doc = typeof w.workout_doc === 'string' ? JSON.parse(w.workout_doc) : w.workout_doc;
          rawSteps = doc?.steps || [];
        }

        const thresholdPaceMps = getThresholdPaceForSport(w.type, sportSettings);
        const workoutId = w.id || `upcoming-${index}`;

        return (
          <div key={workoutId} style={{ border: '1px solid #ced4da', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
              <span>{w.name || "Workout"} ({w.type || 'Run'})</span>
              <span>{workoutDate}</span>
            </div>

            <div style={{ fontSize: '14px', color: '#555', margin: '6px 0 12px 0' }}>
              Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
            </div>

            {/* Independent Chart Render with thresholdPace for mm:ss */}
            {rawSteps.length > 0 && (
              <WorkoutChart 
                steps={rawSteps} 
                thresholdPace={thresholdPaceMps}
              />
            )}

            {/* Independent Text Render */}
            <WorkoutTextSection 
              workout={w} 
              sportSettings={sportSettings} 
            />
          </div>
        );
      })}
    </div>
  );
}