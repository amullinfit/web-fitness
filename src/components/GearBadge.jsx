import React from 'react';
import { useReadOnly } from '../context/ReadOnlyContext.jsx';
import { getGearInfo, isWorkoutCompleted } from '../utils/useGearManagement';

export default function GearBadge({ workout, removingGearId, onRemoveGear, onOpenAddGear }) {
  const readOnly = useReadOnly();
  if (!isWorkoutCompleted(workout)) return null;

  const activityId = workout.icu_activity_id || workout.activity_id || workout.id;
  const { shoeName, gearId, hasValidShoe } = getGearInfo(workout);
  const isRemoving = removingGearId === activityId;

  return (
    <div className="daily-workout-header-right">
      {hasValidShoe ? (
        <span className="daily-workout-type daily-shoe-type">
          <span>👟 {shoeName}</span>
          {!readOnly && (
            <button
              type="button"
              className="del-btn remove-gear-btn"
              title={`Activity ID: ${activityId} | Gear ID: ${gearId}`}
              disabled={isRemoving}
              onClick={() => onRemoveGear(activityId, gearId)}
            >
              {isRemoving ? <span className="gear-spinner" /> : '✕'}
            </button>
          )}
          <div className="gear-id-tooltip">
            <span><strong>Activity ID:</strong> {activityId || 'N/A'}</span>
            <span><strong>Gear ID:</strong> {gearId || 'N/A'}</span>
          </div>
        </span>
      ) : (
        !readOnly && (
          <button
            type="button"
            className="add-btn"
            title="Add Shoe"
            onClick={() => onOpenAddGear(activityId)}
          >
            +
          </button>
        )
      )}
    </div>
  );
}