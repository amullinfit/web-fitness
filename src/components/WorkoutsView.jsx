import React from 'react';
import WorkoutTextSection from './WorkoutTextSection';

const formatDateHeader = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function WorkoutsView({ workouts = [], sportSettings = [] }) {
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return (
      <div 
        style={{ 
          maxWidth: '800px', 
          margin: '32px auto', 
          padding: '32px', 
          textAlign: 'center', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px', 
          border: '1px dashed #dee2e6',
          color: '#6c757d' 
        }}
      >
        No workouts found.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '22px', color: '#212529', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
        All Workouts ({workouts.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {workouts.map((workout, index) => {
          const rawDate = workout.date || workout.workout_date || workout.start_date || workout.date_string;
          const displayDate = formatDateHeader(rawDate);

          return (
            <div 
              key={workout.id || workout._id || index}
              style={{
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#212529' }}>
                    {workout.title || workout.name || `${workout.type || 'Workout'}`}
                  </h3>
                  {displayDate && (
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>
                      {displayDate}
                    </span>
                  )}
                </div>

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

              {/* Description */}
              {workout.description && (
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6c757d' }}>
                  {workout.description}
                </p>
              )}

              {/* SINGLE CHART RENDER via WorkoutTextSection (mm:ss paces + step details) */}
              <WorkoutTextSection workout={workout} sportSettings={sportSettings} />
            </div>
          );
        })}
      </div>
    </div>
  );
}