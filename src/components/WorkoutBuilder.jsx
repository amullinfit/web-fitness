import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Helper utilities for time (MM:SS) and distance formatting
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

// Default values for new steps based on step type
const createStep = (type) => {
  const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  switch (type) {
    case 'warmup':
      return { id, type: 'warmup', durationSec: 600, targetPaceSec: 540 }; // 10 min @ 9:00/mi
    case 'run':
      return { id, type: 'run', durationSec: 600, targetPaceSec: 480 }; // 10 min @ 8:00/mi
    case 'recovery':
      return { id, type: 'recovery', durationSec: 120, targetPaceSec: 660 }; // 2 min @ 11:00/mi
    case 'cooldown':
      return { id, type: 'cooldown', durationSec: 600, targetPaceSec: 540 }; // 10 min @ 9:00/mi
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

  // Calculate totals recursively
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

  // Handle Drag and Drop reordering across top-level and repeat blocks
  const handleOnDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const newSteps = JSON.parse(JSON.stringify(steps)); // Deep clone

    // Helper to remove item at droppableId
    const removeItem = (list, droppableId, index) => {
      if (droppableId === 'root-builder') {
        return list.splice(index, 1)[0];
      }
      for (let s of list) {
        if (s.type === 'repeat' && s.id === droppableId) {
          return s.steps.splice(index, 1)[0];
        }
      }
    };

    // Helper to insert item at droppableId
    const insertItem = (list, droppableId, index, item) => {
      if (droppableId === 'root-builder') {
        list.splice(index, 0, item);
        return;
      }
      for (let s of list) {
        if (s.type === 'repeat' && s.id === droppableId) {
          s.steps.splice(index, 0, item);
          return;
        }
      }
    };

    const movedItem = removeItem(newSteps, source.droppableId, source.index);
    if (movedItem) {
      insertItem(newSteps, destination.droppableId, destination.index, movedItem);
      setSteps(newSteps);
    }
  };

  // Step Modifiers
  const addStep = (type, parentRepeatId = null) => {
    const newStep = createStep(type);
    if (!parentRepeatId) {
      setSteps([...steps, newStep]);
    } else {
      setSteps(
        steps.map((s) =>
          s.id === parentRepeatId
            ? { ...s, steps: [...s.steps, newStep] }
            : s
        )
      );
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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* Header and Summary Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          value={workoutTitle}
          onChange={(e) => setWorkoutTitle(e.target.value)}
          style={{ fontSize: '22px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #ccc', padding: '4px' }}
        />
        <div style={{ fontSize: '16px', fontWeight: '600' }}>
          Total Time: <span style={{ color: '#007bff' }}>{formatMMSS(totals.totalSec)}</span> | 
          Total Dist: <span style={{ color: '#28a745' }}>{formatDistance(totals.totalMiles)}</span>
        </div>
      </div>

      {/* Visual Chart Section */}
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: '#fff',
          marginBottom: '20px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#666' }}>WORKOUT PROFILE CHART</span>
          <button
            onClick={() => setIsZoomOpen(true)}
            style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            🔍 Zoom Chart
          </button>
        </div>
        <RenderWorkoutChart steps={steps} height={120} />
      </div>

      {/* Action Buttons to Add Steps */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => addStep('warmup')}>+ Warmup</button>
        <button onClick={() => addStep('run')}>+ Run</button>
        <button onClick={() => addStep('recovery')}>+ Recovery</button>
        <button onClick={() => addStep('cooldown')}>+ Cooldown</button>
        <button onClick={() => addStep('repeat')} style={{ backgroundColor: '#e2e8f0' }}>+ Repeat Block</button>
      </div>

      {/* Drag and Drop Container */}
      <DragDropContext onDragEnd={handleOnDragEnd}>
        <Droppable droppableId="root-builder" type="STEP">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} style={{ minHeight: '100px' }}>
              {steps.map((step, index) => (
                <RenderStepRow
                  key={step.id}
                  step={step}
                  index={index}
                  onRemove={removeStep}
                  onUpdate={updateStepField}
                  onAddChild={addStep}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Zoom Modal (Leveraging design patterns from MonthlyView) */}
      {isZoomOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '900px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2>{workoutTitle} - Detailed Chart</h2>
              <button onClick={() => setIsZoomOpen(false)} style={{ fontSize: '18px', cursor: 'pointer' }}>
                &times;
              </button>
            </div>
            <RenderWorkoutChart steps={steps} height={350} />
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component to render individual step rows and nestable repeat containers
function RenderStepRow({ step, index, onRemove, onUpdate, onAddChild }) {
  if (step.type === 'repeat') {
    return (
      <Draggable draggableId={step.id} index={index}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{
              border: '2px dashed #007bff',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '10px',
              backgroundColor: '#f4f8ff',
              ...provided.draggableProps.style,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span {...provided.dragHandleProps} style={{ cursor: 'grab', fontSize: '18px' }}>
                ⣿
              </span>
              <strong>Repeat Block</strong>
              <label style={{ fontSize: '14px', marginLeft: '12px' }}>
                Repeats:
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={step.iterations}
                  onChange={(e) => onUpdate(step.id, 'iterations', parseInt(e.target.value, 10) || 1)}
                  style={{ width: '50px', marginLeft: '6px', padding: '2px 4px' }}
                />
              </label>
              <button
                onClick={() => onRemove(step.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Nested Droppable inside Repeat Block */}
            <Droppable droppableId={step.id} type="STEP">
              {(nestedProvided) => (
                <div
                  ref={nestedProvided.innerRef}
                  {...nestedProvided.droppableProps}
                  style={{ minHeight: '60px', padding: '6px', backgroundColor: '#ffffff', borderRadius: '6px' }}
                >
                  {step.steps.map((childStep, childIdx) => (
                    <RenderStepRow
                      key={childStep.id}
                      step={childStep}
                      index={childIdx}
                      onRemove={onRemove}
                      onUpdate={onUpdate}
                      onAddChild={onAddChild}
                    />
                  ))}
                  {nestedProvided.placeholder}
                </div>
              )}
            </Droppable>

            <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              <button onClick={() => onAddChild('run', step.id)} style={{ fontSize: '12px' }}>+ Inner Run</button>
              <button onClick={() => onAddChild('recovery', step.id)} style={{ fontSize: '12px' }}>+ Inner Recovery</button>
            </div>
          </div>
        )}
      </Draggable>
    );
  }

  // Standard step rendering (Warmup, Run, Recovery, Cooldown)
  const dist = (step.durationSec / (step.targetPaceSec || 1)).toFixed(1);

  return (
    <Draggable draggableId={step.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 12px',
            marginBottom: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '6px',
            ...provided.draggableProps.style,
          }}
        >
          <span {...provided.dragHandleProps} style={{ cursor: 'grab', fontSize: '18px', color: '#888' }}>
            ⣿
          </span>
          <span style={{ width: '80px', textTransform: 'capitalize', fontWeight: 'bold' }}>{step.type}</span>

          <label style={{ fontSize: '13px' }}>
            Time (MM:SS):
            <input
              type="text"
              value={formatMMSS(step.durationSec)}
              onChange={(e) => onUpdate(step.id, 'durationSec', parseMMSS(e.target.value))}
              style={{ width: '60px', marginLeft: '4px', textAlign: 'center' }}
            />
          </label>

          <label style={{ fontSize: '13px' }}>
            Pace (MM:SS):
            <input
              type="text"
              value={formatMMSS(step.targetPaceSec)}
              onChange={(e) => onUpdate(step.id, 'targetPaceSec', parseMMSS(e.target.value))}
              style={{ width: '60px', marginLeft: '4px', textAlign: 'center' }}
            />
          </label>

          <span style={{ fontSize: '13px', color: '#555' }}>
            Dist: <strong>{dist} mi</strong>
          </span>

          <button
            onClick={() => onRemove(step.id)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', fontSize: '16px', cursor: 'pointer' }}
            title="Remove Step"
          >
            ✕
          </button>
        </div>
      )}
    </Draggable>
  );
}

// Visual Chart Component for displaying workout profile step-by-step
function RenderWorkoutChart({ steps, height }) {
  // Flatten out workout steps considering repeat loops
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

  // Colors per type
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
    <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'flex-end', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
      {flatSteps.map((step, idx) => {
        const widthPct = (step.durationSec / totalDuration) * 100;
        // Faster paces (lower sec) get taller bar display height
        const barHeightPct = Math.min(100, Math.max(20, 1000 - (step.targetPaceSec / 60) * 80));

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