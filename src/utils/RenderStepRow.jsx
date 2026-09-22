//
// RenderStepRow.jsx
//
import React from 'react';
import MMSSInput from './MMSSInput';
import { formatDistance, formatTime } from './WorkoutBuilderHelpers.js';

export default function RenderStepRow({
  step,
  index,
  parentId,
  workoutMode,
  presets,
  onRemove,
  onUpdate,
  onAddChild,
  onDragStart,
  onDrop
}) {
  if (!step) return null;

  // Determine if this is a repeat block (Intervals.icu uses `reps` or nested `steps`)
  const isRepeat = step.type === 'repeat' || Boolean(step.reps) || Array.isArray(step.steps);

  if (isRepeat) {
    const childSteps = step.steps || [];
    const iterations = step.reps ?? step.iterations ?? 1;

    return (
      <div
        className="repeat-block-container"
        draggable
        onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop && onDrop(e, parentId, index)}
      >
        <div className="repeat-header">
          <span className="drag-handle">⣿</span>
          <strong className="repeat-type-title">Repeat Block</strong>
          <label style={{ fontSize: '12px', marginLeft: '8px' }}>
            Repeats:
            <input
              type="number"
              min="1"
              max="99"
              value={iterations}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                onUpdate(step.id, 'reps', val);
                onUpdate(step.id, 'iterations', val);
              }}
              style={{ width: '48px', marginLeft: '4px' }}
            />
          </label>
          <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop && onDrop(e, step.id, childSteps.length)}>
          {childSteps.map((childStep, childIdx) => (
            <RenderStepRow
              key={childStep.id || `child-${childIdx}`}
              step={childStep}
              index={childIdx}
              parentId={step.id}
              workoutMode={workoutMode}
              presets={presets}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => onAddChild('run', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>
            + Add Run
          </button>
          <button onClick={() => onAddChild('recovery', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>
            + Add Recovery
          </button>
        </div>
      </div>
    );
  }

  // Leaf Step values (normalize between JSON schema and state helpers)
  const durationSec = step.duration ?? step.durationSec ?? 0;
  
  // Pace extraction
  let targetPaceSec = 0;
  if (typeof step.pace === 'object' && step.pace !== null) {
    targetPaceSec = step.pace.value ?? step.pace.start ?? 0;
  } else {
    targetPaceSec = step.targetPaceSec ?? (typeof step.pace === 'number' ? step.pace : 0);
  }

  const distanceMiles = step.distanceMiles ?? (targetPaceSec > 0 ? durationSec / targetPaceSec : 0);

  // Handlers for step updating
  const handleDurationChange = (newSec) => {
    onUpdate(step.id, 'duration', newSec);
    onUpdate(step.id, 'durationSec', newSec);
  };

  const handlePaceChange = (newSec) => {
    if (typeof step.pace === 'object' && step.pace !== null) {
      if ('value' in step.pace) {
        onUpdate(step.id, 'pace.value', newSec);
      } else {
        onUpdate(step.id, 'pace.start', newSec);
      }
    } else {
      onUpdate(step.id, 'targetPaceSec', newSec);
    }
  };

  // Distance / Time calculations
  const calculatedMiles = targetPaceSec > 0 ? durationSec / targetPaceSec : 0;
  const calculatedTimeSec = distanceMiles * targetPaceSec;

  return (
    <div
      className="step-row-container"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop && onDrop(e, parentId, index)}
    >
      <div className="step-row-inputs">
        <span className="drag-handle">⣿</span>
        <span className="step-type-label">{step.intensity || step.type || 'step'}</span>

        {workoutMode === 'time' ? (
          <label className="input-label">
            Time:{' '}
            <MMSSInput valueSec={durationSec} onChange={handleDurationChange} />
          </label>
        ) : (
          <label className="input-label">
            Dist:
            <input
              type="number"
              step="0.01"
              min="0"
              value={distanceMiles}
              onChange={(e) => onUpdate(step.id, 'distanceMiles', parseFloat(e.target.value) || 0)}
              className="time-pace-input"
              style={{ width: '60px' }}
            />
            mi
          </label>
        )}

        <label className="input-label">
          Pace:{' '}
          <MMSSInput valueSec={targetPaceSec} onChange={handlePaceChange} />
        </label>

        <span className="dist-display">
          {workoutMode === 'time'
            ? `Dist: ${formatDistance(calculatedMiles)}`
            : `Time: ${formatTime(calculatedTimeSec)}`}
        </span>

        <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
      </div>

      {/* Dynamic Presets */}
      <div className="step-presets-row">
        <span style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold' }}>Presets:</span>
        {(presets || []).map((preset) => {
          const isSelected = Math.abs(targetPaceSec - preset.targetPaceSec) < 3;

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePaceChange(preset.targetPaceSec)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '12px',
                border: `1px solid ${preset.color}`,
                backgroundColor: isSelected ? preset.color : '#ffffff',
                color: isSelected ? '#ffffff' : preset.color,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {preset.label} ({preset.displayPace})
            </button>
          );
        })}
      </div>
    </div>
  );
}