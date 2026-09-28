import React, { useState, useMemo } from 'react';

// Helpers & Utilities
import { 
  useIsMobile, 
  safeStringLower, 
  getSportCategory, 
  getThresholdPaceForSport, 
  getLocalDateString, 
  isWorkoutCompleted, 
  getMondayOfWeek, 
  getFourWeeksDates 
} from '../utils/MonthlyViewHelpers';

// Chart & Modal Components
import { WeeklyFrameChart } from '../utils/MonthlyViewWeeklyChart';
import { WorkoutZoomModal } from '../modals/MonthlyModal_ZoomWorkout';
import WorkoutChart from '../components/WorkoutChart';

// CSS Import
import './MonthlyView.css';

export default function MonthlyView({ 
  currentDate = new Date(), 
  workouts = [], 
  sportSettings = {}, 
  paces = {},
  onNavigateDate,
  onTodayClick
}) {
  const isMobile = useIsMobile();

  // State
  const [activeDate, setActiveDate] = useState(currentDate);
  const [zoomWorkouts, setZoomWorkouts] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [toastError, setToastError] = useState(null);
  const [selectedSports, setSelectedSports] = useState(['Run', 'Bike', 'Swim', 'Other']);

  // Date Calculations (4-Week Grid)
  const fourWeeksDates = useMemo(() => {
    const startMonday = getMondayOfWeek(activeDate);
    return getFourWeeksDates(startMonday);
  }, [activeDate]);

  // Group Workouts by Date string
  const workoutsByDate = useMemo(() => {
    const map = {};
    (workouts || []).forEach((w) => {
      const dateKey = getLocalDateString(w.date || w.scheduled_date || w.start_date_local);
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(w);
      }
    });
    return map;
  }, [workouts]);

  // Filtered Workouts based on user-selected sport checkboxes
  const filteredWorkoutsByDate = useMemo(() => {
    const map = {};
    Object.keys(workoutsByDate).forEach((dateKey) => {
      const dayList = workoutsByDate[dateKey] || [];
      const filtered = dayList.filter((w) => {
        const cat = getSportCategory(w);
        return selectedSports.includes(cat);
      });
      if (filtered.length > 0) {
        map[dateKey] = filtered;
      }
    });
    return map;
  }, [workoutsByDate, selectedSports]);

  // Date Navigation Handlers
  const handlePrevMonth = () => {
    const newDate = new Date(activeDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setActiveDate(newDate);
    if (onNavigateDate) onNavigateDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(activeDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setActiveDate(newDate);
    if (onNavigateDate) onNavigateDate(newDate);
  };

  const handleToday = () => {
    const today = new Date();
    setActiveDate(today);
    if (onTodayClick) onTodayClick();
    if (onNavigateDate) onNavigateDate(today);
  };

  const handleOpenZoomModal = (workoutsToZoom) => {
    if (workoutsToZoom && workoutsToZoom.length > 0) {
      setZoomWorkouts(workoutsToZoom);
    }
  };

  const toggleSportFilter = (sport) => {
    setSelectedSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  // Render Individual Workout Item inside Day Cell
  const renderWorkoutItem = (workout, idx) => {
    const completed = isWorkoutCompleted(workout);
    const sportCategory = getSportCategory(workout);

    return (
      <div
        key={workout.id || idx}
        className={`monthly-workout-item monthly-clickable ${completed ? 'monthly-completed' : ''}`}
        onClick={() => handleOpenZoomModal([workout])}
      >
        <div className="monthly-workout-type">
          {workout.name || workout.title || sportCategory}
        </div>

        {/* Desktop Micro Workout Chart */}
        {!isMobile && (
          <div style={{ height: '35px', marginTop: '2px' }}>
            <WorkoutChart
              workout={workout}
              thresholdPace={getThresholdPaceForSport(workout, sportSettings, paces)}
              chartHeight="35px"
              showWorkoutName={false}
              showThresholdPace={false}
              showYAxisLabels={false}
              showLegend={false}
              minimalXAxis={true}
              showHoverDetails={false}
            />
          </div>
        )}
      </div>
    );
  };

  // Render Day Cell
  const renderDayCell = (dateObj, dayWorkouts) => {
    const dateStr = getLocalDateString(dateObj);
    const dayNumber = dateObj.getDate();
    const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
    const isToday = dateStr === getLocalDateString(new Date());

    return (
      <div 
        key={dateStr} 
        className={`monthly-day-cell ${isToday ? 'monthly-today' : ''}`}
      >
        <div className="monthly-day-header">
          <span className="monthly-day-name">{dayName}</span>
          <span className="monthly-day-separator">/</span>
          <span className="monthly-day-date">{dayNumber}</span>
        </div>

        <div className="monthly-day-workouts">
          {dayWorkouts.length === 0 ? (
            <div className="monthly-empty-day" />
          ) : (
            dayWorkouts.map((workout, idx) => renderWorkoutItem(workout, idx))
          )}
        </div>
      </div>
    );
  };

  const startMonthName = fourWeeksDates[0]?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const endMonthName = fourWeeksDates[27]?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const dateRangeLabel = startMonthName === endMonthName ? startMonthName : `${startMonthName} - ${endMonthName}`;

  return (
    <div className="monthly-view-container">
      {/* Toast Error Alert */}
      {toastError && (
        <div className="monthly-toast-error">
          <span>{toastError}</span>
          <button className="monthly-toast-close" onClick={() => setToastError(null)}>✕</button>
        </div>
      )}

      {/* Navigation Bar */}
      <div className="monthly-nav-bar">
        <div className="monthly-nav-buttons">
          <button className="nav-btn" onClick={handlePrevMonth}>‹ Prev</button>
          <button className="nav-btn nav-btn-today" onClick={handleToday}>Today</button>
          <button className="nav-btn" onClick={handleNextMonth}>Next ›</button>
        </div>

        <div className="monthly-nav-right-group">
          <span className="monthly-week-label">{dateRangeLabel}</span>

          {/* Filter Dropdown Controls */}
          <div className="monthly-filter-container">
            <button 
              className={`monthly-filter-btn ${selectedSports.length < 4 ? 'active-filters' : ''}`}
              onClick={() => setShowFilterModal(!showFilterModal)}
            >
              Filter ⚙
              {selectedSports.length < 4 && (
                <span className="monthly-filter-badge">{selectedSports.join(', ')}</span>
              )}
            </button>

            {showFilterModal && (
              <div className="monthly-filter-modal">
                <div className="monthly-filter-title">Filter Sports</div>
                <div className="monthly-filter-options">
                  {['Run', 'Bike', 'Swim', 'Other'].map((sport) => (
                    <label key={sport} className="monthly-filter-option">
                      <input
                        type="checkbox"
                        checked={selectedSports.includes(sport)}
                        onChange={() => toggleSportFilter(sport)}
                      />
                      {sport}
                    </label>
                  ))}
                </div>
                <div className="monthly-filter-actions-row">
                  <button 
                    className="monthly-filter-btn-sm"
                    onClick={() => setSelectedSports(['Run', 'Bike', 'Swim', 'Other'])}
                  >
                    Select All
                  </button>
                  <button 
                    className="monthly-filter-btn-sm monthly-filter-btn-primary"
                    onClick={() => setShowFilterModal(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Top Weekly Summary Chart Columns */}
      {!isMobile && (
        <div className="monthly-desktop-top-charts">
          {['Run', 'Bike', 'Swim'].map((sport) => (
            <div key={sport} className="monthly-desktop-chart-column">
              <WeeklyFrameChart
                weekDates={fourWeeksDates.slice(0, 7)}
                workoutsByDate={filteredWorkoutsByDate}
                sportType={sport}
                onDayClick={(sportWorkouts) => handleOpenZoomModal(sportWorkouts)}
              />
            </div>
          ))}
        </div>
      )}

      {/* MAIN 4-WEEK CALENDAR GRID */}
      <div className="monthly-weeks-container">
        {[0, 1, 2, 3].map((weekIdx) => {
          const weekDates = fourWeeksDates.slice(weekIdx * 7, (weekIdx + 1) * 7);

          return (
            <div key={weekIdx} className="monthly-week-row-wrapper">
              {/* MOBILE INLINE CHARTS (Appears above each 7-day week row on mobile) */}
              {isMobile && (
                <div className="monthly-mobile-charts-block">
                  {['Run', 'Bike', 'Swim']
                    .filter((sport) => selectedSports.includes(sport))
                    .map((sport) => (
                      <WeeklyFrameChart
                        key={sport}
                        weekDates={weekDates}
                        workoutsByDate={filteredWorkoutsByDate}
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
                  return renderDayCell(date, filteredWorkoutsByDate[dateStr] || []);
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
          onClose={() => setZoomWorkouts(null)}
          sportSettings={sportSettings}
          paces={paces}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}