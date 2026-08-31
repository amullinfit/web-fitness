import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from './WorkoutTextSection';

const VAL_WORKOUTS_URL = "https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run";

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

const getLocalDateString = (dateInput) => {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) return dateInput.split('T')[0];
    if (dateInput.length >= 10) return dateInput.slice(0, 10);
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function DailyView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

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

  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const todaysWorkouts = useMemo(() => {
    if (!Array.isArray(workouts)) return [];
    
    return workouts.filter((w) => {
      const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
      return getLocalDateString(rawDate) === selectedDateStr;
    });
  }, [workouts, selectedDateStr]);

  const handlePrevDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const handleToday = () => setSelectedDate(new Date());

  if (loading) return <div style={{ padding: '20px', color: '#6c757d' }}>Loading Daily Workout...</div>;

  const formattedHeaderDate = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      {/* Date Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #dee2e6' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#212529' }}>{formattedHeaderDate}</h2>
          {selectedDateStr === todayStr && (
            <span style={{ fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>Today</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrevDay} style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid #ced4da', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer' }}>
            ← Prev Day
          </button>
          <button onClick={handleToday} style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid #0d6efd', borderRadius: '4px', backgroundColor: selectedDateStr === todayStr ? '#0d6efd' : '#ffffff', color: selectedDateStr === todayStr ? '#ffffff' : '#0d6efd', fontWeight: '600', cursor: 'pointer' }}>
            Today
          </button>
          <button onClick={handleNextDay} style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid #ced4da', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer' }}>
            Next Day →
          </button>
        </div>
      </div>

      {/* Content */}
      {todaysWorkouts.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px dashed #dee2e6', color: '#6c757d' }}>
          No workouts scheduled for {selectedDateStr === todayStr ? 'today' : selectedDateStr}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {todaysWorkouts.map((workout, index) => {
            let rawSteps = [];
            if (workout.workout_doc) {
              const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
              rawSteps = doc?.steps || [];
            }
            const thresholdPaceMps = getThresholdPaceForSport(workout.type, sportSettings);

            return (
              <div key={workout.id || index} style={{ border: '1px solid #e9ecef', borderRadius: '8px', padding: '16px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#212529' }}>
                    {workout.name || workout.title || `${workout.type || 'Workout'}`}
                  </h3>
                  <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', backgroundColor: '#e9ecef', padding: '3px 8px', borderRadius: '4px', color: '#495057' }}>
                    {workout.type || 'Activity'}
                  </span>
                </div>

                {/* Independent Chart Render */}
                {rawSteps.length > 0 && (
                  <WorkoutChart steps={rawSteps} thresholdPace={thresholdPaceMps} />
                )}

                {/* Independent Text Render */}
                <WorkoutTextSection workout={workout} sportSettings={sportSettings} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}