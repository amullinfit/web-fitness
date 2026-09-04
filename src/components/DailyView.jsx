import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from './WorkoutTextSection';
import './DailyView.css';

const VAL_WORKOUTS_URL = "/api/val-workouts";
const HISTORICAL_URL = "/api/val-historical";
const GEAR_REMOVE_URL = "/api/api_gear_remove";

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

export default function DailyView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [removingGearId, setRemovingGearId] = useState(null);

  const isMobile = useIsMobile(768);

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

  const handleRemoveGear = async (workoutId, gearId) => {
    if (!workoutId || !gearId) {
      console.warn("Cannot remove gear: missing workoutId or gearId", { workoutId, gearId });
      return;
    }

    setRemovingGearId(workoutId);

    try {
      // Map keys directly to what api_gear_remove expects: activity_id and gear_id
      const response = await fetch(GEAR_REMOVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          activity_id: workoutId, 
          gear_id: gearId 
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || `Failed to remove gear: ${response.statusText}`);
      }

      // Update state to remove gear fields from state locally
      setWorkouts((prev) =>
        prev.map((w) => {
          if (String(w.id) === String(workoutId)) {
            return {
              ...w,
              shoe_name: null,
              gear_name: null,
              gear_id: null,
              gear: Array.isArray(resData.gear) ? resData.gear : null
            };
          }
          return w;
        })
      );
    } catch (err) {
      console.error("Error executing api_gear_remove:", err);
    } finally {
      setRemovingGearId(null);
    }
  };

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
    const thresholdPaceMps = getThresholdPaceForSport(workout, sportSettings);
    const workoutDateStr = getLocalDateString(
      workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date
    );

    const completed = isWorkoutCompleted(workout);
    const isPast = workoutDateStr < todayStr;
    const isMissed = isPast && !completed;

    const shoeName = workout.shoe_name || workout.gear_name || (typeof workout.gear === 'object' && !Array.isArray(workout.gear) ? workout.gear?.name : null);
    
    // Extracts exact gear ID string across single objects, array of IDs, or root gear_id
    const gearId = workout.gear_id || 
      (Array.isArray(workout.gear) && workout.gear.length > 0 
        ? (typeof workout.gear[0] === 'object' ? workout.gear[0].id : workout.gear[0])
        : typeof workout.gear === 'object' ? workout.gear?.id : null);

    // Prefer historical/icu_activity_id over paired event IDs when attempting to update actual activities
    const activityId = workout.icu_activity_id || workout.activity_id || workout.id;
    const isRemoving = removingGearId === activityId;

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

          {shoeName && (
            <div className="daily-workout-header-right">
              <span className="daily-workout-type daily-shoe-type">
                <span>👟 {shoeName}</span>
                <button
                  type="button"
                  className="remove-gear-btn"
                  title={`Activity ID: ${activityId} | Gear ID: ${gearId}`}
                  disabled={isRemoving}
                  onClick={() => handleRemoveGear(activityId, gearId)}
                >
                  {isRemoving ? <span className="gear-spinner" /> : '✕'}
                </button>
                <div className="gear-id-tooltip">
                  <span><strong>Activity ID:</strong> {activityId || 'N/A'}</span>
                  <span><strong>Gear ID:</strong> {gearId || 'N/A'}</span>
                </div>
              </span>
            </div>
          )}
        </div>

        <h3 className="daily-workout-title">
          {workout.name || workout.title || `${workout.type || 'Workout'}`}
        </h3>

        {(workout.workout_doc || workout.intervals) && (
          <WorkoutChart
            workout={workout}
            thresholdPace={thresholdPaceMps}
            chartHeight={isMobile ? "110px" : "140px"}
          />
        )}

        <WorkoutTextSection workout={workout} sportSettings={sportSettings} />
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
    </div>
  );
}