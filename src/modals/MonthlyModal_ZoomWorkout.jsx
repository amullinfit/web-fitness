//
// MONTHLYMODAL_ZOOMWORKOUT.JSX
//
import React, { useState } from 'react';
import WorkoutChart from '../components/WorkoutChart'; // Adjust path if WorkoutChart is in another directory
import WorkoutTextSection from '../utils/WorkoutTextSection';
import { getThresholdPaceForSport } from '../utils/MonthlyViewHelpers';

/**
 * Isolated Content Wrapper: Remounting this component on tab switch
 * resets internal states like open/close toggles in WorkoutTextSection.
 */
export function WorkoutZoomContent({ workout, sportSettings, paces, isMobile }) {
  return (
    <div className="monthly-zoom-body">
      <div className="monthly-zoom-chart-container">
        <WorkoutChart
          workout={workout}
          thresholdPace={getThresholdPaceForSport(workout, sportSettings, paces)}
          chartHeight={isMobile ? "110px" : "140px"}
          showWorkoutName={true}
          showThresholdPace={true}
          showYAxisLabels={true}
          showLegend={true}
          minimalXAxis={false}
          showHoverDetails={true}
        />
      </div>

      <WorkoutTextSection 
        workout={workout} 
        thresholdPace={getThresholdPaceForSport(workout, sportSettings, paces)}
        paceDetails={paces}
      />
    </div>
  );
}

/**
 * Full-Width Workout Zoom Modal (Supports multiple workouts with tab navigation)
 */
export function WorkoutZoomModal({ workouts, onClose, sportSettings, paces, isMobile }) {
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(0);

  if (!workouts || workouts.length === 0) return null;

  const activeWorkout = workouts[activeWorkoutIndex] || workouts[0];
  const workoutKey = activeWorkout.id || activeWorkoutIndex;

  return (
    <div className="monthly-zoom-overlay" onClick={onClose}>
      <div className="monthly-zoom-modal" onClick={(e) => e.stopPropagation()}>
        <div className="monthly-zoom-header">
          <div className="monthly-zoom-title-group">
            <span className="monthly-zoom-sport-tag">
              {activeWorkout.type || activeWorkout.sport || 'Workout'}
            </span>
            <h2>{activeWorkout.name || activeWorkout.title || 'Workout Details'}</h2>
          </div>
          <button className="monthly-zoom-close" onClick={onClose}>✕</button>
        </div>

        {/* Multi-Workout Navigation Bar inside Modal */}
        {workouts.length > 1 && (
          <div 
            className="monthly-zoom-tabs-bar"
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 20px 0 20px',
              borderBottom: '1px solid #E5E7EB',
              overflowX: 'auto'
            }}
          >
            {workouts.map((w, idx) => (
              <button
                key={w.id || idx}
                type="button"
                onClick={() => setActiveWorkoutIndex(idx)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px 6px 0 0',
                  border: '1px solid #E5E7EB',
                  borderBottom: activeWorkoutIndex === idx ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  backgroundColor: activeWorkoutIndex === idx ? '#FFFFFF' : '#F3F4F6',
                  fontWeight: activeWorkoutIndex === idx ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {w.name || w.type || `Workout ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Using key={workoutKey} ensures WorkoutTextSection collapses on tab change */}
        <WorkoutZoomContent
          key={workoutKey}
          workout={activeWorkout}
          sportSettings={sportSettings}
          paces={paces}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}