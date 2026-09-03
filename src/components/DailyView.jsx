import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from './WorkoutTextSection';
import './DailyView.css';

const VAL_WORKOUTS_URL = "/api/val-workouts";
const HISTORICAL_URL = "/api/val-historical";

const safeStringLower = (val) => {
  if (!val) return "";
  if (typeof val === 'string') return val.toLowerCase();
  return String(val.id || val.type || val.name || val).toLowerCase();
};

/**
 * Converts speed in meters per second (m/s) directly into pace in total SECONDS per mile.
 * e.g., 2.1347609 m/s -> 753.87 seconds
 */
const speedToPaceSeconds = (speedMps) => {
  if (typeof speedMps !== 'number' || speedMps <= 0 || isNaN(speedMps)) return null;
  // 1 mile = 1609.344 meters
  return 1609.344 / speedMps;
};

/**
 * Formats speed (m/s) into a human-readable pace string (MM:SS per mile).
 * e.g., 2.1347609 m/s -> "12:34"
 */
const formatPaceFromSpeed = (speedMps) => {
  const totalSeconds = speedToPaceSeconds(speedMps);
  if (!totalSeconds) return '--:--';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (seconds === 60) {
    return `${minutes + 1}:00`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getThresholdPaceForSport = (workout, sportSettings) => {
  if (!workout) return null;

  // 1. Check if the historical activity object has threshold_pace embedded directly
  if (typeof workout.threshold_pace === 'number' && workout.threshold_pace > 0) {
    return workout.threshold_pace;
  }
  if (typeof workout.icu_threshold_pace === 'number' && workout.icu_threshold_pace > 0) {
    return workout.icu_threshold_pace;
  }
  if (workout.sportSettings?.threshold_pace) {
    return workout.sportSettings.threshold_pace;
  }

  // 2. Fall back to matching sportSettings array by sport type
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

  const hasPairedEvent = workout.paired_event !== null && workout.paired_event !== undefined;
  const hasCompliance = workout.compliance !== null && workout.compliance !== undefined;

  return hasPairedEvent || hasCompliance;
};

/**
 * Recursive helper to flatten nested repeat steps (reps blocks)
 */
const flattenSteps = (stepsList) => {
  if (!Array.isArray(stepsList)) return [];

  return stepsList.reduce((acc, step) => {
    if (Array.isArray(step.steps) && step.steps.length > 0) {
      const reps = step.reps && Number.isInteger(step.reps) && step.reps > 0 ? step.reps : 1;
      const innerFlattened = flattenSteps(step.steps);

      for (let i = 0; i < reps; i++) {
        acc.push(...innerFlattened.map((s) => ({ ...s })));
      }
    } else {
      acc.push(step);
    }
    return acc;
  }, []);
};

/**
 * Extracts and flattens workout steps for both historical and planned workouts.
 */
const getStepsFromWorkout = (workout) => {
  if (!workout) return [];

  if (Array.isArray(workout.intervals) && workout.intervals.length > 0) {
    return workout.intervals.map((interval) => {
      const rawSpeed = parseFloat(interval.average_speed ?? interval.speed);
      const speed = !isNaN(rawSpeed) && rawSpeed > 0 ? rawSpeed : null;

      return {
        duration: interval.elapsed_time || 0,
        pace: speedToPaceSeconds(speed),
        watts: interval.weighted_average_watts || interval.average_watts || null,
        speed: speed,
        type: interval.type || workout.type || 'Interval',
        distance: interval.distance || 0,
        name: interval.name || 'Interval'
      };
    });
  }

  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      const rawSteps = doc?.steps || [];
      const flattened = flattenSteps(rawSteps);

      return flattened.map((step) => {
        const speed = step.speed ?? (step.pace ? (typeof step.pace === 'number' ? step.pace : null) : null);
        return {
          ...step,
          pace: speedToPaceSeconds(speed) ?? step.pace
        };
      });
    } catch (e) {
      console.error('Error parsing workout_doc:', e);
      return [];
    }
  }

  return [];
};

/**
 * Calculates Y-axis pace bounds and tick marks in seconds per mile/km.
 */
export const calculatePaceTicks = (paceValuesInSeconds) => {
  const validPaces = paceValuesInSeconds.filter((p) => p && !isNaN(p) && p > 0);
  if (validPaces.length === 0) {
    return { minPace: 300, maxPace: 600, ticks: [300, 360, 420, 480, 540, 600] };
  }

  let rawMin = Math.min(...validPaces);
  let rawMax = Math.max(...validPaces);

  if (rawMax - rawMin < 180) {
    const mid = (rawMin + rawMax) / 2;
    rawMin = Math.max(120, mid - 90);
    rawMax = rawMin + 180;
  }

  const MAX_SPAN = 420;
  if (rawMax - rawMin > MAX_SPAN) {
    const mid = (rawMin + rawMax) / 2;
    rawMin = Math.max(120, mid - MAX_SPAN / 2);
    rawMax = rawMin + MAX_SPAN;
  }

  const span = rawMax - rawMin;
  let step = 60;
  if (span > 300) {
    step = 120;
  } else if (span > 180) {
    step = 90;
  }

  const startTick = Math.floor(rawMin / step) * step;
  const endTick = Math.ceil(rawMax / step) * step;

  const ticks = [];
  for (let t = startTick; t <= endTick; t += step) {
    ticks.push(t);
  }

  if (ticks.length > 6) {
    const doubleStep = step * 2;
    const doubleTicks = [];
    const newStart = Math.floor(rawMin / doubleStep) * doubleStep;
    const newEnd = Math.ceil(rawMax / doubleStep) * doubleStep;
    for (let t = newStart; t <= newEnd; t += doubleStep) {
      doubleTicks.push(t);
    }
    return {
      minPace: doubleTicks[0],
      maxPace: doubleTicks[doubleTicks.length - 1],
      ticks: doubleTicks
    };
  }

  return {
    minPace: ticks[0],
    maxPace: ticks[ticks.length - 1],
    ticks
  };
};

export default function DailyView() {
  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

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

        const rawMerged = [...valList, ...historicalList];
        const seenIds = new Set();
        const mergedList = [];

        for (const item of rawMerged) {
          if (!item) continue;
          const itemDate = getLocalDateString(item.start_date_local || item.icu_start_date || item.start_date || item.date);
          const uniqueKey = item.id ? String(item.id) : `${item.name || item.type}-${itemDate}-${item.feedSource}`;

          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
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

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);

  const workoutDateBounds = useMemo(() => {
    if (!Array.isArray(workouts) || workouts.length === 0) {
      return { oldest: 'N/A', newest: 'N/A', historicalCount: 0, workoutCount: 0 };
    }

    const validDates = workouts
      .map((w) => getLocalDateString(w.start_date_local || w.icu_start_date || w.start_date || w.date))
      .filter(Boolean)
      .sort();

    const historicalCount = workouts.filter((w) => w.feedSource === 'HISTORICAL').length;
    const workoutCount = workouts.filter((w) => w.feedSource === 'WORKOUTS').length;

    if (validDates.length === 0) {
      return { oldest: 'N/A', newest: 'N/A', historicalCount, workoutCount };
    }

    return {
      oldest: validDates[0],
      newest: validDates[validDates.length - 1],
      historicalCount,
      workoutCount
    };
  }, [workouts]);

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
    const rawSteps = getStepsFromWorkout(workout);
    const thresholdPaceMps = getThresholdPaceForSport(workout, sportSettings);
    
    const paceValues = rawSteps
      .map((s) => speedToPaceSeconds(s.speed))
      .filter((p) => p !== null && !isNaN(p));

    const paceConfig = calculatePaceTicks(paceValues);

    const workoutDateStr = getLocalDateString(
      workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date
    );

    const completed = isWorkoutCompleted(workout);
    const isPast = workoutDateStr < todayStr;
    const isMissed = isPast && !completed;

    return (
      <div key={workout.id || index} className="daily-workout-card">
        <div className="daily-workout-card-header">
          <h3 className="daily-workout-title">
            {workout.name || workout.title || `${workout.type || 'Workout'}`}
          </h3>

          <div className="daily-workout-header-right">
            {completed && <span className="status-badge badge-completed">COMPLETED</span>}
            {isMissed && <span className="status-badge badge-missed">MISSED</span>}
            <span className="daily-workout-type">
              {workout.type || 'Activity'}
            </span>
          </div>
        </div>

        {/* Updated WorkoutChart Invocation */}
        {(rawSteps.length > 0 || workout.workout_doc || workout.intervals) && (
          <WorkoutChart
            workout={workout}
            steps={rawSteps}
            thresholdPace={thresholdPaceMps}
            paceConfig={paceConfig}
            sportSettings={sportSettings}
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
            No workouts or activities scheduled for {isToday ? 'today' : dateStr}.
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
      <div className="daily-debug-bar">
        [DEBUG] Merged Range: Oldest = <strong>{workoutDateBounds.oldest}</strong> | Newest = <strong>{workoutDateBounds.newest}</strong> (Total: {workouts.length} [HISTORICAL: {workoutDateBounds.historicalCount}, WORKOUTS: {workoutDateBounds.workoutCount}])
      </div>

      <div className="daily-nav-bar">
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

      <div className="daily-two-day-grid">
        {renderDaySection(selectedDate, selectedDateStr, selectedDayWorkouts)}
        {renderDaySection(nextDateObj, nextDateStr, nextDayWorkouts)}
      </div>
    </div>
  );
}