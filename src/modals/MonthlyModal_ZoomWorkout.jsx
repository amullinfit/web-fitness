import React, { useState } from 'react';
import WorkoutChart from '../components/WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';
import Modal_AddGear from './Modal_AddGear';
import GearBadge from '../components/GearBadge';
import { getThresholdPaceForSport } from '../utils/MonthlyViewHelpers';
import { useGearManagement } from '../utils/useGearManagement';

export function WorkoutZoomContent({
  workout,
  sportSettings,
  paces,
  isMobile,
  removingGearId,
  onRemoveGear,
  onOpenAddGear,
  readOnly = false,
}) {
  return (
    <div className="monthly-zoom-body">
      {!readOnly && (
        <div
          className="monthly-zoom-header-gear"
          style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 0 20px' }}
        >
          <GearBadge
            workout={workout}
            removingGearId={removingGearId}
            onRemoveGear={(gearId) => onRemoveGear(workout.id, gearId)}
            onOpenAddGear={() => onOpenAddGear(workout.id)}
          />
        </div>
      )}

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

export function WorkoutZoomModal({ workouts, onClose, sportSettings, paces, isMobile, setWorkouts, readOnly = false }) {
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(0);

  const {
    removingGearId,
    errorMessage,
    setErrorMessage,
    modalWorkoutId,
    setModalWorkoutId,
    loadingGear,
    selectedGearId,
    setSelectedGearId,
    activeShoesList,
    handleRemoveGear,
    handleOpenAddGearModal,
    handleAddGear,
  } = useGearManagement(workouts, setWorkouts);

  if (!workouts || workouts.length === 0) return null;

  const activeWorkout = workouts[activeWorkoutIndex] || workouts[0];
  const workoutKey = `${activeWorkout.id || activeWorkoutIndex}-${JSON.stringify(activeWorkout.gear || [])}`;

  return (
    <div className="monthly-zoom-overlay" onClick={onClose}>
      <div className="monthly-zoom-modal" onClick={(e) => e.stopPropagation()}>
        {errorMessage && (
          <div className="daily-toast-error">
            <span className="daily-toast-message">⚠️ {errorMessage}</span>
            <button
              type="button"
              className="daily-toast-close"
              onClick={() => setErrorMessage(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="monthly-zoom-header">
          <div className="monthly-zoom-title-group">
            <span className="monthly-zoom-sport-tag">
              {activeWorkout.type || activeWorkout.sport || 'Workout'}
            </span>
            <h2>{activeWorkout.name || activeWorkout.title || 'Workout Details'}</h2>
          </div>
          <button className="monthly-zoom-close" onClick={onClose}>✕</button>
        </div>

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

        <WorkoutZoomContent
          key={workoutKey}
          workout={activeWorkout}
          sportSettings={sportSettings}
          paces={paces}
          isMobile={isMobile}
          removingGearId={removingGearId}
          onRemoveGear={handleRemoveGear}
          onOpenAddGear={handleOpenAddGearModal}
          readOnly={readOnly}
        />

        {!readOnly && <Modal_AddGear
          isOpen={Boolean(modalWorkoutId)}
          onClose={() => {
            setModalWorkoutId(null);
            setSelectedGearId(null);
          }}
          loadingGear={loadingGear}
          activeShoesList={activeShoesList}
          selectedGearId={selectedGearId}
          setSelectedGearId={setSelectedGearId}
          onConfirmAdd={() => handleAddGear(modalWorkoutId, selectedGearId)}
        />}
        
      </div>
    </div>
  );
}