//
// RenderStepRow.jsx
//
import React from 'react';
import MMSSInput from './MMSSInput';
import { formatTime, formatMMSS } from './WorkoutBuilderHelpers.js';

// Helper function to guarantee strictly 2 decimal places (#.00)
const formatDistanceFixed = (miles) => {
  const val = Number(miles) || 0;
  return `${val.toFixed(2)} mi`;
};

// ControlBar Component
export function ControlBar({ workoutMode, setWorkoutMode, thresholdPaceSec, paceMethod, setPaceMethod }) {
  return (
    <div className="step-controls-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
      <div className="mode-toggle-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label className="input-label">
          Step Mode:
        </label>
        <select
          value={workoutMode}
          onChange={(e) => setWorkoutMode(e.target.value)}
          className="pace-method-select"
        >
          <option value="time">⏱ Time</option>
          <option value="distance">📏 Distance</option>
        </select>
      </div>

      <div className="pace-method-group" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label className="input-label">
          Pace Method:
        </label>
        <select
          value={paceMethod}
          onChange={(e) => setPaceMethod(e.target.value)}
          className="pace-method-select"
        >
          <option value="Pace">Pace</option>
          <option value="Pace Range">Pace Range</option>
          <option value="Zone">Zone</option>
          <option value="Zone Range">Zone Range</option>
          <option value="Threshold %">Threshold %</option>
          <option value="Threshold % Range">Threshold % Range</option>
        </select>
      </div>
    </div>
  );
}

// Dynamic Preset buttons 
function StepPresets({ presets, targetPaceSec, onSelectPace }) {
  const presetList = presets || [];
  if (presetList.length === 0) return null;

  const row1 = presetList.slice(0, 4);
  const row2 = presetList.slice(4);

  const renderButton = (preset) => {
    const isSelected = Math.abs(targetPaceSec - preset.targetPaceSec) < 3;
    return (
      <button
        key={preset.label}
        type="button"
        onClick={() => onSelectPace(preset.targetPaceSec)}
        style={{
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: '600',
          borderRadius: '12px',
          border: `1px solid ${preset.color}`,
          backgroundColor: isSelected ? preset.color : '#ffffff',
          color: isSelected ? '#ffffff' : preset.color,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          width: '100%'
        }}
      >
        {preset.label} ({preset.displayPace})
      </button>
    );
  };

  return (
    <div className="step-presets-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
      <label className="input-label" style={{ paddingTop: '2px' }}>
        Presets:
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {row1.map(renderButton)}
        </div>
        {row2.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {row2.map(renderButton)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RenderStepRow({
  step,
  index,
  parentId,
  globalWorkoutMode,
  globalPaceMethod,
  thresholdPaceSec,
  presets,
  onRemove,
  onUpdate,
  onAddChild,
  onDragStart,
  onDrop
}) {
  if (!step) return null;

  // Local step modes fallback to step-level property or global parent defaults
  const stepMode = step.stepMode || globalWorkoutMode || 'time';
  const paceMethod = step.paceMethod || globalPaceMethod || 'Pace';

  const setStepMode = (newMode) => {
    onUpdate(step.id, 'stepMode', newMode);
  };

  const setPaceMethod = (newMethod) => {
    onUpdate(step.id, 'paceMethod', newMethod);
  };

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
              globalWorkoutMode={globalWorkoutMode}
              globalPaceMethod={globalPaceMethod}
              thresholdPaceSec={thresholdPaceSec}
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

  // Leaf Step values
  const durationSec = step.duration ?? step.durationSec ?? 0;
  
  let targetPaceSec = 0;
  if (typeof step.pace === 'object' && step.pace !== null) {
    targetPaceSec = step.pace.value ?? step.pace.start ?? 0;
  } else {
    targetPaceSec = step.targetPaceSec ?? (typeof step.pace === 'number' ? step.pace : 0);
  }

  const distanceMiles = step.distanceMiles ?? (targetPaceSec > 0 ? durationSec / targetPaceSec : 0);

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

  const calculatedMiles = targetPaceSec > 0 ? durationSec / targetPaceSec : 0;
  const calculatedTimeSec = distanceMiles * targetPaceSec;

  return (
    <div
      className="step-row-container"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop && onDrop(e, parentId, index)}
      style={{ marginBottom: '12px', border: '1px solid #e0e0e0', padding: '10px', borderRadius: '8px' }}
    >
      {/* Step Inputs */}
      <div className="step-row-inputs" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span className="drag-handle">⣿</span>
        <span className="step-type-label">{step.intensity || step.type || 'step'}</span>

        {stepMode === 'time' ? (
          <label className="input-label">
            Time:{' '}
            <MMSSInput valueSec={durationSec} onChange={handleDurationChange} />
          </label>
        ) : (
          <label className="input-label">
            Dist:{' '}
            <input
              type="number"
              step="0.01"
              min="0"
              value={Number(distanceMiles).toFixed(2)}
              onChange={(e) => onUpdate(step.id, 'distanceMiles', parseFloat(e.target.value) || 0)}
              className="time-pace-input"
              style={{ width: '68px', padding: '2px 4px' }}
            />
            mi
          </label>
        )}

        <label className="input-label">
          Pace:{' '}
          <MMSSInput valueSec={targetPaceSec} onChange={handlePaceChange} />
        </label>

        <span className="dist-display">
          {stepMode === 'time'
            ? `Dist: ${formatDistanceFixed(calculatedMiles)}`
            : `Time: ${formatTime(calculatedTimeSec)}`}
        </span>

        <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
      </div>

      {/* Dynamic Presets */}
      <StepPresets
        presets={presets}
        targetPaceSec={targetPaceSec}
        onSelectPace={handlePaceChange}
      />

      {/* ControlBar positioned below presets */}
      <ControlBar
        workoutMode={stepMode}
        setWorkoutMode={setStepMode}
        paceMethod={paceMethod}
        setPaceMethod={setPaceMethod}
        thresholdPaceSec={thresholdPaceSec}
      />
    </div>
  );
}