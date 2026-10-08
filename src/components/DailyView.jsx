import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';
import Modal_AddGear from '../modals/Modal_AddGear';
import GearBadge from './GearBadge';
import { useGearManagement, isWorkoutCompleted } from '../utils/useGearManagement';
import { useIsMobile, safeStringLower, getLocalDateString } from '../utils/MonthlyViewHelpers.jsx';
import { mergeDailyWorkoutFeeds } from '../utils/WorkoutFeedHelpers.js';
import '../CSS/DailyView.css';
import { usePaces } from '../utils/PacesContext.jsx'; 

const VAL_WORKOUTS_URL = "/api/val-workouts";
const HISTORICAL_URL = "/api/val-historical";

const getThresholdPaceForSport = (workout, sportSettings, contextPaces) => {
  return contextPaces?.threshold_pace || null;
};


export default function DailyView() {
  const { paces } = usePaces();

  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const isMobile = useIsMobile(768);

  const {
    removingGearId,
    errorMessage,
    setErrorMessage,
    modalWorkoutId,
    setModalWorkoutId,
    loadingGear,
    selectedGearId,
    setSelectedGearId,
    activeShoesList,
    handleRemoveGear,
    handleOpenAddGearModal,
    handleAddGear,
  } = useGearManagement(workouts, setWorkouts);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetch(VAL_WORKOUTS_URL).then((res) => res.json()).catch((err) => {
        console.error("Error fetching val-workouts:", err);
        return null;
      }),
      fetch(HISTORICAL_URL).then((res) => res.json()).catch((err) => {
        console.error("Error fetching historical activities:", err);
        return null;
      })
    ])
      .then(([valJson, historicalJson]) => {
        if (!isMounted) return;

        const { workouts: mergedList, sportSettings: settings } = mergeDailyWorkoutFeeds(
          valJson,
          historicalJson,
          { getLocalDateString, safeStringLower }
        );

        setWorkouts(mergedList);
        setSportSettings(settings);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading workout data:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);

  const nextDateObj = useMemo(() => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    return next;
  }, [selectedDate]);

  const nextDateStr = useMemo(() => getLocalDateString(nextDateObj), [nextDateObj]);

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

  if (loading) return <div className="daily-view-loading">Loading Daily Workouts & Activities...</div>;

  const formatHeaderDate = (dateObj) => {
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderWorkoutCard = (workout, index) => {
    const thresholdPaceMps = getThresholdPaceForSport(workout, sportSettings, paces);
    const workoutDateStr = getLocalDateString(
      workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date
    );

    const completed = isWorkoutCompleted(workout);
    const isPast = workoutDateStr < todayStr;
    const isMissed = isPast && !completed;
    const activityId = workout.icu_activity_id || workout.activity_id || workout.id;

    return (
      <div key={activityId || index} className="daily-workout-card">
        {/* Header Bar */}
        <div className="daily-workout-card-header">
          <div className="daily-workout-header-left">
            <span className="daily-workout-type">
              {workout.type || workout.sport || 'Activity'}
            </span>
            {completed && <span className="status-badge badge-completed">COMPLETED</span>}
            {isMissed && <span className="status-badge badge-missed">MISSED</span>}
          </div>

          <GearBadge
            workout={workout}
            removingGearId={removingGearId}
            onRemoveGear={handleRemoveGear}
            onOpenAddGear={handleOpenAddGearModal}
          />
        </div>

        {/* Workout Title */}
        <h3 className="daily-workout-title">
          {workout.name || workout.title || `${workout.type || 'Workout'}`}
        </h3>

        {(workout.workout_doc || workout.intervals) && (
          <>
            <WorkoutChart
              workout={workout}
              thresholdPace={thresholdPaceMps}
              chartHeight={isMobile ? "110px" : "140px"}
            />

            <WorkoutTextSection 
              workout={workout} 
              thresholdPace={thresholdPaceMps} 
              paceDetails={paces}
            />
          </>
        )}
      </div>
    );
  };

  const renderDaySection = (dateObj, dateStr, dayWorkouts) => {
    const isToday = dateStr === todayStr;

    return (
      <div className="daily-day-column">
        <div className="daily-day-section-header">
          <h3 className="daily-day-section-title">
            {formatHeaderDate(dateObj)}
          </h3>
          {isToday && <span className="daily-today-indicator">TODAY</span>}
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
      {errorMessage && (
        <div className="daily-toast-error">
          <span className="daily-toast-message">⚠️ {errorMessage}</span>
          <button 
            type="button" 
            className="daily-toast-close" 
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="daily-nav-bar">
        <div className="daily-nav-buttons">
          <button onClick={handlePrevDay} className="nav-btn">
            ← Prev
          </button>
          <button
            onClick={handleToday}
            className={`nav-btn ${selectedDateStr === todayStr ? 'nav-btn-today-active' : 'nav-btn-today'}`}
          >
            Today
          </button>
          <button onClick={handleNextDay} className="nav-btn">
            Next →
          </button>
        </div>
      </div>

      <div className="daily-two-day-grid">
        {renderDaySection(selectedDate, selectedDateStr, selectedDayWorkouts)}
        {renderDaySection(nextDateObj, nextDateStr, nextDayWorkouts)}
      </div>

      <Modal_AddGear
        isOpen={Boolean(modalWorkoutId)}
        onClose={() => {
          setModalWorkoutId(null);
          setSelectedGearId(null);
        }}
        loadingGear={loadingGear}
        activeShoesList={activeShoesList}
        selectedGearId={selectedGearId}
        setSelectedGearId={setSelectedGearId}
        onConfirmAdd={() => handleAddGear(modalWorkoutId, selectedGearId)}
      />
    </div>
  );
}
