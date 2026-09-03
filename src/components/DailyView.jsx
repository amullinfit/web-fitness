import React, { useState, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from './WorkoutTextSection';

const VAL_DAILY_URL = "/api/val-daily";

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

const speedToPaceSeconds = (speedMps) => {
  if (typeof speedMps !== 'number' || speedMps <= 0 || isNaN(speedMps)) return null;
  return 1609.344 / speedMps;
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

// Extracts planned workout steps from workout_doc
const getPlannedSteps = (workout) => {
  if (!workout?.workout_doc) return [];
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
    return [];
  }
};

// Extracts actual performed intervals
const getActualIntervals = (workout) => {
  if (!Array.isArray(workout?.intervals) || workout.intervals.length === 0) return [];
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
};

const calculatePaceTicks = (paceValuesInSeconds) => {
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
  const [dailyData, setDailyData] = useState(null);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_DAILY_URL)
      .then((res) => res.json())
      .then((json) => {
        if (json) {
          setDailyData(json);
          setSportSettings(Array.isArray(json.sportSettings) ? json.sportSettings : []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px', color: '#6c757d' }}>Loading Daily View...</div>;
  if (!dailyData) return <div style={{ padding: '20px' }}>No workout data available for today.</div>;

  const workouts = Array.isArray(dailyData.workouts) ? dailyData.workouts : (dailyData.workout ? [dailyData.workout] : []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px' }}>
      <h2>Today's Workouts</h2>
      {workouts.map((w, index) => {
        const rawDate = w.start_date_local || w.icu_start_date || w.start_date;
        const workoutDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'Today';
        const durationStr = formatDuration(w.moving_time || w.elapsed_time);
        const distanceMi = w.distance ? (w.distance * 0.000621371).toFixed(1) : null;

        const plannedSteps = getPlannedSteps(w);
        const actualIntervals = getActualIntervals(w);

        // Combine both planned and actual paces to properly calculate pace scaling
        const allSteps = [...plannedSteps, ...actualIntervals];
        const thresholdPaceMps = getThresholdPaceForSport(w.type, sportSettings);

        const paceValues = allSteps
          .map((s) => speedToPaceSeconds(s.speed))
          .filter((p) => p !== null && !isNaN(p));

        const paceConfig = calculatePaceTicks(paceValues);
        const workoutId = w.id || `daily-${index}`;

        return (
          <div key={workoutId} style={{ border: '1px solid #ced4da', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
              <span>{w.name || "Workout"} ({w.type || 'Run'})</span>
              <span>{workoutDate}</span>
            </div>

            <div style={{ fontSize: '14px', color: '#555', margin: '6px 0 12px 0' }}>
              Duration: {durationStr} {distanceMi && `| Distance: ${distanceMi} mi`}
            </div>

            {(allSteps.length > 0 || w.workout_doc || w.intervals) && (
              <WorkoutChart 
                workout={w}
                steps={plannedSteps.length > 0 ? plannedSteps : actualIntervals} 
                plannedSteps={plannedSteps}
                actualIntervals={actualIntervals}
                thresholdPace={thresholdPaceMps}
                paceConfig={paceConfig}
                sportSettings={sportSettings}
              />
            )}

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