import React, { useState, useMemo } from 'react';
import './WorkoutBuilder.css';

// Helper utilities for MM:SS parsing and formatting
const formatMMSS = (totalSeconds) => {
  const mins = Math.floor((totalSeconds || 0) / 60);
  const secs = (totalSeconds || 0) % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const parseMMSS = (str) => {
  const parts = str.split(':');
  if (parts.length !== 2) return 0;
  const mins = parseInt(parts[0], 10) || 0;
  const secs = parseInt(parts[1], 10) || 0;
  return mins * 60 + secs;
};

const formatDistance = (miles) => (miles || 0).toFixed(1) + ' mi';

// Helper factory to initialize defaults by type
const createStep = (type) => {
  const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  switch (type) {
    case 'warmup':
      return { id, type: 'warmup', durationSec: 600, targetPaceSec: 540 }; // 10:00 @ 9:00/mi
    case 'run':
      return { id, type: 'run', durationSec: 600, targetPaceSec: 480 }; // 10:00 @ 8:00/mi
    case 'recovery':
      return { id, type: 'recovery', durationSec: 120, targetPaceSec: 660 }; // 02:00 @ 11:00/mi
    case 'cooldown':
      return { id, type: 'cooldown', durationSec: 600, targetPaceSec: 540 }; // 10:00 @ 9:00/mi
    case 'repeat':
      return {
        id,
        type: 'repeat',
        iterations: 3,
        steps: [createStep('run'), createStep('recovery')],
      };
    default:
      return { id, type: 'run', durationSec: 600, targetPaceSec: 480 };
  }
};

export default function WorkoutBuilder() {
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [steps, setSteps] = useState([
    createStep('warmup'),
    createStep('repeat'),
    createStep('cooldown'),
  ]);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Total time and total distance calculations
  const calculateTotals = (stepList) => {
    let totalSec = 0;
    let totalMiles = 0;

    stepList.forEach((step) => {
      if (step.type === 'repeat') {
        const nested = calculateTotals(step.steps);
        totalSec += nested.totalSec * step.iterations;
        totalMiles += nested.totalMiles * step.iterations;
      } else {
        const sec = step.durationSec || 0;
        const pace = step.targetPaceSec || 1;
        totalSec += sec;
        totalMiles += sec / pace;
      }
    });

    return { totalSec, totalMiles };
  };

  const totals = useMemo(() => calculateTotals(steps), [steps]);

  // Step Modification Handlers
  const addStep = (type, parentRepeatId = null) => {
    const newStep = createStep(type);
    if (!parentRepeatId) {
      setSteps([...steps, newStep]);
    } else {
      const addRecursive = (list) =>
        list.map((s) => {
          if (s.id === parentRepeatId && s.type === 'repeat') {
            return { ...s, steps: [...s.steps, newStep] };
          }
          if (s.type === 'repeat') {
            return { ...s, steps: addRecursive(s.steps) };
          }
          return s;
        });
      setSteps(addRecursive(steps));
    }
  };

  const removeStep = (id) => {
    const filterRecursive = (list) =>
      list
        .filter((s) => s.id !== id)
        .map((s) =>
          s.type === 'repeat'
            ? { ...s, steps: filterRecursive(s.steps) }
            : s
        );
    setSteps(filterRecursive(steps));
  };

  const updateStepField = (id, field, value) => {
    const updateRecursive = (list) =>
      list.map((s) => {
        if (s.id === id) {
          return { ...s, [field]: value };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: updateRecursive(s.steps) };
        }
        return s;
      });
    setSteps(updateRecursive(steps));
  };

  // Native HTML5 Drag and Drop handlers
  const handleDragStart = (e, step, parentId) => {
    e.stopPropagation();
    setDraggedItem({ step, parentId });
  };

  const handleDrop = (e, targetParentId, targetIndex) => {
    e.stopPropagation();
    e.preventDefault();
    if (!draggedItem) return;

    const { step: itemToMove, parentId: sourceParentId } = draggedItem;

    // Helper to extract item from source
    const removeFromTree = (list, parentId, stepId) => {
      if (!parentId) return list.filter((s) => s.id !== stepId);
      return list.map((s) => {
        if (s.id === parentId && s.type === 'repeat') {
          return { ...s, steps: s.steps.filter((child) => child.id !== stepId) };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: removeFromTree(s.steps, parentId, stepId) };
        }
        return s;
      });
    };

    // Helper to insert item into target
    const insertIntoTree = (list, parentId, index, item) => {
      if (!parentId) {
        const copy = [...list];
        copy.splice(index, 0, item);
        return copy;
      }
      return list.map((s) => {
        if (s.id === parentId && s.type === 'repeat') {
          const nextSteps = [...s.steps];
          nextSteps.splice(index, 0, item);
          return { ...s, steps: nextSteps };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: insertIntoTree(s.steps, parentId, index, item) };
        }
        return s;
      });
    };

    const treeWithoutItem = removeFromTree(steps, sourceParentId, itemToMove.id);
    const updatedTree = insertIntoTree(treeWithoutItem, targetParentId, targetIndex, itemToMove);

    setSteps(updatedTree);
    setDraggedItem(null);
  };

  return (
    <div className="workout-builder-container">
      {/* Title and Dynamic Totals */}
      <div className="builder-header">
        <input
          type="text"
          value={workoutTitle}
          onChange={(e) => setWorkoutTitle(e.target.value)}
          className="builder-title-input"
        />
        <div className="builder-totals">
          Total Time: <span className="total-time-val">{formatMMSS(totals.totalSec)}</span> | 
          Total Dist: <span className="total-dist-val">{formatDistance(totals.totalMiles)}</span>
        </div>
      </div>

      {/* Embedded Chart Preview */}
      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">Workout Profile Chart</span>
          <button className="btn-zoom" onClick={() => setIsZoomOpen(true)}>
            🔍 Zoom Chart
          </button>
        </div>
        <RenderWorkoutChart steps={steps} height={120} />
      </div>

      {/* Add Step Action Controls */}
      <div className="action-bar">
        <button className="btn-add-step" onClick={() => addStep('warmup')}>+ Warmup</button>
        <button className="btn-add-step" onClick={() => addStep('run')}>+ Run</button>
        <button className="btn-add-step" onClick={() => addStep('recovery')}>+ Recovery</button>
        <button className="btn-add-step" onClick={() => addStep('cooldown')}>+ Cooldown</button>
        <button className="btn-add-step btn-add-repeat" onClick={() => addStep('repeat')}>+ Repeat Block</button>
      </div>

      {/* Root Drag and Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, null, steps.length)}
        style={{ minHeight: '120px' }}
      >
        {steps.map((step, index) => (
          <RenderStepRow
            key={step.id}
            step={step}
            index={index}
            parentId={null}
            onRemove={removeStep}
            onUpdate={updateStepField}
            onAddChild={addStep}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Modal Zoom View */}
      {isZoomOpen && (
        <div className="modal-overlay" onClick={() => setIsZoomOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{workoutTitle} - Detailed Visual Profile</h2>
              <button className="btn-modal-close" onClick={() => setIsZoomOpen(false)}>
                &times;
              </button>
            </div>
            <RenderWorkoutChart steps={steps} height={320} />
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component to render step items and nestable repeat blocks
function RenderStepRow({ step, index, parentId, onRemove, onUpdate, onAddChild, onDragStart, onDrop }) {
  if (step.type === 'repeat') {
    return (
      <div
        className="repeat-block-container"
        draggable
        onDragStart={(e) => onDragStart(e, step, parentId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, parentId, index)}
      >
        <div className="repeat-header">
          <span className="drag-handle" title="Drag to reorder block">⣿</span>
          <strong>Repeat Block</strong>
          <label className="input-label" style={{ marginLeft: '12px' }}>
            Repeats:
            <input
              type="number"
              min="1"
              max="99"
              value={step.iterations}
              onChange={(e) => onUpdate(step.id, 'iterations', parseInt(e.target.value, 10) || 1)}
              className="time-pace-input"
              style={{ width: '48px' }}
            />
          </label>
          <button className="btn-remove" onClick={() => onRemove(step.id)} title="Remove Repeat Block">
            ✕
          </button>
        </div>

        {/* Inner nested drop zone */}
        <div
          className="repeat-inner-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop(e, step.id, step.steps.length)}
        >
          {step.steps.map((childStep, childIdx) => (
            <RenderStepRow
              key={childStep.id}
              step={childStep}
              index={childIdx}
              parentId={step.id}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </div>

        <div className="action-bar" style={{ marginTop: '8px', marginBottom: 0 }}>
          <button className="btn-add-step" style={{ fontSize: '12px' }} onClick={() => onAddChild('run', step.id)}>
            + Add Run to Block
          </button>
          <button className="btn-add-step" style={{ fontSize: '12px' }} onClick={() => onAddChild('recovery', step.id)}>
            + Add Recovery to Block
          </button>
        </div>
      </div>
    );
  }

  // Standard step row (Warmup, Run, Recovery, Cooldown)
  const dist = (step.durationSec / (step.targetPaceSec || 1)).toFixed(1);

  return (
    <div
      className="step-row"
      draggable
      onDragStart={(e) => onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, parentId, index)}
    >
      <span className="drag-handle" title="Drag to reorder step">⣿</span>
      <span className="step-type-label">{step.type}</span>

      <label className="input-label">
        Time:
        <input
          type="text"
          value={formatMMSS(step.durationSec)}
          onChange={(e) => onUpdate(step.id, 'durationSec', parseMMSS(e.target.value))}
          className="time-pace-input"
        />
      </label>

      <label className="input-label">
        Pace:
        <input
          type="text"
          value={formatMMSS(step.targetPaceSec)}
          onChange={(e) => onUpdate(step.id, 'targetPaceSec', parseMMSS(e.target.value))}
          className="time-pace-input"
        />
      </label>

      <span className="dist-display">
        Dist: <strong>{dist} mi</strong>
      </span>

      <button className="btn-remove" onClick={() => onRemove(step.id)} title="Remove Step">
        ✕
      </button>
    </div>
  );
}

// Visual workout bar chart component
function RenderWorkoutChart({ steps, height }) {
  const flattenSteps = (list) => {
    let result = [];
    list.forEach((s) => {
      if (s.type === 'repeat') {
        for (let i = 0; i < s.iterations; i++) {
          result = result.concat(flattenSteps(s.steps));
        }
      } else {
        result.push(s);
      }
    });
    return result;
  };

  const flatSteps = flattenSteps(steps);
  const totalDuration = flatSteps.reduce((acc, curr) => acc + curr.durationSec, 0) || 1;

  const getTypeColor = (type) => {
    switch (type) {
      case 'warmup': return '#ffc107';
      case 'run': return '#28a745';
      case 'recovery': return '#17a2b8';
      case 'cooldown': return '#6c757d';
      default: return '#007bff';
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        display: 'flex',
        alignItems: 'flex-end',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {flatSteps.map((step, idx) => {
        const widthPct = (step.durationSec / totalDuration) * 100;
        const barHeightPct = Math.min(100, Math.max(25, 1000 - (step.targetPaceSec / 60) * 75));

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              height: `${barHeightPct}%`,
              backgroundColor: getTypeColor(step.type),
              borderRight: '1px solid rgba(255,255,255,0.4)',
              transition: 'all 0.2s ease',
            }}
            title={`${step.type.toUpperCase()}: ${formatMMSS(step.durationSec)} @ ${formatMMSS(step.targetPaceSec)}/mi`}
          />
        );
      })}
    </div>
  );
}