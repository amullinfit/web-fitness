import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import './MonthlyView.css';

const VAL_WORKOUTS_URL = "/api/val-workouts";
const HISTORICAL_URL = "/api/val-historical";
const GEAR_REMOVE_URL = "/api/val-gear-remove";
const GEAR_ADD_URL = "/api/val-gear-add";
const GEAR_URL = "/api/val-gear";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handleChange = (e) => setIsMobile(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobile;
}

const safeStringLower = (val) => {
  if (!val) return "";
  if (typeof val === 'string') return val.toLowerCase();
  return String(val.id || val.type || val.name || val).toLowerCase();
};

const getThresholdPaceForSport = (workout, sportSettings) => {
  if (!workout) return null;

  if (typeof workout.threshold_pace === 'number' && workout.threshold_pace > 0) {
    return workout.threshold_pace;
  }
  if (typeof workout.icu_threshold_pace === 'number' && workout.icu_threshold_pace > 0) {
    return workout.icu_threshold_pace;
  }
  if (workout.sportSettings?.threshold_pace) {
    return workout.sportSettings.threshold_pace;
  }

  const sportType = safeStringLower(workout.type || workout.sport);
  if (!sportType || !Array.isArray(sportSettings)) return null;

  const match = sportSettings.find((s) => {
    if (!s) return false;
    const settingType = safeStringLower(s.type || s.id || s.sport);
    let typesList = Array.isArray(s.types) ? s.types.map((t) => safeStringLower(t)) : [];
    
    return (
      settingType === sportType ||
      typesList.includes(sportType) ||
      typesList.some((t) => sportType.includes(t) || t.includes(sportType))
    );
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
  if (workout.feedSource === 'HISTORICAL') {
    return true;
  }

  const hasPairedEvent = workout.paired_event_id !== null && workout.paired_event_id !== undefined;
  const hasCompliance = workout.compliance !== null && workout.compliance !== undefined;

  return hasPairedEvent || hasCompliance;
};

const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getDatesByDay = (startMonday) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startMonday);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};

export default function MonthlyView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getMondayOfWeek(new Date()));
  const [errorMessage, setErrorMessage] = useState(null);

  const isMobile = useIsMobile(768);

  const showErrorMessage = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage(null);
    }, 6000);
  };

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

        const valList = (valJson?.planned || valJson?.workouts || (Array.isArray(valJson) ? valJson : []))
          .map((item) => ({ ...item, feedSource: 'WORKOUTS' }));

        const historicalList = (historicalJson?.activities || historicalJson?.workouts || (Array.isArray(historicalJson) ? historicalJson : []))
          .map((item) => ({ ...item, feedSource: 'HISTORICAL' }));

        const settings = Array.isArray(valJson?.sportSettings)
          ? valJson.sportSettings
          : Array.isArray(historicalJson?.sportSettings)
          ? historicalJson.sportSettings
          : [];

        const plannedWorkoutsById = new Map();
        const plannedWorkoutsByDateType = new Map();

        valList.forEach((workout) => {
          if (!workout) return;

          if (workout.id !== undefined && workout.id !== null) {
            plannedWorkoutsById.set(String(workout.id), workout);
          }

          const itemDate = getLocalDateString(workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date);
          const itemType = safeStringLower(workout.type || workout.sport || 'workout');
          if (itemDate) {
            plannedWorkoutsByDateType.set(`${itemDate}-${itemType}`, workout);
          }
        });

        const pairedEventIds = new Set();

        const updatedHistoricalList = historicalList.map((item) => {
          if (!item) return item;

          let plannedMatch = null;

          if (item.paired_event_id !== null && item.paired_event_id !== undefined) {
            const pairedIdStr = String(item.paired_event_id);
            pairedEventIds.add(pairedIdStr);
            plannedMatch = plannedWorkoutsById.get(pairedIdStr);
          }

          if (!plannedMatch) {
            const itemDate = getLocalDateString(item.start_date_local || item.icu_start_date || item.start_date || item.date);
            const itemType = safeStringLower(item.type || item.sport || 'workout');
            plannedMatch = plannedWorkoutsByDateType.get(`${itemDate}-${itemType}`);

            if (plannedMatch && plannedMatch.id) {
              pairedEventIds.add(String(plannedMatch.id));
            }
          }

          if (plannedMatch) {
            const plannedName = plannedMatch.name || plannedMatch.title;
            if (plannedName) {
              return {
                ...item,
                name: plannedName,
                title: plannedName,
                workout_doc: item.workout_doc || plannedMatch.workout_doc
              };
            }
          }

          return item;
        });

        const filteredValList = valList.filter((workout) => {
          if (!workout || workout.id === undefined || workout.id === null) return true;
          return !pairedEventIds.has(String(workout.id));
        });

        const rawMerged = [...updatedHistoricalList, ...filteredValList];
        const seenKeys = new Set();
        const mergedList = [];

        for (const item of rawMerged) {
          if (!item) continue;
          const itemDate = getLocalDateString(item.start_date_local || item.icu_start_date || item.start_date || item.date);
          const itemType = safeStringLower(item.type || item.sport || 'workout');
          const uniqueKey = item.id ? String(item.id) : `${item.name || itemType}-${itemDate}-${item.feedSource}`;

          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            mergedList.push(item);
          }
        }

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

  const weekDates = useMemo(() => getDatesByDay(currentWeekMonday), [currentWeekMonday]);

  const workoutsByDate = useMemo(() => {
    const map = {};
    weekDates.forEach((date) => {
      const dateStr = getLocalDateString(date);
      map[dateStr] = [];
    });

    if (Array.isArray(workouts)) {
      workouts.forEach((w) => {
        const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
        const dateStr = getLocalDateString(rawDate);
        if (map.hasOwnProperty(dateStr)) {
          map[dateStr].push(w);
        }
      });
    }

    return map;
  }, [workouts, weekDates]);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const handlePrevWeek = () => {
    setCurrentWeekMonday((prev) => {
      const newMonday = new Date(prev);
      newMonday.setDate(newMonday.getDate() - 7);
      return newMonday;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekMonday((prev) => {
      const newMonday = new Date(prev);
      newMonday.setDate(newMonday.getDate() + 7);
      return newMonday;
    });
  };

  const handleToday = () => {
    setCurrentWeekMonday(getMondayOfWeek(new Date()));
  };

  if (loading) return <div className="monthly-view-loading">Loading Monthly Workouts & Activities...</div>;

  const formatHeaderDate = (dateObj) => {
    return dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDayName = (dayIndex) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[dayIndex];
  };

  const renderDayCell = (date, workoutList) => {
    const dateStr = getLocalDateString(date);
    const isToday = dateStr === todayStr;
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;

    return (
      <div 
        key={dateStr} 
        className={`monthly-day-cell ${isToday ? 'monthly-today' : ''}`}
      >
        <div className="monthly-day-header">
          <div className="monthly-day-name">{getDayName(dayIndex)}</div>
          <div className="monthly-day-date">{formatHeaderDate(date)}</div>
        </div>

        <div className="monthly-day-workouts">
          {workoutList.length === 0 ? (
            <div className="monthly-empty-day"></div>
          ) : (
            workoutList.map((workout, idx) => {
              const thresholdPaceMps = getThresholdPaceForSport(workout, sportSettings);
              const completed = isWorkoutCompleted(workout);
              const isPast = dateStr < todayStr;
              const isMissed = isPast && !completed;

              return (
                <div 
                  key={workout.id || idx} 
                  className={`monthly-workout-item ${completed ? 'monthly-completed' : ''} ${isMissed ? 'monthly-missed' : ''}`}
                >
                  <div className="monthly-workout-type">
                    {workout.type || workout.sport || 'Activity'}
                  </div>
                  <div className="monthly-workout-title">
                    {workout.name || workout.title || 'Workout'}
                  </div>
                  {(workout.workout_doc || workout.intervals) && (
                    <WorkoutChart
                      workout={workout}
                      thresholdPace={thresholdPaceMps}
                      chartHeight={isMobile ? "60px" : "80px"}
                      showWorkoutName={false}
                      showThresholdPace={false}
                      showYAxisLabels={false}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="monthly-view-container">
      {errorMessage && (
        <div className="monthly-toast-error">
          <span className="monthly-toast-message">⚠️ {errorMessage}</span>
          <button 
            type="button" 
            className="monthly-toast-close" 
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="monthly-nav-bar">
        <div className="monthly-nav-buttons">
          <button onClick={handlePrevWeek} className="nav-btn">
            ← Prev Week
          </button>
          <button
            onClick={handleToday}
            className="nav-btn nav-btn-today"
          >
            This Week
          </button>
          <button onClick={handleNextWeek} className="nav-btn">
            Next Week →
          </button>
        </div>
        <div className="monthly-week-label">
          {currentWeekMonday.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })} - {new Date(currentWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      <div className={`monthly-grid ${isMobile ? 'monthly-grid-mobile' : 'monthly-grid-desktop'}`}>
        {weekDates.map((date) => {
          const dateStr = getLocalDateString(date);
          return renderDayCell(date, workoutsByDate[dateStr] || []);
        })}
      </div>
    </div>
  );
}