import React, { useEffect, useMemo, useRef, useState } from 'react';
import WorkoutChart from './WorkoutChart';
import { WorkoutZoomModal } from '../modals/MonthlyModal_ZoomWorkout.jsx';
import { usePaces } from '../utils/PacesContext.jsx';
import { useIsMobile } from '../utils/MonthlyViewHelpers.jsx';
import { extractStepPaceRange, getThresholdSecFromPaces } from '../utils/WorkoutChartHelpers.js';
import { fetchWorkoutsApi } from '../utils/WorkoutBuilderHelpers.js';
import '../CSS/TrainingPlanEditor.css';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const INITIAL_WEEKS = 4;

const makeEmptyWeeks = (count) =>
  Array.from({ length: count }, (_, index) => ({
    weekNumber: index + 1,
    days: WEEKDAYS.map((day) => ({ day, workouts: [] })),
  }));

const makePlan = (name = 'New Training Plan', weekCount = INITIAL_WEEKS) => ({
  id: null,
  name,
  weeks: makeEmptyWeeks(weekCount),
});

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const paceSecondsPerMile = (step, paces) => {
  const pace = step?.pace;
  if (!pace) return 0;
  const units = String(pace.units || '').toLowerCase();
  const values = [pace.value, pace.start, pace.end].map(asNumber).filter((value) => value > 0);
  if (!values.length) return 0;
  const value = values.reduce((sum, item) => sum + item, 0) / values.length;

  if (units.includes('sec')) return value;
  if (units.includes('min')) return value * 60;
  if (units.includes('%') || units.includes('pct')) {
    const threshold = asNumber(paces?.run_pace_sec) || getThresholdSecFromPaces(paces);
    return threshold / (value / 100);
  }
  if (units.includes('zone')) {
    const range = extractStepPaceRange(pace, paces);
    const fast = asNumber(range?.fastSec);
    const slow = asNumber(range?.slowSec);
    if (fast && slow) return (fast + slow) / 2;
    return fast || slow;
  }
  return 0;
};

// Estimate duration and mileage from the workout document. Repeat blocks are
// multiplied by their iteration count; distance-based steps use miles as
// represented by the existing Workout Builder data model.
const estimateStep = (step, sport = 'Run', paces = null) => {
  if (!step || typeof step !== 'object') return { seconds: 0, miles: 0 };

  if (Array.isArray(step.steps)) {
    const childTotals = step.steps.reduce((total, child) => {
      const estimate = estimateStep(child, sport, paces);
      total.seconds += estimate.seconds;
      total.miles += estimate.miles;
      return total;
    }, { seconds: 0, miles: 0 });
    const repetitions = Math.max(1, asNumber(step.iterations ?? step.reps) || 1);
    return { seconds: childTotals.seconds * repetitions, miles: childTotals.miles * repetitions };
  }

  const duration = asNumber(step.duration ?? step.duration_seconds);
  const distance = asNumber(step.distance ?? step.distanceMiles ?? step.distance_miles);
  const pace = paceSecondsPerMile(step, paces);
  const isRun = /run|running/i.test(String(sport || 'Run'));

  if (duration) {
    return { seconds: duration, miles: pace && isRun ? duration / pace : 0 };
  }
  if (distance) {
    return { seconds: pace ? distance * pace : 0, miles: distance };
  }
  return { seconds: 0, miles: 0 };
};

const estimateWorkout = (workout, paces) => {
  const sport = workout?.type || workout?.sport || workout?.workout_doc?.type || 'Run';
  const steps = workout?.workout_doc?.steps || workout?.steps || [];
  const totals = Array.isArray(steps)
    ? steps.reduce((total, step) => {
        const estimate = estimateStep(step, sport, paces);
        total.seconds += estimate.seconds;
        total.miles += estimate.miles;
        return total;
      }, { seconds: 0, miles: 0 })
    : { seconds: 0, miles: 0 };

  return {
    seconds: totals.seconds || asNumber(workout?.duration),
    miles: totals.miles || asNumber(workout?.distanceMiles ?? workout?.distance_miles),
  };
};

const formatDuration = (seconds) => {
  if (!seconds) return '—';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes} min`;
};

const formatMiles = (miles) => miles > 0 ? miles.toFixed(1) : '—';

const normalizeFolderId = (workout) =>
  String(workout?.folderId ?? workout?.folder_id ?? '');

const TRAINING_PLANS_API_URL =
  import.meta.env.VITE_API_TRAININGPLANS_URL
  || 'https://amullinfit--e90bd68ec43911f188781607ee4eb77e.web.val.run';

async function requestTrainingPlans(action, { method = 'GET', id, plan } = {}) {
  const url = new URL(TRAINING_PLANS_API_URL);
  url.searchParams.set('action', action);
  if (id != null) url.searchParams.set('id', String(id));

  const response = await fetch(url, {
    method,
    headers: plan ? { 'Content-Type': 'application/json' } : undefined,
    body: plan ? JSON.stringify({ action, plan }) : undefined,
  });
  let result = {};
  try {
    result = await response.json();
  } catch {
    // Report a useful HTTP error below when the val returns a non-JSON body.
  }
  if (!response.ok) {
    throw new Error(result?.error || `Training plan request failed (HTTP ${response.status}).`);
  }
  return result;
}

function planFromIntervals(folder) {
  const workouts = Array.isArray(folder?.children) ? folder.children : [];
  const lastDay = workouts.reduce((maxDay, workout) => {
    const day = workout?.day == null ? 0 : Number(workout.day);
    return Number.isFinite(day) ? Math.max(maxDay, day) : maxDay;
  }, 0);
  const weekCount = Math.max(
    1,
    Number(folder?.duration_weeks) || 0,
    Math.ceil((lastDay + 1) / 7),
  );
  const weeks = makeEmptyWeeks(weekCount);

  workouts.forEach((workout, index) => {
    const rawDay = workout?.day == null ? 0 : Number(workout.day);
    const dayNumber = Number.isFinite(rawDay) ? Math.max(0, Math.floor(rawDay)) : 0;
    const weekIndex = Math.floor(dayNumber / 7);
    const dayIndex = dayNumber % 7;
    weeks[weekIndex].days[dayIndex].workouts.push({
      entryId: String(workout?.id ?? `entry-${index}-${Date.now()}`),
      workout,
    });
  });

  return {
    ...folder,
    id: String(folder?.id ?? ''),
    name: folder?.name || 'Untitled Plan',
    weeks,
  };
}

const clonePlan = (plan, name = plan.name) => ({
  ...plan,
  id: null,
  name,
  weeks: plan.weeks.map((week, weekIndex) => ({
    ...week,
    weekNumber: weekIndex + 1,
    days: week.days.map((day) => ({
      ...day,
      workouts: day.workouts.map((entry) => ({
        ...entry,
        entryId: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        workout: { ...entry.workout },
      })),
    })),
  })),
});

export default function TrainingPlanEditor() {
  const { paces } = usePaces();
  const isMobile = useIsMobile(768);
  const [zoomWorkout, setZoomWorkout] = useState(null);
  const [folders, setFolders] = useState([]);
  const [libraryWorkouts, setLibraryWorkouts] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState(() => makePlan());
  const [savedPlans, setSavedPlans] = useState([]);
  const [selectedSavedPlanId, setSelectedSavedPlanId] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [draggedWorkout, setDraggedWorkout] = useState(null);
  const [draggedPayload, setDraggedPayload] = useState(null);
  const draggedPayloadRef = useRef(null);
  const [activeDropTarget, setActiveDropTarget] = useState('');
  const [visibleWeekNumbers, setVisibleWeekNumbers] = useState([]);
  const [summaryScrollState, setSummaryScrollState] = useState({ left: false, right: false, visibleWeeks: [] });
  const weekGridScrollRef = useRef(null);
  const mileageChartRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState('Loading training plans from Intervals.icu…');

  useEffect(() => {
    if (!zoomWorkout) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setZoomWorkout(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [zoomWorkout]);

  useEffect(() => {
    let active = true;
    const loadLibrary = async () => {
      setLoadingLibrary(true);
      setLoadError('');
      try {
        const result = await fetchWorkoutsApi();
        if (!active) return;
        const nextFolders = Array.isArray(result?.folders) ? result.folders : [];
        const nextWorkouts = Array.isArray(result?.workouts) ? result.workouts : [];
        setFolders(nextFolders);
        setLibraryWorkouts(nextWorkouts);
        if (nextFolders.length) setSelectedFolderId(String(nextFolders[0].id ?? ''));
      } catch (error) {
        if (active) setLoadError(error?.message || 'Could not load workout folders.');
      } finally {
        if (active) setLoadingLibrary(false);
      }
    };
    loadLibrary();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      setLoadingPlans(true);
      try {
        const result = await requestTrainingPlans('list_plans');
        if (active) {
          const plans = Array.isArray(result?.plans) ? result.plans : [];
          setSavedPlans(plans);
          setStatusMessage(plans.length
            ? 'Loaded ' + plans.length + ' plan' + (plans.length === 1 ? '' : 's') + ' from Intervals.icu.'
            : 'Connected to Intervals.icu. Save a new plan to get started.');
        }
      } catch (error) {
        if (active) setStatusMessage(error?.message || 'Could not load plans from Intervals.icu.');
      } finally {
        if (active) setLoadingPlans(false);
      }
    };
    loadPlans();
    return () => { active = false; };
  }, []);

  const selectedFolder = folders.find((folder) => String(folder.id ?? '') === selectedFolderId);
  const visibleWorkouts = useMemo(() => {
    if (!selectedFolderId) return [];
    return libraryWorkouts.filter((workout) => normalizeFolderId(workout) === selectedFolderId);
  }, [libraryWorkouts, selectedFolderId]);

  const weekTotals = useMemo(() => plan.weeks.map((week) => {
    const totals = week.days.reduce((sum, day) => {
      day.workouts.forEach((entry) => {
        const estimate = estimateWorkout(entry.workout, paces);
        sum.seconds += estimate.seconds;
        sum.miles += estimate.miles;
      });
      return sum;
    }, { seconds: 0, miles: 0 });
    return { weekNumber: week.weekNumber, ...totals };
  }), [plan.weeks, paces]);

  useEffect(() => {
    const root = weekGridScrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      setVisibleWeekNumbers((current) => {
        const next = new Set(current);
        entries.forEach((entry) => {
          const weekNumber = Number(entry.target.getAttribute('data-week-number'));
          if (!weekNumber) return;
          if (entry.isIntersecting) next.add(weekNumber);
          else next.delete(weekNumber);
        });
        return [...next].sort((a, b) => a - b);
      });
    }, { root, threshold: 0.01 });

    root.querySelectorAll('[data-week-number]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [plan.weeks.length]);

  const updateSummaryScrollState = () => {
    const chart = mileageChartRef.current;
    if (!chart) return;
    const canScrollLeft = chart.scrollLeft > 1;
    const canScrollRight = chart.scrollLeft + chart.clientWidth < chart.scrollWidth - 1;
    const chartBounds = chart.getBoundingClientRect();
    const visibleWeeks = [...chart.querySelectorAll('[data-summary-week-number]')]
      .filter((column) => {
        const bounds = column.getBoundingClientRect();
        return bounds.right > chartBounds.left + 1 && bounds.left < chartBounds.right - 1;
      })
      .map((column) => Number(column.getAttribute('data-summary-week-number')))
      .filter(Number.isFinite);
    setSummaryScrollState((current) => (
      current.left === canScrollLeft
      && current.right === canScrollRight
      && current.visibleWeeks.length === visibleWeeks.length
      && current.visibleWeeks.every((week, index) => week === visibleWeeks[index])
        ? current
        : { left: canScrollLeft, right: canScrollRight, visibleWeeks }
    ));
  };

  useEffect(() => {
    const chart = mileageChartRef.current;
    if (!chart) return undefined;
    updateSummaryScrollState();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateSummaryScrollState);
    resizeObserver?.observe(chart);
    if (chart.firstElementChild) resizeObserver?.observe(chart.firstElementChild);
    return () => resizeObserver?.disconnect();
  }, [weekTotals.length]);

  const scrollMileageChart = (direction) => {
    const chart = mileageChartRef.current;
    if (!chart) return;
    chart.scrollBy({ left: direction * Math.max(120, chart.clientWidth * 0.8), behavior: 'smooth' });
  };

  const updateDay = (weekIndex, dayIndex, updater) => {
    setPlan((current) => ({
      ...current,
      weeks: current.weeks.map((week, wi) => wi !== weekIndex ? week : ({
        ...week,
        days: week.days.map((day, di) => di !== dayIndex ? day : updater(day)),
      })),
    }));
  };

  const addWorkoutToDay = (workout, weekIndex, dayIndex, moveEntry = null) => {
    if (!workout) return;
    updateDay(weekIndex, dayIndex, (day) => ({
      ...day,
      workouts: [...day.workouts, {
        entryId: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        workout: { ...workout },
      }],
    }));

    if (moveEntry) {
      setPlan((current) => ({
        ...current,
        weeks: current.weeks.map((week, wi) => ({
          ...week,
          days: week.days.map((day, di) => ({
            ...day,
            workouts: wi === moveEntry.weekIndex && di === moveEntry.dayIndex
              ? day.workouts.filter((entry) => entry.entryId !== moveEntry.entryId)
              : day.workouts,
          })),
        })),
      }));
    }
  };

  const handleDrop = (event, targetWeekIndex, targetDayIndex) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveDropTarget('');

    // Use both a custom MIME type and text/plain: some browsers only preserve
    // the plain-text payload during native drag-and-drop.
    const raw = event.dataTransfer.getData('application/x-training-plan-workout')
      || event.dataTransfer.getData('text/plain');

    try {
      // Some browsers suppress custom drag payloads for nested/complex cards.
      // The in-memory drag state is a fallback so a valid drop still works.
      const parsedPayload = raw ? JSON.parse(raw) : null;
      // A ref is written synchronously in dragstart, avoiding state timing and
      // browser MIME-payload differences when moving a scheduled workout.
      const payload = draggedPayloadRef.current || parsedPayload || draggedPayload;
      if (!payload) {
        setStatusMessage('Could not identify the dragged workout. Please try again.');
        return;
      }
      if (payload.source === 'library' && !raw && draggedWorkout) {
        addWorkoutToDay(draggedWorkout, targetWeekIndex, targetDayIndex);
        return;
      }

      if (payload.source === 'plan') {
        // Find the source by its unique entry ID rather than trusting stored
        // grid indexes. This survives re-renders and avoids losing a move if
        // a payload's week/day coordinates are stale.
        setPlan((current) => {
          let moving = null;
          let sourceWeekIndex = -1;
          let sourceDayIndex = -1;

          current.weeks.some((week, wi) => week.days.some((day, di) => {
            const match = day.workouts.find((entry) => entry.entryId === payload.entryId);
            if (!match) return false;
            moving = match;
            sourceWeekIndex = wi;
            sourceDayIndex = di;
            return true;
          }));

          if (!moving) {
            setStatusMessage('Could not find that scheduled workout to move. Please try again.');
            return current;
          }
          if (sourceWeekIndex === targetWeekIndex && sourceDayIndex === targetDayIndex) return current;

          return {
            ...current,
            weeks: current.weeks.map((week, wi) => ({
              ...week,
              days: week.days.map((day, di) => {
                const withoutMoving = day.workouts.filter((entry) => entry.entryId !== payload.entryId);
                return wi === targetWeekIndex && di === targetDayIndex
                  ? { ...day, workouts: [...withoutMoving, moving] }
                  : withoutMoving.length === day.workouts.length
                    ? day
                    : { ...day, workouts: withoutMoving };
              }),
            })),
          };
        });
      } else if (payload.source === 'library') {
        // Prefer the matching library record, but fall back to the exact card
        // being dragged if an API uses a nonstandard/missing id field.
        const workout = libraryWorkouts.find((item) => String(item.id ?? item._id) === String(payload.workoutId))
          || draggedWorkout;
        if (workout) addWorkoutToDay(workout, targetWeekIndex, targetDayIndex);
        else setStatusMessage('Could not identify that library workout. Please try again.');
      }
    } catch {
      setStatusMessage('That workout could not be added. Please try dragging it again.');
    } finally {
      setDraggedWorkout(null);
      setDraggedPayload(null);
      draggedPayloadRef.current = null;
      setActiveDropTarget('');
    }
  };

  const removeWorkout = (weekIndex, dayIndex, entryId) => {
    updateDay(weekIndex, dayIndex, (day) => ({
      ...day,
      workouts: day.workouts.filter((entry) => entry.entryId !== entryId),
    }));
  };

  const refreshSavedPlans = async (preferredId = '') => {
    const result = await requestTrainingPlans('list_plans');
    const nextPlans = Array.isArray(result?.plans) ? result.plans : [];
    setSavedPlans(nextPlans);
    const nextId = String(preferredId || '');
    setSelectedSavedPlanId(nextPlans.some((item) => String(item.id) === nextId) ? nextId : '');
    return nextPlans;
  };

  const handleNewPlan = () => {
    setPlan(makePlan());
    setSelectedSavedPlanId('');
    setStatusMessage('New plan draft. Save it to create a plan in Intervals.icu.');
  };

  const handleSavePlan = async () => {
    const isExistingPlan = /^\d+$/.test(String(plan.id || ''));
    setSavingPlan(true);
    setStatusMessage(isExistingPlan ? 'Saving changes to Intervals.icu…' : 'Creating plan in Intervals.icu…');
    try {
      const result = await requestTrainingPlans(isExistingPlan ? 'update_plan' : 'create_plan', {
        method: isExistingPlan ? 'PUT' : 'POST',
        plan,
      });
      const savedId = String(result?.plan?.id ?? plan.id ?? '');
      if (!savedId) throw new Error('Intervals.icu did not return a plan ID.');
      const refreshed = await requestTrainingPlans('get_plan', { id: savedId });
      const savedPlan = planFromIntervals(refreshed.plan);
      setPlan(savedPlan);
      await refreshSavedPlans(savedId);
      setStatusMessage(`Saved “${savedPlan.name}” to Intervals.icu.`);
    } catch (error) {
      setStatusMessage(error?.message || 'Could not save the plan to Intervals.icu.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleOpenPlan = async () => {
    if (!selectedSavedPlanId) {
      setStatusMessage('Choose a plan from Intervals.icu to open.');
      return;
    }
    setSavingPlan(true);
    setStatusMessage('Opening plan from Intervals.icu…');
    try {
      const result = await requestTrainingPlans('get_plan', { id: selectedSavedPlanId });
      const openedPlan = planFromIntervals(result.plan);
      setPlan(openedPlan);
      setSelectedSavedPlanId(openedPlan.id);
      setStatusMessage(`Opened “${openedPlan.name}” from Intervals.icu.`);
    } catch (error) {
      setStatusMessage(error?.message || 'Could not open that plan from Intervals.icu.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCopyPlan = async () => {
    const copy = clonePlan(plan, `${plan.name} (Copy)`);
    setSavingPlan(true);
    setStatusMessage('Copying plan to Intervals.icu…');
    try {
      const result = await requestTrainingPlans('copy_plan', {
        method: 'POST',
        plan: copy,
      });
      const copiedId = String(result?.plan?.id ?? '');
      if (!copiedId) throw new Error('Intervals.icu did not return the copied plan ID.');
      const refreshed = await requestTrainingPlans('get_plan', { id: copiedId });
      const copiedPlan = planFromIntervals(refreshed.plan);
      setPlan(copiedPlan);
      await refreshSavedPlans(copiedId);
      setStatusMessage(`Created “${copiedPlan.name}” in Intervals.icu.`);
    } catch (error) {
      setStatusMessage(error?.message || 'Could not copy the plan to Intervals.icu.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleRenamePlan = (event) => {
    const name = event.target.value;
    setPlan((current) => ({ ...current, name }));
  };

  const addFourWeeks = () => {
    setPlan((current) => ({
      ...current,
      weeks: [
        ...current.weeks,
        ...makeEmptyWeeks(4).map((week, index) => ({
          ...week,
          weekNumber: current.weeks.length + index + 1,
        })),
      ],
    }));
    setStatusMessage('Added four more weeks.');
  };

  const totalMiles = weekTotals.reduce((sum, week) => sum + week.miles, 0);
  const totalSeconds = weekTotals.reduce((sum, week) => sum + week.seconds, 0);

  return (
    <div className="training-plan-editor">
      <div className="tpe-header">
        <div className="tpe-title-block">
          <div className="tpe-eyebrow">PLAN DESIGNER</div>
          <input
            className="tpe-plan-name"
            aria-label="Training plan name"
            value={plan.name}
            onChange={handleRenamePlan}
            placeholder="Training plan name"
          />
          <div className="tpe-subtitle">Drag workouts from the library onto any day, or drag scheduled workouts to move them.</div>
        </div>
        <div className="tpe-plan-actions">
          <button type="button" onClick={handleNewPlan}>New Plan</button>
          <select
            aria-label="Plans in Intervals.icu"
            value={selectedSavedPlanId}
            onChange={(event) => setSelectedSavedPlanId(event.target.value)}
            disabled={loadingPlans || savingPlan}
          >
            <option value="">{loadingPlans ? 'Loading plans…' : 'Choose a plan…'}</option>
            {savedPlans.map((saved) => <option key={saved.id} value={String(saved.id)}>{saved.name || 'Untitled Plan'}</option>)}
          </select>
          <button type="button" onClick={handleOpenPlan} disabled={savingPlan || !selectedSavedPlanId}>Open</button>
          <button type="button" onClick={handleSavePlan} disabled={savingPlan}>{savingPlan ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={handleCopyPlan} disabled={savingPlan}>Copy</button>
        </div>
      </div>

      <div className="tpe-status" role="status">{statusMessage}</div>
      {loadError && <div className="tpe-error" role="alert">Workout library error: {loadError}</div>}

      <div className={`tpe-workspace ${libraryCollapsed ? 'tpe-library-collapsed' : ''}`}>
        <aside className="tpe-library">
          <div className="tpe-panel-heading">
            {!libraryCollapsed && <div><strong>Workout Library</strong><span>{visibleWorkouts.length} workouts</span></div>}
            <button type="button" className="tpe-collapse-btn" onClick={() => setLibraryCollapsed((value) => !value)} aria-label={libraryCollapsed ? 'Expand workout library' : 'Collapse workout library'} title={libraryCollapsed ? 'Expand library' : 'Collapse library'}>
              {libraryCollapsed ? '›' : '‹'}
            </button>
          </div>
          {!libraryCollapsed && (
            <>
              <label className="tpe-field-label" htmlFor="tpe-folder">Workout folder</label>
              <select id="tpe-folder" value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)}>
                <option value="">Choose a folder…</option>
                {folders.map((folder) => <option key={folder.id} value={String(folder.id)}>{folder.name || folder.title || 'Untitled folder'}</option>)}
              </select>
              {loadingLibrary ? <div className="tpe-empty">Loading workout folders…</div> : (
                <div className="tpe-workout-list">
                  {!selectedFolderId && <div className="tpe-empty">Choose a folder to browse its workouts.</div>}
                  {selectedFolderId && visibleWorkouts.length === 0 && <div className="tpe-empty">No workouts found in {selectedFolder?.name || 'this folder'}.</div>}
                  {visibleWorkouts.map((workout) => {
                    const estimate = estimateWorkout(workout, paces);
                    return (
                      <div
                        className="tpe-library-workout"
                        key={workout.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Zoom in on ${workout.name || workout.title || 'workout'}`}
                        onClick={() => setZoomWorkout(workout)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setZoomWorkout(workout);
                          }
                        }}
                        draggable
                        onDragStart={(event) => {
                          setDraggedWorkout(workout);
                          setActiveDropTarget('');
                          event.dataTransfer.effectAllowed = 'copy';
                          const dragPayload = { source: 'library', workoutId: workout.id };
                          draggedPayloadRef.current = dragPayload;
                          setDraggedPayload(dragPayload);
                          const payload = JSON.stringify(dragPayload);
                          event.dataTransfer.setData('application/x-training-plan-workout', payload);
                          event.dataTransfer.setData('text/plain', payload);
                        }}
                        title="Click to zoom or drag this workout to a day in the plan"
                      >
                        <div className="tpe-workout-title-row">
                          <strong>{workout.name || workout.title || 'Untitled workout'}</strong>
                          <span>{formatDuration(estimate.seconds)}</span>
                        </div>
                        <WorkoutChart
                          workout={workout}
                          chartHeight="42px"
                          showWorkoutName={false}
                          showThresholdPace={false}
                          showYAxis={false}
                          showYAxisLabels={false}
                          showLegend={false}
                          minimalXAxis={true}
                          showHoverDetails={false}
                        />
                        <div className="tpe-workout-card-footer">
                          <div className="tpe-workout-meta">{formatMiles(estimate.miles)} mi est. · {workout.type || workout.sport || 'Workout'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </aside>

        <div className="tpe-plan-area">
        <section className="tpe-summary-section">
          <div className="tpe-summary-fixed-totals">
            <h2>Plan Totals</h2>
            <div><strong aria-label={`Plan time: ${formatDuration(totalSeconds)}`}>{formatDuration(totalSeconds)}</strong></div>
            <div><strong aria-label={`Plan distance: ${formatMiles(totalMiles)} miles`}>{formatMiles(totalMiles)} mi</strong></div>
          </div>
          <div className="tpe-mileage-chart-wrap">
            <button
              type="button"
              className={`tpe-mileage-scroll-arrow tpe-mileage-scroll-arrow-left${visibleWeekNumbers.some((week) => summaryScrollState.visibleWeeks.length && week < Math.min(...summaryScrollState.visibleWeeks)) ? ' has-calendar-weeks' : ''}`}
              aria-label="Scroll to earlier plan weeks"
              disabled={!summaryScrollState.left}
              aria-hidden={!summaryScrollState.left}
              tabIndex={summaryScrollState.left ? 0 : -1}
              onClick={() => scrollMileageChart(-1)}
            >‹</button>
            <div
              className="tpe-mileage-chart"
              ref={mileageChartRef}
              onScroll={updateSummaryScrollState}
              style={{ height: '96px', paddingBottom: '14px' }}
              role="img"
              aria-label="Bar chart comparing estimated planned miles by week"
            >
              {weekTotals.map((week) => {
                const maxMiles = Math.max(1, ...weekTotals.map((item) => item.miles));
                const height = week.miles > 0 ? Math.max(4, (week.miles / maxMiles) * 100) : 2;
                return (
                  <div className="tpe-mileage-bar-column" data-summary-week-number={week.weekNumber} key={week.weekNumber}>
                    <div className="tpe-mileage-week-label"><span className={visibleWeekNumbers.includes(week.weekNumber) ? 'is-visible-week' : ''}>Week {week.weekNumber}</span></div>
                    <div className="tpe-mileage-bar-track"><div className="tpe-mileage-bar" style={{ height: `${height}%` }} /></div>
                    <strong>{formatMiles(week.miles)} mi</strong>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className={`tpe-mileage-scroll-arrow tpe-mileage-scroll-arrow-right${visibleWeekNumbers.some((week) => summaryScrollState.visibleWeeks.length && week > Math.max(...summaryScrollState.visibleWeeks)) ? ' has-calendar-weeks' : ''}`}
              aria-label="Scroll to later plan weeks"
              disabled={!summaryScrollState.right}
              aria-hidden={!summaryScrollState.right}
              tabIndex={summaryScrollState.right ? 0 : -1}
              onClick={() => scrollMileageChart(1)}
            >›</button>
          </div>
        </section>
        <section className="tpe-plan-grid-section">
          <div className="tpe-grid-heading">
            <div><h2>Training Schedule</h2><span>{plan.weeks.length} weeks · Monday–Sunday</span></div>
            <button type="button" className="tpe-add-weeks" onClick={addFourWeeks}>+ Add 4 Weeks</button>
          </div>
          <div className="tpe-week-grid-scroll" ref={weekGridScrollRef}>
            <div className="tpe-week-grid">
              <div className="tpe-grid-corner">Week</div>
              {WEEKDAY_SHORT.map((day) => <div className="tpe-day-heading" key={day}>{day}</div>)}
              {plan.weeks.map((week, weekIndex) => {
                const totals = weekTotals[weekIndex] || { seconds: 0, miles: 0 };
                return (
                  <React.Fragment key={week.weekNumber}>
                    <div className="tpe-week-number" data-week-number={week.weekNumber}>
                      <span>Week</span><strong>{week.weekNumber}</strong>
                      <div className="tpe-week-total-inline"><strong>{formatDuration(totals.seconds)}</strong><span>{formatMiles(totals.miles)} mi</span></div>
                    </div>
                    {week.days.map((day, dayIndex) => (
                      <div
                        key={day.day}
                        className={`tpe-day-dropzone ${day.workouts.length ? 'has-workouts' : ''} ${activeDropTarget === `${weekIndex}-${dayIndex}` ? 'is-drag-target' : ''}`}
                        onDragEnter={(event) => { event.preventDefault(); setActiveDropTarget(`${weekIndex}-${dayIndex}`); }}
                        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = (draggedPayloadRef.current || draggedPayload)?.source === 'library' ? 'copy' : 'move'; setActiveDropTarget(`${weekIndex}-${dayIndex}`); }}
                        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveDropTarget(''); }}
                        onDrop={(event) => handleDrop(event, weekIndex, dayIndex)}
                      >
                        <div className="tpe-day-fullname">{day.day}</div>
                        {day.workouts.length === 0 ? <div className="tpe-drop-hint">Drop workout here</div> : (
                          <div className="tpe-day-workouts">
                            {day.workouts.map((entry) => {
                              const estimate = estimateWorkout(entry.workout, paces);
                              return (
                                <div
                                  className="tpe-planned-workout"
                                  key={entry.entryId}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Zoom in on ${entry.workout.name || entry.workout.title || 'workout'}`}
                                  onClick={() => setZoomWorkout(entry.workout)}
                                  onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      setZoomWorkout(entry.workout);
                                    }
                                  }}
                                  draggable
                                  onDragStart={(event) => {
                                    setDraggedWorkout(entry.workout);
                                    event.dataTransfer.effectAllowed = 'move';
                                    const dragPayload = {
                                      source: 'plan',
                                      workoutId: entry.workout.id,
                                      entryId: entry.entryId,
                                      weekIndex,
                                      dayIndex,
                                    };
                                    draggedPayloadRef.current = dragPayload;
                                    setDraggedPayload(dragPayload);
                                    const payload = JSON.stringify(dragPayload);
                                    event.dataTransfer.setData('application/x-training-plan-workout', payload);
                                    event.dataTransfer.setData('text/plain', payload);
                                  }}
                                >
                                  <div className="tpe-planned-workout-heading">
                                    <strong>{entry.workout.name || entry.workout.title || 'Workout'}</strong>
                                    <button type="button" aria-label={`Remove ${entry.workout.name || 'workout'} from week ${week.weekNumber} ${day.day}`} onClick={(event) => { event.stopPropagation(); removeWorkout(weekIndex, dayIndex, entry.entryId); }}>×</button>
                                  </div>
                                  <WorkoutChart
                                    workout={entry.workout}
                                    chartHeight="34px"
                                    showWorkoutName={false}
                                    showThresholdPace={false}
                                    showYAxis={false}
                                    showYAxisLabels={false}
                                    showLegend={false}
                                    minimalXAxis={true}
                                    showHoverDetails={false}
                                  />
                                  <div className="tpe-planned-meta">{formatDuration(estimate.seconds)} · {formatMiles(estimate.miles)} mi</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="tpe-grid-footnote">Drag workouts from the library onto a day to add them, or drag scheduled workouts to another day to move them.</div>
        </section>
        </div>
      </div>
      {zoomWorkout && (
        <WorkoutZoomModal
          workouts={[zoomWorkout]}
          onClose={() => setZoomWorkout(null)}
          sportSettings={[]}
          paces={paces}
          isMobile={isMobile}
          readOnly
        />
      )}
    </div>
  );
}
