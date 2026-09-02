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
 * Converts speed in meters per second (m/s) to pace in seconds per mile.
 * Returns null if speed is invalid or 0.
 */
const speedToPaceSeconds = (speedMps) => {
  if (typeof speedMps !== 'number' || speedMps <= 0) return null;
  return 1609.34 / speedMps;
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
  if (workout.feedSource === 'HISTORICAL') {
    return true;
  }

  // If from WORKOUTS feed, check if paired_event or compliance are not null
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
 * Derives pace values strictly from speed (in m/s), ignoring average_pace.
 */
const getStepsFromWorkout = (workout) => {
  if (!workout) return [];

  // 1. If activity has intervals array (Historical Feed)
  if (Array.isArray(workout.intervals) && workout.intervals.length > 0) {
    return workout.intervals.map((interval) => {
      const speed = interval.average_speed ?? null;
      return {
        duration: interval.elapsed_time || 0,
        pace: speedToPaceSeconds(speed), // Calculate pace strictly from m/s speed
        watts: interval.weighted_average_watts || interval.average_watts || null,
        speed: speed,
        type: interval.type || workout.type || 'Interval',
        distance: interval.distance || 0,
        name: interval.name || 'Interval'
      };
    });
  }

  // 2. Fall back to structured doc steps (Planned Workouts)
  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      const rawSteps = doc?.steps || [];
      const flattened = flattenSteps(rawSteps);

      return flattened.map((step) => {
        const speed = step.speed ?? (step.pace ? (typeof step.pace === 'number' ? step.pace : null) : null);
        return {
          ...step,
          pace: speedToPaceSeconds(speed) ?? step.pace // Fallback if planned step uses a direct pace value
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
 * Calculates Y-axis pace bounds and 4-6 tick marks (in seconds per mile/km).
 * Clamps maximum range to 6-8 minutes (360-480s) and steps by 60s (1:00), 90s (1:30), or 120s (2:00).
 */
export const calculatePaceTicks = (paceValuesInSeconds) => {
  const validPaces = paceValuesInSeconds.filter((p) => p && !isNaN(p) && p > 0);
  if (validPaces.length === 0) {
    return { minPace: 300, maxPace: 600, ticks: [300, 360, 420, 480, 540, 600] };
  }

  let rawMin = Math.min(...validPaces);
  let rawMax = Math.max(...validPaces);

  // Enforce minimum display window of 3 minutes (180s)
  if (rawMax - rawMin < 180) {
    const mid = (rawMin + rawMax) / 2;
    rawMin = Math.max(120, mid - 90);
    rawMax = rawMin + 180;
  }

  // Clamp maximum range to 7 minutes (420s) - within the 6-8 minute window
  const MAX_SPAN = 420;
  if (rawMax - rawMin > MAX_SPAN) {
    const mid = (rawMin + rawMax) / 2;
    rawMin = Math.max(120, mid - MAX_SPAN / 2);
    rawMax = rawMin + MAX_SPAN;
  }

  // Choose step increment: 60s (1:00), 90s (1:30), or 120s (2:00)
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

  // Ensure tick count stays between 4 and 6
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

        // Extract and tag feedSource
        const valList = (valJson?.planned || valJson?.workouts || (Array.isArray(valJson) ? valJson : []))
          .map((item) => ({ ...item, feedSource: 'WORKOUTS' }));

        const historicalList = (historicalJson?.activities || historicalJson?.workouts || (Array.isArray(historicalJson) ? historicalJson : []))
          .map((item) => ({ ...item, feedSource: 'HISTORICAL' }));

        const settings = Array.isArray(valJson?.sportSettings)
          ? valJson.sportSettings
          : Array.isArray(historicalJson?.sportSettings)
          ? historicalJson.sportSettings
          : [];

        // Merge & deduplicate by ID / composite key
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

  // Compute oldest & newest dates across the merged list
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
    const thresholdPaceMps = getThresholdPaceForSport(workout.type, sportSettings);

    // Extract pace in seconds/mile strictly from step speed (m/s)
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

        {rawSteps.length > 0 && (
          <WorkoutChart
            steps={rawSteps}
            thresholdPace={thresholdPaceMps}
            paceConfig={paceConfig}
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
      {/* Debug Line displaying merged range and feed breakdown */}
      <div className="daily-debug-bar">
        [DEBUG] Merged Range: Oldest = <strong>{workoutDateBounds.oldest}</strong> | Newest = <strong>{workoutDateBounds.newest}</strong> (Total: {workouts.length} [HISTORICAL: {workoutDateBounds.historicalCount}, WORKOUTS: {workoutDateBounds.workoutCount}])
      </div>

      {/* Date Navigation Bar */}
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

      {/* Two Days Grid */}
      <div className="daily-two-day-grid">
        {renderDaySection(selectedDate, selectedDateStr, selectedDayWorkouts)}
        {renderDaySection(nextDateObj, nextDateStr, nextDayWorkouts)}
      </div>
    </div>
  );
}