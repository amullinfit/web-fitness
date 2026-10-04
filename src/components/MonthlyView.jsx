//
// MONTHLYVIEW.JSX
//
import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';
import '../CSS/MonthlyView.css';
import { usePaces } from '../utils/PacesContext.jsx'; 

import {
  useIsMobile,
  safeStringLower,
  getSportCategory,
  getThresholdPaceForSport,
  getLocalDateString,
  isWorkoutCompleted,
  getMondayOfWeek,
  getFourWeeksDates,
  metersToMilesNum
} from '../utils/MonthlyViewHelpers.jsx';

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

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
  
    const controller = new AbortController();
  
    const fetchData = async () => {
      try {
        const [valRes, histRes] = await Promise.allSettled([
          fetch(VAL_WORKOUTS_URL, { signal: controller.signal }).then((r) => {
            if (!r.ok) throw new Error(`Workouts fetch failed: ${r.status}`);
            return r.json();
          }),
          fetch(HISTORICAL_URL, { signal: controller.signal }).then((r) => {
            if (!r.ok) throw new Error(`Historical fetch failed: ${r.status}`);
            return r.json();
          }),
        ]);
  
        if (!isMounted) return;
  
        const valJson = valRes.status === 'fulfilled' ? valRes.value : null;
        const historicalJson = histRes.status === 'fulfilled' ? histRes.value : null;
  
        // Log or handle partial failures
        if (valRes.status === 'rejected') console.error(valRes.reason);
        if (histRes.status === 'rejected') console.error(histRes.reason);
  
        const valList = (valJson?.planned || valJson?.workouts || (Array.isArray(valJson) ? valJson : []))
          .map((item) => ({ ...item, feedSource: 'WORKOUTS' }));
  
        const historicalList = (historicalJson?.activities || historicalJson?.workouts || (Array.isArray(historicalJson) ? historicalJson : []))
          .map((item) => ({ ...item, feedSource: 'HISTORICAL' }));
  
        const settings = Array.isArray(valJson?.sportSettings)
          ? valJson.sportSettings
          : Array.isArray(historicalJson?.sportSettings)
          ? historicalJson.sportSettings
          : [];
  
        // 1. Pre-index planned workouts
        const plannedWorkoutsById = new Map();
        const plannedWorkoutsByDateType = new Map(); // Key -> Array of workouts
  
        for (const workout of valList) {
          if (!workout) continue;
  
          if (workout.id != null) {
            plannedWorkoutsById.set(String(workout.id), workout);
          }
  
          const dateStr = workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date;
          const itemDate = dateStr ? getLocalDateString(dateStr) : '';
          const itemType = safeStringLower(workout.type || workout.sport || 'workout');
  
          if (itemDate) {
            const key = `${itemDate}-${itemType}`;
            const existing = plannedWorkoutsByDateType.get(key) || [];
            existing.push(workout);
            plannedWorkoutsByDateType.set(key, existing);
          }
        }
  
        const pairedEventIds = new Set();
  
        // 2. Process historical items
        const updatedHistoricalList = historicalList.map((item) => {
          if (!item) return item;
  
          let plannedMatch = null;
  
          // Try direct ID pairing first
          if (item.paired_event_id != null) {
            const pairedIdStr = String(item.paired_event_id);
            plannedMatch = plannedWorkoutsById.get(pairedIdStr);
            if (plannedMatch) pairedEventIds.add(pairedIdStr);
          }
  
          // Fallback to Date + Sport matching
          if (!plannedMatch) {
            const dateStr = item.start_date_local || item.icu_start_date || item.start_date || item.date;
            const itemDate = dateStr ? getLocalDateString(dateStr) : '';
            const itemType = safeStringLower(item.type || item.sport || 'workout');
            const key = `${itemDate}-${itemType}`;
  
            const matches = plannedWorkoutsByDateType.get(key);
            if (matches && matches.length > 0) {
              // Pick first unpaired planned workout matching this date/type
              plannedMatch = matches.find((m) => m.id != null && !pairedEventIds.has(String(m.id)));
              if (plannedMatch?.id != null) {
                pairedEventIds.add(String(plannedMatch.id));
              }
            }
          }
  
          // Enrich attributes if matched
          if (plannedMatch) {
            const plannedName = plannedMatch.name || plannedMatch.title || item.name || item.title;
            return {
              ...item,
              name: plannedName,
              title: plannedName,
              workout_doc: item.workout_doc || plannedMatch.workout_doc,
              description: item.description || plannedMatch.description,
            };
          }
  
          return item;
        });
  
        // 3. Filter out paired planned workouts
        const remainingValList = valList.filter((workout) => {
          if (!workout || workout.id == null) return true;
          return !pairedEventIds.has(String(workout.id));
        });
  
        // 4. Merge and deduplicate in a single pass
        const mergedList = [];
        const seenKeys = new Set();
  
        for (const item of [...updatedHistoricalList, ...remainingValList]) {
          if (!item) continue;
          const dateStr = item.start_date_local || item.icu_start_date || item.start_date || item.date;
          const itemDate = dateStr ? getLocalDateString(dateStr) : '';
          const itemType = safeStringLower(item.type || item.sport || 'workout');
  
          const uniqueKey = item.id != null
            ? String(item.id)
            : `${item.name || itemType}-${itemDate}-${item.feedSource}`;
  
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            mergedList.push(item);
          }
        }
  
        setWorkouts(mergedList);
        setSportSettings(settings);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error loading workout data:", err);
          if (isMounted) setError(err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
  
    fetchData();
  
    return () => {
      isMounted = false;
      controller.abort(); // Cancel ongoing network requests on unmount
    };
  }, [VAL_WORKOUTS_URL, HISTORICAL_URL]);
  
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
          <span className="monthly-day-name">{getDayName(dayIndex)}</span>
          <span className="monthly-day-separator">/</span>
          <span className="monthly-day-date">{formatHeaderDate(date)}</span>
        </div>

        <div 
          className="monthly-day-workouts"
          style={{ overflowY: workoutList.length > 1 ? 'auto' : 'hidden' }}
        >
          {workoutList.length === 0 ? (
            <div className="monthly-empty-day"></div>
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
                  onClick={() => handleOpenZoomModal(workoutList)}
                >
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

      {/* REUSABLE FULL-WIDTH WORKOUT ZOOM MODAL */}
      {zoomWorkouts && (
        <WorkoutZoomModal
          workouts={zoomWorkouts}
          setWorkouts={setWorkouts} 
          onClose={() => setZoomWorkouts(null)}
          sportSettings={sportSettings}
          paces={paces}
          isMobile={isMobile}
        />
      )}

    </div>
  );
}