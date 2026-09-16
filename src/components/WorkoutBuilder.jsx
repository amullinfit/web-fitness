import React, { useState, useMemo, useEffect } from 'react';
import './WorkoutBuilder.css';

// --- Val Town API Integration Helpers ---
const VAL_TOWN_BASE_URL = 'https://your-username-valname.express.val.run'; // Replace with your Val Town endpoint

async function fetchFoldersApi() {
  const res = await fetch(VAL_TOWN_BASE_URL, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch folders');
  return await res.json();
}

async function createFolderApi(folderName) {
  const res = await fetch(VAL_TOWN_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create_folder',
      folderData: { name: folderName, type: 'FOLDER' },
    }),
  });
  if (!res.ok) throw new Error('Failed to create folder');
  return await res.json();
}

async function saveWorkoutApi(action, workoutId, workoutData) {
  const method = action === 'update_workout' ? 'PUT' : 'POST';
  const res = await fetch(VAL_TOWN_BASE_URL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      workoutId,
      workoutData,
    }),
  });
  if (!res.ok) throw new Error(`Failed to ${action === 'update_workout' ? 'update' : 'create'} workout`);
  return await res.json();
}

// --- Helper utilities for MM:SS and H:MM:SS parsing and formatting ---
const formatTime = (totalSeconds) => {
  const sec = totalSeconds || 0;
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatMMSS = (totalSeconds) => {
  const mins = Math.floor((totalSeconds || 0) / 60);
  const secs = (totalSeconds || 0) % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const parseMMSS = (str) => {
  if (!str) return 0;
  const cleanStr = String(str).trim();

  if (cleanStr.includes(':')) {
    const parts = cleanStr.split(':');
    if (parts.length === 3) {
      const hrs = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      const secs = parseInt(parts[2], 10) || 0;
      return hrs * 3600 + mins * 60 + secs;
    }
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }

  const num = parseInt(cleanStr, 10);
  if (isNaN(num)) return 0;

  if (num < 100) {
    return num * 60;
  } else {
    const mins = Math.floor(num / 100);
    const secs = num % 100;
    return mins * 60 + Math.min(secs, 59);
  }
};

const formatDistance = (miles) => (miles || 0).toFixed(2) + ' mi';

const getZoneColor = (paceSec) => {
  if (!paceSec || paceSec <= 0) return '#6c757d';
  if (paceSec > 570) return '#6c757d';
  if (paceSec > 510) return '#28a745';
  if (paceSec > 465) return '#ffc107';
  if (paceSec > 420) return '#fd7e14';
  return '#dc3545';
};

const getZoneId = (paceSec) => {
  if (!paceSec || paceSec <= 0) return 'Z1';
  if (paceSec > 570) return 'Z1';
  if (paceSec > 510) return 'Z2';
  if (paceSec > 465) return 'Z3';
  if (paceSec > 420) return 'Z4';
  return 'Z5';
};

const createStep = (type) => {
  const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  switch (type) {
    case 'warmup':
      return { id, type: 'warmup', durationSec: 600, targetPaceSec: 540 };
    case 'run':
      return { id, type: 'run', durationSec: 600, targetPaceSec: 480 };
    case 'recovery':
      return { id, type: 'recovery', durationSec: 120, targetPaceSec: 660 };
    case 'cooldown':
      return { id, type: 'cooldown', durationSec: 600, targetPaceSec: 540 };
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

export default function WorkoutBuilder({ existingWorkoutId = null }) {
  // Workout State
  const [workoutId, setWorkoutId] = useState(existingWorkoutId);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [docNotes, setDocNotes] = useState('NOTES ONLY');
  const [steps, setSteps] = useState([
    createStep('warmup'),
    createStep('repeat'),
    createStep('cooldown'),
  ]);

  // Folder & API UI State
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Load Folders on Mount
  useEffect(() => {
    async function loadFolders() {
      try {
        const folderList = await fetchFoldersApi();
        setFolders(folderList);
        if (folderList.length > 0 && !selectedFolderId) {
          setSelectedFolderId(folderList[0].id);
        }
      } catch (err) {
        setStatusMessage(`Error fetching folders: ${err.message}`);
      }
    }
    loadFolders();
  }, []);

  // Handle Folder Creation
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setApiLoading(true);
    try {
      const createdFolder = await createFolderApi(newFolderName);
      setFolders((prev) => [...prev, createdFolder]);
      setSelectedFolderId(createdFolder.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
      setStatusMessage('Folder created successfully!');
    } catch (err) {
      setStatusMessage(`Failed to create folder: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  // Calculations
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

  // Payload Construction Object
  const workoutPayloadObject = useMemo(() => {
    const METERS_PER_MILE = 1609.344;

    const buildIcuStep = (step) => {
      if (step.type === 'repeat') {
        const childIcuSteps = step.steps.map(buildIcuStep);
        let repeatSecs = 0;
        let repeatMiles = 0;

        step.steps.forEach((child) => {
          const s = child.durationSec || 0;
          const p = child.targetPaceSec || 1;
          repeatSecs += s;
          repeatMiles += s / p;
        });

        const totalRepeatSecs = repeatSecs * step.iterations;
        const totalRepeatMeters = repeatMiles * step.iterations * METERS_PER_MILE;

        return {
          reps: step.iterations,
          text: `Repeats ${step.iterations}x`,
          steps: childIcuSteps,
          distance: totalRepeatMeters,
          duration: totalRepeatSecs,
        };
      }

      const baseStep = {
        duration: step.durationSec,
        pace: {
          units: 'secs',
          value: step.targetPaceSec,
        },
      };

      if (step.type === 'warmup') {
        baseStep.warmup = true;
        baseStep.intensity = 'warmup';
      } else if (step.type === 'cooldown') {
        baseStep.cooldown = true;
        baseStep.intensity = 'cooldown';
      } else if (step.type === 'recovery') {
        baseStep.intensity = 'rest';
      }

      return baseStep;
    };

    const icuSteps = steps.map(buildIcuStep);

    const zoneTimesMap = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 };
    const accumulateZones = (stepList) => {
      stepList.forEach((step) => {
        if (step.type === 'repeat') {
          for (let i = 0; i < step.iterations; i++) {
            accumulateZones(step.steps);
          }
        } else {
          const zoneId = getZoneId(step.targetPaceSec);
          zoneTimesMap[zoneId] = (zoneTimesMap[zoneId] || 0) + (step.durationSec || 0);
        }
      });
    };

    accumulateZones(steps);

    const zoneTimes = Object.keys(zoneTimesMap).map((zoneKey) => ({
      id: zoneKey,
      secs: zoneTimesMap[zoneKey],
    }));

    const totalMeters = totals.totalMiles * METERS_PER_MILE;

    const generatePrimaryDescription = (stepList, depth = 0) => {
      const indent = '  '.repeat(depth);
      return stepList
        .map((s) => {
          if (s.type === 'repeat') {
            const innerText = generatePrimaryDescription(s.steps, depth + 1);
            return `${indent}Repeats ${s.iterations}x\n${innerText}`;
          }
          return `${indent}- ${formatTime(s.durationSec)} @ ${formatMMSS(s.targetPaceSec)} Pace (${s.type})`;
        })
        .join('\n');
    };

    return {
      icu_training_load: Math.round(totals.totalSec / 60),
      name: workoutTitle,
      description: generatePrimaryDescription(steps),
      type: 'Run',
      indoor: false,
      color: null,
      moving_time: totals.totalSec,
      updated: new Date().toISOString(),
      joules: 0,
      joules_above_ftp: 0,
      workout_doc: {
        steps: icuSteps,
        locales: [],
        options: {},
        distance: totalMeters,
        duration: totals.totalSec,
        zoneTimes: zoneTimes,
        description: docNotes,
        strain_score: null,
        average_watts: 0,
        normalized_power: 0,
        variability_index: null,
        polarization_index: 0,
      },
      folder_id: selectedFolderId ? Number(selectedFolderId) : null,
      day: null,
      days: null,
      plan_applied: null,
      hide_from_athlete: false,
      target: null,
      targets: ['PACE'],
      carbs_per_hour: null,
      tags: null,
      attachments: null,
      time: null,
      sub_type: null,
      for_week: false,
      distance: Number(totalMeters.toFixed(3)),
      icu_intensity: 80.0,
    };
  }, [steps, workoutTitle, docNotes, totals, selectedFolderId]);

  const buildIntervalsIcuJson = useMemo(() => {
    return JSON.stringify([workoutPayloadObject], null, 2);
  }, [workoutPayloadObject]);

  // Handle Save to Intervals.icu
  const handleSaveToIntervals = async () => {
    setApiLoading(true);
    setStatusMessage('Syncing workout with Intervals.icu...');

    try {
      const action = workoutId ? 'update_workout' : 'create_workout';
      const result = await saveWorkoutApi(action, workoutId, workoutPayloadObject);

      if (result.id && !workoutId) {
        setWorkoutId(result.id);
      }
      setStatusMessage(`Successfully ${workoutId ? 'updated' : 'created'} workout on Intervals.icu!`);
    } catch (err) {
      setStatusMessage(`Error saving workout: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

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

  // Drag and Drop
  const handleDragStart = (e, step, parentId) => {
    e.stopPropagation();
    setDraggedItem({ step, parentId });
  };

  const handleDrop = (e, targetParentId, targetIndex) => {
    e.stopPropagation();
    e.preventDefault();
    if (!draggedItem) return;

    const { step: itemToMove, parentId: sourceParentId } = draggedItem;

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
          placeholder="Workout Title"
        />
        <div className="builder-totals">
          Total Time: <span className="total-time-val">{formatTime(totals.totalSec)}</span> | 
          Total Dist: <span className="total-dist-val">{formatDistance(totals.totalMiles)}</span>
        </div>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div style={{ padding: '8px 12px', marginBottom: '12px', backgroundColor: '#e2e3e5', color: '#383d41', borderRadius: '4px', fontSize: '13px' }}>
          {statusMessage}
        </div>
      )}

      {/* Folder Selection & API Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '12px', color: '#495057', marginBottom: '4px' }}>
            Target Folder:
          </label>
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #ced4da' }}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingFolder(!isCreatingFolder)}
          style={{ marginTop: '18px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
        >
          {isCreatingFolder ? 'Cancel' : '+ New Folder'}
        </button>

        <button
          type="button"
          onClick={handleSaveToIntervals}
          disabled={apiLoading}
          style={{
            marginTop: '18px',
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {apiLoading ? 'Saving...' : workoutId ? 'Update Workout' : 'Upload to Intervals'}
        </button>
      </div>

      {/* Inline Folder Creation Form */}
      {isCreatingFolder && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <input
            type="text"
            placeholder="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            style={{ flex: 1, padding: '4px 8px', fontSize: '13px' }}
          />
          <button onClick={handleCreateFolder} disabled={apiLoading} style={{ padding: '4px 12px', fontSize: '12px' }}>
            Save Folder
          </button>
        </div>
      )}

      {/* workout_doc.description Control */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '12px', color: '#495057', marginBottom: '4px' }}>
          Workout Doc Description (Notes):
        </label>
        <textarea
          value={docNotes}
          onChange={(e) => setDocNotes(e.target.value)}
          placeholder="Enter notes for workout_doc.description (e.g. NOTES ONLY)..."
          rows={2}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '13px',
            borderRadius: '4px',
            border: '1px solid #ced4da',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Embedded Chart Preview */}
      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">Workout Profile Chart</span>
          <button className="btn-zoom" onClick={() => setIsZoomOpen(true)}>
            🔍 Zoom Chart
          </button>
        </div>
        <RenderWorkoutChart steps={steps} height={140} />
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

      {/* Intervals.icu JSON Payload Display Area */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #e9ecef' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontWeight: 'bold', color: '#495057', fontSize: '14px' }}>
            Intervals.icu Workout JSON Payload (Read-Only)
          </label>
          <button
            onClick={() => navigator.clipboard.writeText(buildIntervalsIcuJson)}
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              cursor: 'pointer',
              backgroundColor: '#e9ecef',
              border: '1px solid #ced4da',
              borderRadius: '4px',
            }}
          >
            📋 Copy JSON
          </button>
        </div>
        <textarea
          readOnly
          value={buildIntervalsIcuJson}
          rows={16}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: '12px',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #333',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
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

// Editable Time/Pace Input component
function MMSSInput({ valueSec, onChange }) {
  const [text, setText] = useState(formatTime(valueSec));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(formatTime(valueSec));
    }
  }, [valueSec, isFocused]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);

    const parsedSec = parseMMSS(val);
    if (parsedSec >= 0) {
      onChange(parsedSec);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsedSec = parseMMSS(text);
    setText(formatTime(parsedSec));
    onChange(parsedSec);
  };

  return (
    <input
      type="text"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className="time-pace-input"
      placeholder="00:00"
    />
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

  const distMiles = step.durationSec / (step.targetPaceSec || 1);

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
        <MMSSInput
          valueSec={step.durationSec}
          onChange={(newSec) => onUpdate(step.id, 'durationSec', newSec)}
        />
      </label>

      <label className="input-label">
        Pace:
        <MMSSInput
          valueSec={step.targetPaceSec}
          onChange={(newSec) => onUpdate(step.id, 'targetPaceSec', newSec)}
        />
      </label>

      <span className="dist-display">
        Dist: <strong>{formatDistance(distMiles)}</strong>
      </span>

      <button className="btn-remove" onClick={() => onRemove(step.id)} title="Remove Step">
        ✕
      </button>
    </div>
  );
}

// Visual workout profile chart component
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

  const velocities = flatSteps.map((s) => (s.targetPaceSec > 0 ? 1 / s.targetPaceSec : 0));
  const maxVel = Math.max(...velocities, 0.0001);
  const minVel = Math.min(...velocities, maxVel);

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
        const currentVel = step.targetPaceSec > 0 ? 1 / step.targetPaceSec : 0;

        let barHeightPct = 20;
        if (maxVel === minVel) {
          barHeightPct = 60;
        } else {
          barHeightPct = 25 + ((currentVel - minVel) / (maxVel - minVel)) * 70;
        }

        const barColor = getZoneColor(step.targetPaceSec);

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              height: `${barHeightPct}%`,
              backgroundColor: barColor,
              borderRight: '1px solid rgba(255,255,255,0.4)',
              transition: 'height 0.2s ease, width 0.2s ease, background-color 0.2s ease',
            }}
            title={`${step.type.toUpperCase()}: ${formatTime(step.durationSec)} @ ${formatMMSS(step.targetPaceSec)}/mi`}
          />
        );
      })}
    </div>
  );
}