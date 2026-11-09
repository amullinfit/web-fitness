//
// MONTHLYVIEW.JSX
//
import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import { CalendarWorkoutActions } from '../modals/CalendarWorkoutActions.jsx';
import { useReadOnly } from '../context/ReadOnlyContext.jsx';
import WorkoutTextSection from '../utils/WorkoutTextSection';
import '../CSS/MonthlyView.css';
import { usePaces } from '../utils/PacesContext.jsx'; 

import {
  useIsMobile,
  getSportCategory,
  getThresholdPaceForSport,
  getLocalDateString,
  isWorkoutCompleted,
  getMondayOfWeek,
  getFourWeeksDates,
  metersToMilesNum,
  safeStringLower
} from '../utils/MonthlyViewHelpers.jsx';
import { useActivityFeed } from '../utils/useActivityFeed.js';
import { activityFeedCache } from '../utils/activityFeedCache.js';

import {
  WeeklyFrameChart,
  CollapsedWeeklySummary
} from '../utils/MonthlyViewWeeklyChart.jsx';

import {
  WorkoutZoomModal
} from '../modals/MonthlyModal_ZoomWorkout';

const VAL_WORKOUTS_URL = "/api/val-workouts";
const HISTORICAL_URL = "/api/val-historical";

export default function MonthlyView() {
  const { paces } = usePaces();
  const readOnly = useReadOnly();
  const [calendarAction, setCalendarAction] = useState(null);
  const [calendarMenu, setCalendarMenu] = useState(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [calendarMessage, setCalendarMessage] = useState('');
  const [dragWorkout, setDragWorkout] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [zoomReturn, setZoomReturn] = useState(false);
  const openCalendarAction = (action, date, workout = null) => {
    setCalendarMenu(null);
    setCalendarMessage('');
    setCalendarAction({ action, date, workout });
  };
  const confirmCalendarAction = async (selection) => {
    if (!['add', 'move', 'remove'].includes(selection.action)) return;
    setCalendarBusy(true);
    setCalendarMessage('');
    try {
      const response = await fetch('/api/calendar-workout-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selection.action === 'add' ? 'add_workout' : selection.action === 'move' ? 'move_workout' : 'remove_workout',
          confirm: true,
          date: selection.date,
          original_date: selection.originalDate,
          workout_id: selection.action === 'add' ? (selection.workout?.id ?? selection.workout?._id) : undefined,
          event_id: selection.action !== 'add' ? (selection.workout?.id ?? selection.workout?._id) : undefined
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not update workout.');
      activityFeedCache.invalidate(selection.date, selection.date);
      if (selection.originalDate && selection.originalDate !== selection.date) activityFeedCache.invalidate(selection.originalDate, selection.originalDate);
      setCalendarAction(null);
      setZoomReturn(false);
      if (zoomReturn) setZoomWorkouts(null);
      setCalendarRefresh((value) => value + 1);
    } catch (error) {
      setCalendarMessage(error.message || 'Unable to update workout.');
    } finally {
      setCalendarBusy(false);
    }
  };
  const renderCalendarOptions = (date, workout = null) => {
    if (readOnly || date < getLocalDateString(new Date()) || (workout && isWorkoutCompleted(workout))) return null;
    const key = workout ? 'workout-' + date + '-' + (workout.id ?? workout._id) : 'day-' + date;
    return <div className="monthly-calendar-options" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="monthly-calendar-menu-trigger" title="Workout options" aria-label="Workout options" aria-expanded={calendarMenu === key} onClick={() => setCalendarMenu((current) => current === key ? null : key)}>☰</button>
      {calendarMenu === key && <div className="monthly-calendar-options-menu">
        <button type="button" onClick={() => openCalendarAction('add', date)}>➕ Add</button>
        {workout && <>
          <button type="button" onClick={() => openCalendarAction('move', date, workout)}>📅 Move</button>
          <button type="button" onClick={() => openCalendarAction('remove', date, workout)}>🗑️ Remove</button>
        </>}
      </div>}
    </div>;
  };


  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getMondayOfWeek(new Date()));
  const [errorMessage, setErrorMessage] = useState(null);

  const [activeFilters, setActiveFilters] = useState(['Run']);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState(['Run']);

  // State for Collapsible Weekly Chart Area
  const [isWeeklyChartCollapsed, setIsWeeklyChartCollapsed] = useState(false);

  // State for Zoomed Workout Modal (Holds array of workouts for selected day)
  const [zoomWorkouts, setZoomWorkouts] = useState(null);

  const isMobile = useIsMobile(768);

  const feedStart = getLocalDateString(currentWeekMonday);
  const feedEndDay = new Date(currentWeekMonday);
  feedEndDay.setDate(feedEndDay.getDate() + 27);
  const feedEnd = getLocalDateString(feedEndDay);
  const { workouts: feedWorkouts, loading: feedLoading, error: feedError, isDateLoaded, coverageRevision } = useActivityFeed(feedStart, feedEnd, calendarRefresh);
  useEffect(() => { setWorkouts(feedWorkouts); }, [feedWorkouts]);
  useEffect(() => { setLoading(feedLoading); }, [feedLoading]);
  useEffect(() => { setErrorMessage(feedError?.message || null); }, [feedError]);

  // When workouts state updates, re-sync zoomWorkouts if modal is currently open
  useEffect(() => {
    if (zoomWorkouts && zoomWorkouts.length > 0) {
      const activeIds = new Set(
        zoomWorkouts.map((w) => String(w.id || w.icu_activity_id))
      );
      const updatedZoomList = workouts.filter((w) =>
        activeIds.has(String(w.id || w.icu_activity_id))
      );
      
      if (updatedZoomList.length > 0) {
        setZoomWorkouts(updatedZoomList);
      }
    }
  }, [workouts]);

  // Keyboard shortcut listener to close zoom modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setZoomWorkouts(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredWorkouts = useMemo(() => {
    if (!activeFilters || activeFilters.length === 0 || activeFilters.length === 4) {
      return workouts;
    }
    return workouts.filter((w) => {
      const category = getSportCategory(w);
      return activeFilters.includes(category);
    });
  }, [workouts, activeFilters]);

  const fourWeeksDates = useMemo(() => getFourWeeksDates(currentWeekMonday), [currentWeekMonday]);

  const workoutsByDate = useMemo(() => {
    const map = {};
    fourWeeksDates.forEach((date) => {
      const dateStr = getLocalDateString(date);
      map[dateStr] = [];
    });

    if (Array.isArray(filteredWorkouts)) {
      filteredWorkouts.forEach((w) => {
        const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
        const dateStr = getLocalDateString(rawDate);
        if (map.hasOwnProperty(dateStr)) {
          map[dateStr].push(w);
        }
      });
    }

    return map;
  }, [filteredWorkouts, fourWeeksDates]);

  // Determine active sports for weekly bar charts
  const selectedChartSports = useMemo(() => {
    if (!activeFilters || activeFilters.length === 0 || activeFilters.length === 4) {
      return ['Run', 'Bike'];
    }
    return activeFilters.filter((f) => f === 'Run' || f === 'Bike');
  }, [activeFilters]);

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

  const handleOpenFilter = () => {
    setTempFilters(activeFilters);
    setIsFilterOpen(true);
  };

  const handleToggleTempFilter = (sport) => {
    setTempFilters((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const handleClearAll = () => {
    setTempFilters(['Run']);
  };

  const handleCancelFilter = () => {
    setIsFilterOpen(false);
  };

  const handleAcceptFilter = () => {
    if (tempFilters.length === 4) {
      setActiveFilters([]);
    } else {
      setActiveFilters(tempFilters);
    }
    setIsFilterOpen(false);
  };

  // Open zoom modal for a single workout or list of workouts
  const handleOpenZoomModal = (workoutOrList) => {
    if (Array.isArray(workoutOrList)) {
      if (workoutOrList.length > 0) setZoomWorkouts(workoutOrList);
    } else if (workoutOrList) {
      setZoomWorkouts([workoutOrList]);
    }
  };

  // Wait for workouts, sport settings, and paces context to finish loading
  if (loading || !paces) {
    return <div className="monthly-view-loading">Loading Monthly Workouts & Activities...</div>;
  }

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

  void coverageRevision;
  const renderDayCell = (date, workoutList) => {
    const dateStr = getLocalDateString(date);
    const isToday = dateStr === todayStr;
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const canDrop = !readOnly && dateStr >= todayStr;
    const handleDrop = (event) => {
      event.preventDefault();
      const source = dragWorkout;
      setDragWorkout(null);
      setDragOverDate(null);
      if (!source || !canDrop || source.date === dateStr) return;
      if (calendarBusy) return;
      setCalendarMenu(null);
      setZoomReturn(false);
      void confirmCalendarAction({ action: 'move', date: dateStr, originalDate: source.date, workout: source.workout });
    };

    return (
      <div 
        key={dateStr} 
        className={`monthly-day-cell ${isToday ? 'monthly-today' : ''} ${dragOverDate === dateStr ? 'monthly-drop-target' : ''}`}
        onDragOver={(event) => { if (dragWorkout && canDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverDate(dateStr); } }}
        onDragLeave={() => setDragOverDate(null)}
        onDrop={handleDrop}
      >
        <div className="monthly-day-header">
          <span className="monthly-day-name">{getDayName(dayIndex)}</span>
          <span className="monthly-day-separator">/</span>
          <span className="monthly-day-date">{formatHeaderDate(date)}</span>
          {!workoutList.some((w) => w.feedSource === "WORKOUTS" && !isWorkoutCompleted(w)) && renderCalendarOptions(dateStr)}
        </div>

        <div 
          className="monthly-day-workouts"
          style={{ overflowY: workoutList.length > 1 ? 'auto' : 'hidden' }}
        >
          {workoutList.length === 0 ? (
            <div className="monthly-empty-day" style={{ color: "#9299a3", fontSize: "0.78rem", padding: "8px 5px" }} aria-live="polite">{isDateLoaded(dateStr) ? "No Activity" : "Pending Load…"}</div>
          ) : (
            workoutList.map((workout, idx) => {
              const thresholdPaceMps = getThresholdPaceForSport(workout, sportSettings, paces);
              const completed = isWorkoutCompleted(workout);
              const isPast = dateStr < todayStr;
              const isMissed = isPast && !completed;

              return (
                <div 
                  key={workout.id || idx} 
                  className={`monthly-workout-item monthly-clickable ${completed ? 'monthly-completed' : ''} ${isMissed ? 'monthly-missed' : ''}`}
                  draggable={!readOnly && dateStr >= todayStr && workout.feedSource === 'WORKOUTS' && !completed}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragWorkout({ workout, date: dateStr }); }}
                  onDragEnd={() => { setDragWorkout(null); setDragOverDate(null); }}
                  onClick={() => handleOpenZoomModal(workoutList)}
                >
                  {workout.feedSource === "WORKOUTS" && renderCalendarOptions(dateStr, workout)}
                  <div className="monthly-workout-type">
                    {workout.name || workout.type || workout.sport || 'Activity'}
                  </div>
                  {(workout.workout_doc || workout.intervals) && (
                    <WorkoutChart
                      workout={workout}
                      thresholdPace={thresholdPaceMps}
                      chartHeight={isMobile ? "35px" : "55px"}
                      showWorkoutName={false}
                      showThresholdPace={false}
                      showYAxis={false} 
                      showYAxisLabels={false}
                      showLegend={false}
                      minimalXAxis={true}
                      showHoverDetails={false}
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

  const fourWeeksEndDate = new Date(currentWeekMonday.getTime() + 27 * 24 * 60 * 60 * 1000);

  return (
    <div className="monthly-view-container">
      {(errorMessage || calendarMessage) && (
        <div className="monthly-toast-error">
          <span className="monthly-toast-message">⚠️ {calendarMessage || errorMessage}</span>
          <button 
            type="button" 
            className="monthly-toast-close" 
            onClick={() => { setErrorMessage(null); setCalendarMessage(''); }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation & Controls */}
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

        {/* ---------- Filter by Sport ---------- */}
        <div className="monthly-nav-right-group">
          <div className="monthly-filter-container">
            <button
              type="button"
              className={`monthly-filter-btn ${activeFilters.length > 0 && activeFilters.length < 4 ? 'active-filters' : ''}`}
              onClick={handleOpenFilter}
              title="Filter Workouts"
            >
              <svg className="monthly-filter-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <span>Filter</span>
              {activeFilters.length > 0 && activeFilters.length < 4 && (
                <span className="monthly-filter-badge">{activeFilters.join(', ')}</span>
              )}
            </button>

            {isFilterOpen && (
              <>
                {isMobile && (
                  <div 
                    className="monthly-filter-overlay"
                    onClick={handleCancelFilter}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      zIndex: 999
                    }}
                  />
                )}
                <div 
                  className="monthly-filter-modal"
                  style={isMobile ? {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1000,
                    width: '85%',
                    maxWidth: '320px',
                    boxSizing: 'border-box'
                  } : {}}
                >
                  <div className="monthly-filter-title">Filter Workouts</div>
                  <div className="monthly-filter-options">
                    {['Swim', 'Bike', 'Run', 'Other'].map((sport) => (
                      <label key={sport} className="monthly-filter-option">
                        <input
                          type="checkbox"
                          checked={tempFilters.includes(sport)}
                          onChange={() => handleToggleTempFilter(sport)}
                        />
                        <span>{sport}</span>
                      </label>
                    ))}
                  </div>
                  <div className="monthly-filter-actions-row">
                    <button
                      type="button"
                      className="monthly-filter-btn-sm"
                      onClick={handleClearAll}
                    >
                      Clear All
                    </button>
                    <div className="monthly-filter-right-actions">
                      <button
                        type="button"
                        className="monthly-filter-btn-sm"
                        onClick={handleCancelFilter}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="monthly-filter-btn-sm monthly-filter-btn-primary"
                        onClick={handleAcceptFilter}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="monthly-week-label">
            {currentWeekMonday.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })} - {fourWeeksEndDate.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* DESKTOP TOP SUMMARY CHARTS ROW (COLLAPSIBLE) */}
      {!isMobile && selectedChartSports.length > 0 && (
        isWeeklyChartCollapsed ? (
          <CollapsedWeeklySummary
            fourWeeksDates={fourWeeksDates}
            workoutsByDate={workoutsByDate}
            selectedChartSports={selectedChartSports}
            onToggleCollapse={() => setIsWeeklyChartCollapsed(false)}
          />
        ) : (
          <div className="monthly-desktop-top-charts">
            {[0, 1, 2, 3].map((weekIdx) => {
              const weekDates = fourWeeksDates.slice(weekIdx * 7, (weekIdx + 1) * 7);
              const isFarRight = weekIdx === 3;
              return (
                <div key={weekIdx} className="monthly-desktop-chart-column">
                  {selectedChartSports.map((sport, sIdx) => {
                    const isLastSportInFarRight = isFarRight && (sIdx === selectedChartSports.length - 1 || selectedChartSports.length === 1);
                    return (
                      <WeeklyFrameChart
                        key={sport}
                        weekDates={weekDates}
                        workoutsByDate={workoutsByDate}
                        sportType={sport}
                        onDayClick={(sportWorkouts) => handleOpenZoomModal(sportWorkouts)}
                        isFarRight={isLastSportInFarRight}
                        isCollapsed={false}
                        onToggleCollapse={() => setIsWeeklyChartCollapsed(true)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* MAIN 4-WEEK CALENDAR GRID */}
      <div className="monthly-weeks-container">
        {[0, 1, 2, 3].map((weekIdx) => {
          const weekDates = fourWeeksDates.slice(weekIdx * 7, (weekIdx + 1) * 7);

          return (
            <div key={weekIdx} className="monthly-week-row-wrapper">
              {/* MOBILE INLINE CHARTS */}
              {isMobile && selectedChartSports.length > 0 && !isWeeklyChartCollapsed && (
                <div className="monthly-mobile-charts-block">
                  {selectedChartSports.map((sport) => (
                    <WeeklyFrameChart
                      key={sport}
                      weekDates={weekDates}
                      workoutsByDate={workoutsByDate}
                      sportType={sport}
                      onDayClick={(sportWorkouts) => handleOpenZoomModal(sportWorkouts)}
                    />
                  ))}
                </div>
              )}

              {/* 7-Day Grid Row */}
              <div className={`monthly-grid ${isMobile ? 'monthly-grid-mobile' : 'monthly-grid-desktop'}`}>
                {weekDates.map((date) => {
                  const dateStr = getLocalDateString(date);
                  return renderDayCell(date, workoutsByDate[dateStr] || []);
                })}
              </div>
            </div>
          );
        })}
      </div>

      {calendarAction && <CalendarWorkoutActions
        open={true}
        action={calendarAction.action}
        date={calendarAction.date}
        workout={calendarAction.workout}
        busy={calendarBusy}
        initialTargetDate={calendarAction.targetDate || ''}
        onClose={() => {
          if (calendarBusy) return;
          setCalendarAction(null);
          setZoomReturn(false);
        }}
        onConfirm={confirmCalendarAction}
      />}

      {/* REUSABLE FULL-WIDTH WORKOUT ZOOM MODAL */}
      {zoomWorkouts && (
        <div style={calendarAction ? { display: 'none' } : undefined}>
        <WorkoutZoomModal
          workouts={zoomWorkouts}
          setWorkouts={setWorkouts} 
          onClose={() => setZoomWorkouts(null)}
          sportSettings={sportSettings}
          paces={paces}
          isMobile={isMobile}
          readOnly={readOnly}
          onCalendarAction={(action, workout) => { const date = getLocalDateString(workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date); setZoomReturn(true); openCalendarAction(action, date, action === 'add' ? null : workout); }}
        />
        </div>
      )}

    </div>
  );
}