import React, { useState, useMemo, useEffect } from 'react';
import './WorkoutBuilder.css';

// Updated API Endpoint for Vercel/Vite Proxy
const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';

async function fetchFoldersApi() {
  const res = await fetch(`${VAL_WORKOUTBUILDER_URL}?action=get_folders`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch folders');
  return await res.json();
}

async function fetchWorkoutsApi(folderId = null) {
  const url = folderId 
    ? `${VAL_WORKOUTBUILDER_URL}?action=get_workouts&folder_id=${folderId}` 
    : `${VAL_WORKOUTBUILDER_URL}?action=get_workouts`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch workouts');
  return await res.json();
}

async function createFolderApi(folderName) {
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
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
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
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

// --- Helper utilities for MM:SS parsing and formatting ---
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

const createDefaultSteps = () => [
  createStep('warmup'),
  createStep('repeat'),
  createStep('cooldown'),
];

export default function WorkoutBuilder() {
  // Page Mode: 'EMPTY' | 'CREATING' | 'EDITING'
  const [mode, setMode] = useState('EMPTY');
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  // Active Workout State
  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [steps, setSteps] = useState([]);

  // Original snapshot for "Cancel Edits"
  const [originalWorkoutSnapshot, setOriginalWorkoutSnapshot] = useState(null);

  // Modal Dialog States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);

  // Folders & Workouts Data State
  const [folders, setFolders] = useState([]);
  const [workoutsList, setWorkoutsList] = useState([]);
  const [selectedEditFolderId, setSelectedEditFolderId] = useState('');

  // Form Inputs
  const [newFolderName, setNewFolderName] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [saveFolderId, setSaveFolderId] = useState('');
  const [inlineFolderInput, setInlineFolderInput] = useState('');
  const [showInlineFolderInput, setShowInlineFolderInput] = useState(false);

  // Status & Utility State
  const [apiLoading, setApiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Load Folders Helper
  const loadFolders = async () => {
    try {
      const list = await fetchFoldersApi();
      setFolders(list);
      return list;
    } catch (err) {
      setStatusMessage(`Error loading folders: ${err.message}`);
      return [];
    }
  };

  // --- Option Handlers ---

  const handleStartCreateNew = () => {
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setSteps(createDefaultSteps());
    setOriginalWorkoutSnapshot(null);
    setMode('CREATING');
    setIsOptionsMenuOpen(false);
  };

  const handleOpenEditModal = async () => {
    setIsOptionsMenuOpen(false);
    setApiLoading(true);
    const folderList = await loadFolders();
    if (folderList.length > 0) {
      const initialFolder = folderList[0].id;
      setSelectedEditFolderId(initialFolder);
      try {
        const wList = await fetchWorkoutsApi(initialFolder);
        setWorkoutsList(wList);
      } catch (err) {
        setStatusMessage(`Error fetching workouts: ${err.message}`);
      }
    }
    setApiLoading(false);
    setIsEditModalOpen(true);
  };

  const handleSelectWorkoutToEdit = (workout) => {
    setWorkoutId(workout.id);
    setWorkoutTitle(workout.name || 'Untitled Workout');
    setWorkoutDescription(workout.workout_doc?.description || '');
    setSelectedFolderId(workout.folder_id || '');

    const loadedSteps = workout.steps || createDefaultSteps();
    setSteps(loadedSteps);

    const snapshot = {
      id: workout.id,
      name: workout.name || 'Untitled Workout',
      workoutDescription: workout.workout_doc?.description || '',
      folder_id: workout.folder_id || '',
      steps: JSON.parse(JSON.stringify(loadedSteps)),
    };
    setOriginalWorkoutSnapshot(snapshot);

    setMode('EDITING');
    setIsEditModalOpen(false);
  };

  const handleCancelEdits = () => {
    setIsOptionsMenuOpen(false);
    if (!originalWorkoutSnapshot) {
      setMode('EMPTY');
      setSteps([]);
      return;
    }
    setWorkoutId(originalWorkoutSnapshot.id);
    setWorkoutTitle(originalWorkoutSnapshot.name);
    setWorkoutDescription(originalWorkoutSnapshot.workoutDescription);
    setSelectedFolderId(originalWorkoutSnapshot.folder_id);
    setSteps(JSON.parse(JSON.stringify(originalWorkoutSnapshot.steps)));
    setStatusMessage('Reverted edits to original state.');
  };

  const handleOpenCreateFolderModal = () => {
    setIsOptionsMenuOpen(false);
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const handleCreateFolderSubmit = async () => {
    if (!newFolderName.trim()) return;
    setApiLoading(true);
    try {
      const createdFolder = await createFolderApi(newFolderName);
      setFolders((prev) => [...prev, createdFolder]);
      setStatusMessage(`Created folder "${createdFolder.name}" successfully.`);
      setIsFolderModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      setStatusMessage(`Error creating folder: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const handleOpenSaveModal = async (asNew = false) => {
    setIsOptionsMenuOpen(false);
    setSaveAsNew(asNew);
    setSaveTitle(asNew ? `${workoutTitle} (Copy)` : workoutTitle);
    await loadFolders();
    setSaveFolderId(selectedFolderId || (folders.length > 0 ? folders[0].id : ''));
    setShowInlineFolderInput(false);
    setIsSaveModalOpen(true);
  };

  const handleCreateInlineFolder = async () => {
    if (!inlineFolderInput.trim()) return;
    setApiLoading(true);
    try {
      const createdFolder = await createFolderApi(inlineFolderInput);
      setFolders((prev) => [...prev, createdFolder]);
      setSaveFolderId(createdFolder.id);
      setInlineFolderInput('');
      setShowInlineFolderInput(false);
    } catch (err) {
      setStatusMessage(`Error creating folder: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const handleConfirmSaveWorkout = async () => {
    if (!saveTitle.trim()) {
      alert('Please enter a workout name.');
      return;
    }
    setApiLoading(true);
    setStatusMessage('Saving workout...');

    const targetWorkoutId = saveAsNew ? null : workoutId;
    const action = targetWorkoutId ? 'update_workout' : 'create_workout';

    const payload = { ...workoutPayloadObject, name: saveTitle, folder_id: saveFolderId ? Number(saveFolderId) : null };

    try {
      const result = await saveWorkoutApi(action, targetWorkoutId, payload);
      const finalId = result.id || targetWorkoutId;

      setWorkoutId(finalId);
      setWorkoutTitle(saveTitle);
      setSelectedFolderId(saveFolderId);

      const newSnapshot = {
        id: finalId,
        name: saveTitle,
        workoutDescription,
        folder_id: saveFolderId,
        steps: JSON.parse(JSON.stringify(steps)),
      };
      setOriginalWorkoutSnapshot(newSnapshot);

      setMode('EDITING');
      setIsSaveModalOpen(false);
      setStatusMessage(`Successfully saved workout "${saveTitle}"!`);
    } catch (err) {
      setStatusMessage(`Error saving workout: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  // Calculations & Payload Object
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

        return {
          reps: step.iterations,
          text: `Repeats ${step.iterations}x`,
          steps: childIcuSteps,
          distance: repeatMiles * step.iterations * METERS_PER_MILE,
          duration: repeatSecs * step.iterations,
        };
      }

      const baseStep = {
        duration: step.durationSec,
        pace: { units: 'secs', value: step.targetPaceSec },
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
    const totalMeters = totals.totalMiles * METERS_PER_MILE;

    const generatePrimaryDescription = (stepList, depth = 0) => {
      const indent = '  '.repeat(depth);
      return stepList
        .map((s) => {
          if (s.type === 'repeat') {
            return `${indent}Repeats ${s.iterations}x\n${generatePrimaryDescription(s.steps, depth + 1)}`;
          }
          return `${indent}- ${formatTime(s.durationSec)} @ ${formatMMSS(s.targetPaceSec)} Pace (${s.type})`;
        })
        .join('\n');
    };

    return {
      icu_training_load: Math.round(totals.totalSec / 60),
      name: workoutTitle,
      description: generatePrimaryDescription(steps), // Leaves root description as is
      type: 'Run',
      indoor: false,
      moving_time: totals.totalSec,
      updated: new Date().toISOString(),
      workout_doc: {
        steps: icuSteps,
        distance: totalMeters,
        duration: totals.totalSec,
        description: workoutDescription, // Populates workout_doc.description
      },
      folder_id: selectedFolderId ? Number(selectedFolderId) : null,
      targets: ['PACE'],
      distance: Number(totalMeters.toFixed(3)),
      icu_intensity: 80.0,
    };
  }, [steps, workoutTitle, workoutDescription, totals, selectedFolderId]);

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
      list.filter((s) => s.id !== id).map((s) => (s.type === 'repeat' ? { ...s, steps: filterRecursive(s.steps) } : s));
    setSteps(filterRecursive(steps));
  };

  const updateStepField = (id, field, value) => {
    const updateRecursive = (list) =>
      list.map((s) => {
        if (s.id === id) return { ...s, [field]: value };
        if (s.type === 'repeat') return { ...s, steps: updateRecursive(s.steps) };
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
    setSteps(insertIntoTree(treeWithoutItem, targetParentId, targetIndex, itemToMove));
    setDraggedItem(null);
  };

  return (
    <div className="workout-builder-container" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header Bar with Cascading Options Menu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Workout Builder</h1>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ⚙️ Options ▾
          </button>

          {/* Cascading Options Dropdown */}
          {isOptionsMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                width: '210px',
                backgroundColor: '#ffffff',
                boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '6px',
                zIndex: 100,
                overflow: 'hidden',
                border: '1px solid #ddd',
              }}
            >
              <button style={menuButtonStyle} onClick={handleStartCreateNew}>
                ➕ Create New Workout
              </button>

              <button style={menuButtonStyle} onClick={handleOpenEditModal}>
                ✏️ Edit Existing Workout
              </button>

              <button style={menuButtonStyle} onClick={handleOpenCreateFolderModal}>
                📁 Create New Folder
              </button>

              {(mode === 'CREATING' || mode === 'EDITING') && <div style={{ height: '1px', backgroundColor: '#eee' }} />}

              {(mode === 'CREATING' || mode === 'EDITING') && (
                <button style={menuButtonStyle} onClick={() => handleOpenSaveModal(false)}>
                  💾 Save Workout
                </button>
              )}

              {mode === 'EDITING' && (
                <button style={menuButtonStyle} onClick={() => handleOpenSaveModal(true)}>
                  📋 Save As New Workout
                </button>
              )}

              {mode === 'EDITING' && (
                <button style={{ ...menuButtonStyle, color: '#dc3545' }} onClick={handleCancelEdits}>
                  ↩️ Cancel Edits
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div style={{ padding: '10px 14px', marginBottom: '16px', backgroundColor: '#e2e3e5', color: '#383d41', borderRadius: '4px', fontSize: '13px' }}>
          {statusMessage}
        </div>
      )}

      {/* --- EMPTY STATE --- */}
      {mode === 'EMPTY' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #ccc', borderRadius: '8px', color: '#6c757d' }}>
          <h3>No Workout Selected</h3>
          <p>Click the <strong>Options</strong> button above to create a new workout or edit an existing one.</p>
        </div>
      )}

      {/* --- WORKOUT EDITOR STATE (CREATING or EDITING) --- */}
      {(mode === 'CREATING' || mode === 'EDITING') && (
        <div>
          <div className="builder-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <input
              type="text"
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              className="builder-title-input"
              placeholder="Workout Title"
              style={{ fontSize: '18px', padding: '6px 10px', width: '60%' }}
            />
            <div className="builder-totals" style={{ fontSize: '14px' }}>
              Total Time: <strong>{formatTime(totals.totalSec)}</strong> | Total Dist: <strong>{formatDistance(totals.totalMiles)}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '12px', color: '#495057', marginBottom: '4px' }}>
              Workout Description
            </label>
            <textarea
              value={workoutDescription}
              onChange={(e) => setWorkoutDescription(e.target.value)}
              placeholder="Add an optional description or notes for this workout..."
              rows={2}
              style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
            />
          </div>

          <div className="chart-card" style={{ marginBottom: '16px' }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="chart-title" style={{ fontWeight: 'bold' }}>Workout Profile Chart</span>
              <button className="btn-zoom" onClick={() => setIsZoomOpen(true)}>🔍 Zoom Chart</button>
            </div>
            <RenderWorkoutChart steps={steps} height={120} />
          </div>

          <div className="action-bar" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button className="btn-add-step" onClick={() => addStep('warmup')}>+ Warmup</button>
            <button className="btn-add-step" onClick={() => addStep('run')}>+ Run</button>
            <button className="btn-add-step" onClick={() => addStep('recovery')}>+ Recovery</button>
            <button className="btn-add-step" onClick={() => addStep('cooldown')}>+ Cooldown</button>
            <button className="btn-add-step btn-add-repeat" onClick={() => addStep('repeat')}>+ Repeat Block</button>
          </div>

          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, null, steps.length)} style={{ minHeight: '120px' }}>
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
        </div>
      )}

      {/* --- MODAL 1: Create New Folder --- */}
      {isFolderModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsFolderModalOpen(false)}>Cancel</button>
              <button onClick={handleCreateFolderSubmit} disabled={apiLoading} style={{ backgroundColor: '#007bff', color: '#fff' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Edit Existing Workout Picker --- */}
      {isEditModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, width: '480px' }}>
            <h3>Select Workout to Edit</h3>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>1. Select Folder:</label>
            <select
              value={selectedEditFolderId}
              onChange={async (e) => {
                const folderId = e.target.value;
                setSelectedEditFolderId(folderId);
                setApiLoading(true);
                try {
                  const wList = await fetchWorkoutsApi(folderId);
                  setWorkoutsList(wList);
                } catch (err) {
                  setStatusMessage(`Failed to fetch workouts: ${err.message}`);
                } finally {
                  setApiLoading(false);
                }
              }}
              style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>2. Select Workout:</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px' }}>
              {workoutsList.length === 0 ? (
                <p style={{ padding: '12px', color: '#888', margin: 0 }}>No workouts found in this folder.</p>
              ) : (
                workoutsList.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => handleSelectWorkoutToEdit(w)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <strong>{w.name}</strong>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>{formatTime(w.moving_time)}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Save / Save As Dialog --- */}
      {isSaveModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{saveAsNew ? 'Save As New Workout' : 'Save Workout'}</h3>

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Workout Name:</label>
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Select Folder:</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <select
                value={saveFolderId}
                onChange={(e) => setSaveFolderId(e.target.value)}
                style={{ flex: 1, padding: '8px' }}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowInlineFolderInput(!showInlineFolderInput)}>
                + New Folder
              </button>
            </div>

            {showInlineFolderInput && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '8px', backgroundColor: '#f8f9fa' }}>
                <input
                  type="text"
                  placeholder="New Folder Name"
                  value={inlineFolderInput}
                  onChange={(e) => setInlineFolderInput(e.target.value)}
                  style={{ flex: 1, padding: '6px' }}
                />
                <button onClick={handleCreateInlineFolder} disabled={apiLoading}>Create</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsSaveModalOpen(false)}>Cancel</button>
              <button onClick={handleConfirmSaveWorkout} disabled={apiLoading} style={{ backgroundColor: '#007bff', color: '#fff' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom View */}
      {isZoomOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsZoomOpen(false)}>
          <div style={{ ...modalContentStyle, width: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>{workoutTitle} - Profile View</h2>
              <button onClick={() => setIsZoomOpen(false)}>✕</button>
            </div>
            <RenderWorkoutChart steps={steps} height={280} />
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles for Option Dropdown and Modals
const menuButtonStyle = {
  width: '100%',
  padding: '10px 14px',
  textAlign: 'left',
  border: 'none',
  backgroundColor: 'transparent',
  fontSize: '13px',
  cursor: 'pointer',
  borderBottom: '1px solid #f0f0f0',
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: '#ffffff',
  padding: '20px',
  borderRadius: '8px',
  width: '400px',
  boxShadow: '0px 10px 25px rgba(0,0,0,0.2)',
};

// Sub-components
function MMSSInput({ valueSec, onChange }) {
  const [text, setText] = useState(formatTime(valueSec));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setText(formatTime(valueSec));
  }, [valueSec, isFocused]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    const parsedSec = parseMMSS(val);
    if (parsedSec >= 0) onChange(parsedSec);
  };

  return (
    <input
      type="text"
      value={text}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        const parsedSec = parseMMSS(text);
        setText(formatTime(parsedSec));
        onChange(parsedSec);
      }}
      className="time-pace-input"
      style={{ width: '60px', padding: '4px', fontSize: '13px' }}
    />
  );
}

function RenderStepRow({ step, index, parentId, onRemove, onUpdate, onAddChild, onDragStart, onDrop }) {
  if (step.type === 'repeat') {
    return (
      <div
        className="repeat-block-container"
        draggable
        onDragStart={(e) => onDragStart(e, step, parentId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, parentId, index)}
        style={{ border: '2px dashed #007bff', padding: '12px', marginBottom: '12px', borderRadius: '6px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ cursor: 'grab' }}>⣿</span>
          <strong>Repeat Block</strong>
          <label style={{ fontSize: '12px' }}>
            Repeats:
            <input
              type="number"
              min="1"
              max="99"
              value={step.iterations}
              onChange={(e) => onUpdate(step.id, 'iterations', parseInt(e.target.value, 10) || 1)}
              style={{ width: '44px', marginLeft: '4px' }}
            />
          </label>
          <button onClick={() => onRemove(step.id)} style={{ marginLeft: 'auto', cursor: 'pointer' }}>✕</button>
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, step.id, step.steps.length)}>
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

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => onAddChild('run', step.id)} style={{ fontSize: '12px' }}>+ Add Run</button>
          <button onClick={() => onAddChild('recovery', step.id)} style={{ fontSize: '12px' }}>+ Add Recovery</button>
        </div>
      </div>
    );
  }

  const distMiles = step.durationSec / (step.targetPaceSec || 1);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, parentId, index)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid #ddd', marginBottom: '8px', borderRadius: '4px', backgroundColor: '#fff' }}
    >
      <span style={{ cursor: 'grab' }}>⣿</span>
      <span style={{ fontWeight: 'bold', width: '70px', textTransform: 'capitalize' }}>{step.type}</span>

      <label style={{ fontSize: '12px' }}>
        Time: <MMSSInput valueSec={step.durationSec} onChange={(newSec) => onUpdate(step.id, 'durationSec', newSec)} />
      </label>

      <label style={{ fontSize: '12px' }}>
        Pace: <MMSSInput valueSec={step.targetPaceSec} onChange={(newSec) => onUpdate(step.id, 'targetPaceSec', newSec)} />
      </label>

      <span style={{ fontSize: '12px', marginLeft: 'auto' }}>
        Dist: <strong>{formatDistance(distMiles)}</strong>
      </span>

      <button onClick={() => onRemove(step.id)} style={{ cursor: 'pointer' }}>✕</button>
    </div>
  );
}

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
    <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'flex-end', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
      {flatSteps.map((step, idx) => {
        const widthPct = (step.durationSec / totalDuration) * 100;
        const currentVel = step.targetPaceSec > 0 ? 1 / step.targetPaceSec : 0;
        const barHeightPct = maxVel === minVel ? 60 : 25 + ((currentVel - minVel) / (maxVel - minVel)) * 70;
        const barColor = getZoneColor(step.targetPaceSec);

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              height: `${barHeightPct}%`,
              backgroundColor: barColor,
              borderRight: '1px solid rgba(255,255,255,0.4)',
            }}
            title={`${step.type.toUpperCase()}: ${formatTime(step.durationSec)} @ ${formatMMSS(step.targetPaceSec)}/mi`}
          />
        );
      })}
    </div>
  );
}