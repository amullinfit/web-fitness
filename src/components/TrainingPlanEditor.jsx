import React, { useEffect, useMemo, useRef, useState } from 'react';
import WorkoutChart from './WorkoutChart';
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
  id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  weeks: makeEmptyWeeks(weekCount),
});

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const paceSecondsPerMile = (step) => {
  const pace = step?.pace;
  if (!pace) return 0;
  const value = asNumber(pace.value ?? pace);
  if (!value) return 0;
  const units = String(pace.units || '').toLowerCase();
  if (units.includes('sec')) return value;
  if (units.includes('min')) return value * 60;
  return 0;
};

// Estimate duration and mileage from the workout document. Repeat blocks are
// multiplied by their iteration count; distance-based steps use miles as
// represented by the existing Workout Builder data model.
const estimateStep = (step, sport = 'Run') => {
  if (!step || typeof step !== 'object') return { seconds: 0, miles: 0 };

  if (Array.isArray(step.steps)) {
    const childTotals = step.steps.reduce((total, child) => {
      const estimate = estimateStep(child, sport);
      total.seconds += estimate.seconds;
      total.miles += estimate.miles;
      return total;
    }, { seconds: 0, miles: 0 });
    const repetitions = Math.max(1, asNumber(step.iterations ?? step.reps) || 1);
    return { seconds: childTotals.seconds * repetitions, miles: childTotals.miles * repetitions };
  }

  const duration = asNumber(step.duration ?? step.duration_seconds);
  const distance = asNumber(step.distance ?? step.distanceMiles ?? step.distance_miles);
  const pace = paceSecondsPerMile(step);
  const isRun = /run|running/i.test(String(sport || 'Run'));

  if (duration) {
    return { seconds: duration, miles: pace && isRun ? duration / pace : 0 };
  }
  if (distance) {
    return { seconds: pace ? distance * pace : 0, miles: distance };
  }
  return { seconds: 0, miles: 0 };
};

const estimateWorkout = (workout) => {
  const sport = workout?.type || workout?.sport || workout?.workout_doc?.type || 'Run';
  const steps = workout?.workout_doc?.steps || workout?.steps || [];
  const totals = Array.isArray(steps)
    ? steps.reduce((total, step) => {
        const estimate = estimateStep(step, sport);
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

const clonePlan = (plan, name = plan.name) => ({
  ...plan,
  id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
  const [folders, setFolders] = useState([]);
  const [libraryWorkouts, setLibraryWorkouts] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState(() => makePlan());
  const [savedPlans, setSavedPlans] = useState([]);
  const [selectedSavedPlanId, setSelectedSavedPlanId] = useState('');
  const [draggedWorkout, setDraggedWorkout] = useState(null);
  const [draggedPayload, setDraggedPayload] = useState(null);
  const draggedPayloadRef = useRef(null);
  const [activeDropTarget, setActiveDropTarget] = useState('');
  const [visibleWeekNumbers, setVisibleWeekNumbers] = useState([]);
  const weekGridScrollRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState('Plan editing is local for now. Save/open actions do not call Val Town yet.');

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

  const selectedFolder = folders.find((folder) => String(folder.id ?? '') === selectedFolderId);
  const visibleWorkouts = useMemo(() => {
    if (!selectedFolderId) return [];
    return libraryWorkouts.filter((workout) => normalizeFolderId(workout) === selectedFolderId);
  }, [libraryWorkouts, selectedFolderId]);

  const weekTotals = useMemo(() => plan.weeks.map((week) => {
    const totals = week.days.reduce((sum, day) => {
      day.workouts.forEach((entry) => {
        const estimate = estimateWorkout(entry.workout);
        sum.seconds += estimate.seconds;
        sum.miles += estimate.miles;
      });
      return sum;
    }, { seconds: 0, miles: 0 });
    return { weekNumber: week.weekNumber, ...totals };
  }), [plan.weeks]);

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

  const handleNewPlan = () => {
    setPlan(makePlan());
    setSelectedSavedPlanId('');
    setStatusMessage('New blank plan created. It has not been saved to a backend.');
  };

  const handleSavePlan = () => {
    const snapshot = clonePlan(plan);
    setSavedPlans((current) => {
      const existingIndex = current.findIndex((item) => item.id === plan.id);
      if (existingIndex < 0) return [...current, { ...snapshot, id: plan.id }];
      return current.map((item) => item.id === plan.id ? { ...snapshot, id: plan.id } : item);
    });
    setSelectedSavedPlanId(plan.id);
    setStatusMessage('Plan saved in this page session only. Val Town persistence is not connected yet.');
  };

  const handleOpenPlan = () => {
    const found = savedPlans.find((item) => item.id === selectedSavedPlanId);
    if (!found) {
      setStatusMessage('Save a plan in this session first, or connect the future Val Town plan API.');
      return;
    }
    setPlan(clonePlan(found, found.name));
    setPlan((current) => ({ ...current, id: found.id, name: found.name }));
    setStatusMessage(`Opened “${found.name}” from this page session.`);
  };

  const handleCopyPlan = () => {
    const copy = clonePlan(plan, `${plan.name} (Copy)`);
    setPlan(copy);
    setSelectedSavedPlanId('');
    setStatusMessage('Plan copied in the editor. Save it to keep it in this page session.');
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
            aria-label="Saved plans in this session"
            value={selectedSavedPlanId}
            onChange={(event) => setSelectedSavedPlanId(event.target.value)}
          >
            <option value="">Choose saved plan…</option>
            {savedPlans.map((saved) => <option key={saved.id} value={saved.id}>{saved.name || 'Untitled Plan'}</option>)}
          </select>
          <button type="button" onClick={handleOpenPlan}>Open</button>
          <button type="button" onClick={handleSavePlan}>Save</button>
          <button type="button" onClick={handleCopyPlan}>Copy</button>
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
                    const estimate = estimateWorkout(workout);
                    return (
                      <div
                        className="tpe-library-workout"
                        key={workout.id}
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
                        title="Drag this workout to a day in the plan"
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
            <h2>Weekly Summary</h2>
            <div><span>Plan distance</span><strong>{formatMiles(totalMiles)} mi</strong></div>
            <div><span>Plan time</span><strong>{formatDuration(totalSeconds)}</strong></div>
          </div>
          <div className="tpe-mileage-chart" role="img" aria-label="Bar chart comparing estimated planned miles by week">
            {weekTotals.map((week) => {
              const maxMiles = Math.max(1, ...weekTotals.map((item) => item.miles));
              const height = week.miles > 0 ? Math.max(4, (week.miles / maxMiles) * 100) : 2;
              return (
                <div className="tpe-mileage-bar-column" key={week.weekNumber}>
                  <div className="tpe-mileage-week-label"><span className={visibleWeekNumbers.includes(week.weekNumber) ? 'is-visible-week' : ''}>Week {week.weekNumber}</span></div>
                  <div className="tpe-mileage-bar-track"><div className="tpe-mileage-bar" style={{ height: `${height}%` }} /></div>
                  <strong>{formatMiles(week.miles)} mi</strong>
                </div>
              );
            })}
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
                              const estimate = estimateWorkout(entry.workout);
                              return (
                                <div
                                  className="tpe-planned-workout"
                                  key={entry.entryId}
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
                                    <button type="button" aria-label={`Remove ${entry.workout.name || 'workout'} from week ${week.weekNumber} ${day.day}`} onClick={() => removeWorkout(weekIndex, dayIndex, entry.entryId)}>×</button>
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
    </div>
  );
}
