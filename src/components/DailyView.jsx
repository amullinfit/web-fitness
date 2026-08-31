import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from './WorkoutTextSection';
import './DailyView.css';

const VAL_WORKOUTS_URL = "/api/val-workouts";

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

const isWorkoutCompleted = (workout) => {
  return (
    workout.completed === true ||
    workout.state === 'DONE' ||
    Boolean(workout.moving_time) ||
    Boolean(workout.elapsed_time) ||
    Boolean(workout.distance_completed)
  );
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

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);

  const nextDateObj = useMemo(() => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    return next;
  }, [selectedDate]);

  const nextDateStr = useMemo(() => getLocalDateString(nextDateObj), [nextDateObj]);

  // Group workouts by date
  const selectedDayWorkouts = useMemo(() => {
    if (!Array.isArray(workouts)) return [];
    return workouts.filter((w) => {
      const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
      return getLocalDateString(rawDate) === selectedDateStr;
    });
  }, [workouts, selectedDateStr]);

  const nextDayWorkouts = useMemo(() => {
    if (!Array.isArray(workouts)) return [];
    return workouts.filter((w) => {
      const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
      return getLocalDateString(rawDate) === nextDateStr;
    });
  }, [workouts, nextDateStr]);

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

  if (loading) return <div className="daily-view-loading">Loading Daily Workouts...</div>;

  const formatHeaderDate = (dateObj) => {
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderWorkoutCard = (workout, index) => {
    let rawSteps = [];
    if (workout.workout_doc) {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      rawSteps = doc?.steps || [];
    }
    const thresholdPaceMps = getThresholdPaceForSport(workout.type, sportSettings);

    const workoutDateStr = getLocalDateString(
      workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date
    );

    const completed = isWorkoutCompleted(workout);
    const isPast = workoutDateStr < todayStr;
    const isMissed = isPast && !completed;

    return (
      <div key={workout.id || index} className="daily-workout-card">
        <div className="daily-workout-card-header">
          <div className="daily-workout-title-group">
            {completed && <span className="status-badge badge-completed">COMPLETED</span>}
            {isMissed && <span className="status-badge badge-missed">MISSED</span>}
            <h3 className="daily-workout-title">
              {workout.name || workout.title || `${workout.type || 'Workout'}`}
            </h3>
          </div>
          <span className="daily-workout-type">
            {workout.type || 'Activity'}
          </span>
        </div>

        {rawSteps.length > 0 && (
          <WorkoutChart steps={rawSteps} thresholdPace={thresholdPaceMps} />
        )}

        <WorkoutTextSection workout={workout} sportSettings={sportSettings} />
      </div>
    );
  };

  const renderDaySection = (dateObj, dateStr, dayWorkouts, isMainSelected) => {
    const isToday = dateStr === todayStr;

    return (
      <div className="daily-day-column">
        <div className="daily-day-section-header">
          <h3 className="daily-day-section-title">
            {formatHeaderDate(dateObj)}
          </h3>
          {isToday && <span className="daily-today-indicator">Today</span>}
        </div>

        {dayWorkouts.length === 0 ? (
          <div className="daily-empty-card">
            No workouts scheduled for {isToday ? 'today' : dateStr}.
          </div>
        ) : (
          <div className="daily-workouts-list">
            {dayWorkouts.map((workout, idx) => renderWorkoutCard(workout, idx))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="daily-view-container">
      {/* Date Navigation Bar */}
      <div className="daily-nav-bar">
        <div>
          <h2 className="daily-header-title">
            {formatHeaderDate(selectedDate)}
          </h2>
          <span className="daily-header-subtitle">
            Showing 2-Day Schedule ({selectedDateStr} & {nextDateStr})
          </span>
        </div>

        <div className="daily-nav-buttons">
          <button onClick={handlePrevDay} className="nav-btn">
            ← Prev Day
          </button>
          <button
            onClick={handleToday}
            className={`nav-btn ${selectedDateStr === todayStr ? 'nav-btn-today-active' : 'nav-btn-today'}`}
          >
            Today
          </button>
          <button onClick={handleNextDay} className="nav-btn">
            Next Day →
          </button>
        </div>
      </div>

      {/* Two Days Grid */}
      <div className="daily-two-day-grid">
        {renderDaySection(selectedDate, selectedDateStr, selectedDayWorkouts, true)}
        {renderDaySection(nextDateObj, nextDateStr, nextDayWorkouts, false)}
      </div>
    </div>
  );
}