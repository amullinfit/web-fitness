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

  if (step.type === 'repeat') {
    const childSteps = step.steps || [];
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
              value={step.iterations || 1}
              onChange={(e) => onUpdate(step.id, 'iterations', parseInt(e.target.value, 10) || 1)}
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
          <button onClick={() => onAddChild('run', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>+ Add Run</button>
          <button onClick={() => onAddChild('recovery', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>+ Add Recovery</button>
        </div>
      </div>
    );
  }

  // Calculated counterpart display
  const calculatedMiles = (step.durationSec || 0) / (step.targetPaceSec || 1);
  const calculatedTimeSec = (step.distanceMiles || 0) * (step.targetPaceSec || 1);

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
        <span className="step-type-label">{step.type || 'step'}</span>

        {workoutMode === 'time' ? (
          <label className="input-label">
            Time: <MMSSInput valueSec={step.durationSec} onChange={(newSec) => onUpdate(step.id, 'durationSec', newSec)} />
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
          Pace: <MMSSInput valueSec={step.targetPaceSec} onChange={(newSec) => onUpdate(step.id, 'targetPaceSec', newSec)} />
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
          const isSelected = Math.abs((step.targetPaceSec || 0) - preset.targetPaceSec) < 3;

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onUpdate(step.id, 'targetPaceSec', preset.targetPaceSec)}
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