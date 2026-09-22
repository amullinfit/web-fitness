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

  // 1. REPEAT STEP IDENTIFICATION (JSON2 vs JSON1)
  const isRepeat = step.type === 'repeat' || Boolean(step.reps) || (Array.isArray(step.steps) && step.steps.length > 0);

  if (isRepeat) {
    const childSteps = step.steps || [];
    const repeatCount = step.reps ?? step.iterations ?? 1;

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
          <strong className="repeat-type-title">Repeat</strong>
          <label style={{ fontSize: '12px' }}>
            Repeats:
            <input
              type="number"
              min="1"
              max="99"
              value={repeatCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                // Update 'reps' for JSON2, falling back to 'iterations' for JSON1
                const fieldName = step.reps !== undefined ? 'reps' : 'iterations';
                onUpdate(step.id, fieldName, val);
              }}
              style={{ width: '44px', marginLeft: '4px' }}
            />
          </label>
          <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop && onDrop(e, step.id, childSteps.length)}>
          {childSteps.map((childStep, childIdx) => (
            <RenderStepRow
              key={childStep.id || childIdx}
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
          <button onClick={() => onAddChild('active', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>+ Add Run</button>
          <button onClick={() => onAddChild('recovery', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>+ Add Recovery</button>
        </div>
      </div>
    );
  }

  // 2. REGULAR STEP DATA EXTRACTION (JSON2 vs JSON1)
  const stepType = step.type || step.intensity || (step.warmup ? 'warmup' : step.cooldown ? 'cooldown' : 'step');
  const durationSec = step.durationSec ?? step.duration ?? 0;
  
  // Pace in JSON2 can be an object ({ value: 610 }) or range ({ start: 480, end: 555 })
  const targetPaceSec = step.targetPaceSec ?? step.pace?.value ?? step.pace?.start ?? 0;

  // Calculated distance / time
  const calculatedMiles = durationSec / (targetPaceSec || 1);
  const calculatedTimeSec = (step.distanceMiles || 0) * (targetPaceSec || 1);

  // Helper to handle pace updates inside nested pace objects for JSON2
  const handlePaceChange = (newSec) => {
    if (step.pace && typeof step.pace === 'object') {
      const updatedPace = { ...step.pace, value: newSec, start: newSec };
      onUpdate(step.id, 'pace', updatedPace);
    } else {
      onUpdate(step.id, 'targetPaceSec', newSec);
    }
  };

  // Helper to handle duration updates
  const handleDurationChange = (newSec) => {
    const durationField = step.durationSec !== undefined ? 'durationSec' : 'duration';
    onUpdate(step.id, durationField, newSec);
  };

  return (
    <div
      className="step-row-container"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop && onDrop(e, parentId, index)}
    >
      {/* Top Row: Inputs */}
      <div className="step-row-inputs">
        <span className="drag-handle">⣿</span>
        <span className="step-type-label">{stepType}</span>

        {workoutMode === 'time' ? (
          <label className="input-label">
            Time: <MMSSInput valueSec={durationSec} onChange={handleDurationChange} />
          </label>
        ) : (
          <label className="input-label">
            Dist:
            <input
              type="number"
              step="0.01"
              min="0"
              value={step.distanceMiles || 0}
              onChange={(e) => onUpdate(step.id, 'distanceMiles', parseFloat(e.target.value) || 0)}
              className="time-pace-input"
              style={{ width: '60px' }}
            />
            mi
          </label>
        )}

        <label className="input-label">
          Pace: <MMSSInput valueSec={targetPaceSec} onChange={handlePaceChange} />
        </label>

        <span className="dist-display">
          {workoutMode === 'time'
            ? `Dist: ${formatDistance(calculatedMiles)}`
            : `Time: ${formatTime(calculatedTimeSec)}`}
        </span>

        <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
      </div>

      {/* Bottom Row: Dynamic Presets */}
      <div className="step-presets-row">
        <span style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold' }}>Presets:</span>
        {(presets || []).map((preset) => {
          const isSelected = Math.abs((targetPaceSec || 0) - preset.targetPaceSec) < 3;

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