import React, { useState, useMemo } from 'react';
import WorkoutTextSection from './WorkoutTextSection';

/**
 * Safely converts any Date object, ISO string, or timestamp into a local 'YYYY-MM-DD' string.
 * Using split('T')[0] prevents UTC midnight shifts from showing yesterday's workout.
 */
const getLocalDateString = (dateInput) => {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      return dateInput.split('T')[0];
    }
    if (dateInput.length >= 10) {
      return dateInput.slice(0, 10);
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function DailyView({ workouts = [], sportSettings = [], initialDate = new Date() }) {
  // Currently selected date state
  const [selectedDate, setSelectedDate] = useState(() => new Date(initialDate));

  // YYYY-MM-DD representation of the active selected date
  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  // Filter workouts that match the selected date
  const todaysWorkouts = useMemo(() => {
    if (!Array.isArray(workouts)) return [];
    
    return workouts.filter((workout) => {
      const rawDate = workout.date || workout.workout_date || workout.start_date || workout.date_string;
      const workoutDateStr = getLocalDateString(rawDate);
      return workoutDateStr === selectedDateStr;
    });
  }, [workouts, selectedDateStr]);

  // Date Navigation Handlers
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

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const formattedHeaderDate = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      {/* Date Header & Navigation Toolbar */}
      <div 
        style={{ 
          display: 'flex', 
          justify: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid #dee2e6' 
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#212529' }}>{formattedHeaderDate}</h2>
          {selectedDateStr === todayStr && (
            <span style={{ fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>Today</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrevDay}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            ← Prev Day
          </button>
          
          <button
            onClick={handleToday}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #0d6efd',
              borderRadius: '4px',
              backgroundColor: selectedDateStr === todayStr ? '#0d6efd' : '#ffffff',
              color: selectedDateStr === todayStr ? '#ffffff' : '#0d6efd',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Today
          </button>

          <button
            onClick={handleNextDay}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            Next Day →
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {todaysWorkouts.length === 0 ? (
        <div 
          style={{ 
            padding: '32px', 
            textAlign: 'center', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px', 
            border: '1px dashed #dee2e6',
            color: '#6c757d'
          }}
        >
          No workouts scheduled for this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {todaysWorkouts.map((workout, index) => (
            <div 
              key={workout.id || workout._id || index}
              style={{
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              {/* Workout Metadata Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#212529' }}>
                  {workout.title || workout.name || `${workout.type || 'Workout'}`}
                </h3>
                <span 
                  style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    backgroundColor: '#e9ecef', 
                    padding: '3px 8px', 
                    borderRadius: '4px',
                    color: '#495057'
                  }}
                >
                  {workout.type || 'Activity'}
                </span>
              </div>

              {/* Workout Description if present */}
              {workout.description && (
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6c757d' }}>
                  {workout.description}
                </p>
              )}

              {/* Chart & Debug Section Component */}
              <WorkoutTextSection workout={workout} sportSettings={sportSettings} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}