//
// MONTHLYVIEW.JSX
//
import React, { useState, useMemo } from 'react';

// Imports from helper utilities and modals
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

import { WeeklyFrameChart } from '../utils/MonthlyViewWeeklyChart';
import { WorkoutZoomModal } from '../modals/MonthlyModal_ZoomWorkout';

// Optional: Import WorkoutChart if used directly within cell micro-views
import WorkoutChart from '../components/WorkoutChart';

export default function MonthlyView({ 
  currentDate = new Date(), 
  workouts = [], 
  sportSettings = {}, 
  paces = {} 
}) {
  const isMobile = useIsMobile();

  // State management
  const [zoomWorkouts, setZoomWorkouts] = useState(null);
  const [selectedChartSports, setSelectedChartSports] = useState(['Run', 'Bike', 'Swim']);

  // Calculate 4-week calendar dates (28 days starting from Monday of current week)
  const fourWeeksDates = useMemo(() => {
    const startMonday = getMondayOfWeek(currentDate);
    return getFourWeeksDates(startMonday);
  }, [currentDate]);

  // Group workouts by local date string YYYY-MM-DD
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

  // Handlers
  const handleOpenZoomModal = (workoutsToZoom) => {
    if (workoutsToZoom && workoutsToZoom.length > 0) {
      setZoomWorkouts(workoutsToZoom);
    }
  };

  const toggleSportChart = (sport) => {
    setSelectedChartSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  // Single Day Cell Renderer
  const renderDayCell = (dateObj, dayWorkouts) => {
    const dateStr = getLocalDateString(dateObj);
    const dayNumber = dateObj.getDate();
    const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
    const isToday = dateStr === getLocalDateString(new Date());

    return (
      <div 
        key={dateStr} 
        className={`monthly-day-cell ${isToday ? 'monthly-today-cell' : ''}`}
      >
        <div className="monthly-day-cell-header">
          <span className="monthly-day-name">{dayName}</span>
          <span className={`monthly-day-number ${isToday ? 'today-badge' : ''}`}>
            {dayNumber}
          </span>
        </div>

        <div className="monthly-day-cell-content">
          {dayWorkouts.length === 0 ? (
            <div className="monthly-empty-day">Rest Day</div>
          ) : (
            dayWorkouts.map((workout, idx) => {
              const completed = isWorkoutCompleted(workout);
              const sportCategory = getSportCategory(workout);

              return (
                <div
                  key={workout.id || idx}
                  className={`monthly-workout-card workout-${sportCategory.toLowerCase()} ${completed ? 'completed' : 'planned'}`}
                  onClick={() => handleOpenZoomModal([workout])}
                >
                  <div className="monthly-workout-title-row">
                    <span className="monthly-sport-badge">{sportCategory}</span>
                    <span className="monthly-workout-name">{workout.name || workout.title || 'Workout'}</span>
                  </div>

                  {/* Micro Chart Preview for Desktop */}
                  {!isMobile && (
                    <div className="monthly-micro-chart">
                      <WorkoutChart
                        workout={workout}
                        thresholdPace={getThresholdPaceForSport(workout, sportSettings, paces)}
                        chartHeight="45px"
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
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="monthly-view-container">
      {/* HEADER / CONTROLS */}
      <div className="monthly-view-header">
        <h2>4-Week Overview</h2>
        
        {/* Toggleable Sport Filters for Mobile Weekly Charts */}
        {isMobile && (
          <div className="monthly-sport-filter-toggles">
            {['Run', 'Bike', 'Swim'].map((sport) => {
              const isActive = selectedChartSports.includes(sport);
              return (
                <button
                  key={sport}
                  type="button"
                  className={`monthly-filter-btn filter-${sport.toLowerCase()} ${isActive ? 'active' : ''}`}
                  onClick={() => toggleSportChart(sport)}
                >
                  {sport} Charts {isActive ? '✓' : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MAIN 4-WEEK CALENDAR GRID */}
      <div className="monthly-weeks-container">
        {[0, 1, 2, 3].map((weekIdx) => {
          const weekDates = fourWeeksDates.slice(weekIdx * 7, (weekIdx + 1) * 7);

          return (
            <div key={weekIdx} className="monthly-week-row-wrapper">
              {/* MOBILE INLINE CHARTS (Appears directly above each 7-day week row) */}
              {isMobile && selectedChartSports.length > 0 && (
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
          onClose={() => setZoomWorkouts(null)}
          sportSettings={sportSettings}
          paces={paces}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}