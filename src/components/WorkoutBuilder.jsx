import React, { useState, useMemo, useEffect } from 'react';
import WorkoutChart from './WorkoutChart';
import '../CSS/WorkoutBuilder.css';
import { OptionsMenu, ControlBar } from '../utils/WorkoutBuilderMenus';
import { convertWorkoutToTargetFormat } from "../utils/WorkoutConverter.js";

import { usePaces } from '../utils/PacesContext.jsx'; 

import CreateFolderModal from './modals/Modal_Folder_Create';
import EditWorkoutModal from './modals/Modal_Workout_Edit';
import SaveWorkoutModal from './modals/Modal_Workout_Save';
import ZoomWorkoutModal from './modals/Modal_Workout_Zoom';

import { 
  fetchFoldersApi, 
  fetchWorkoutsApi, 
  createFolderApi, 
  saveWorkoutApi, 
  fetchMyPacesApi,
  formatTime,
  formatMMSS,
  parseMMSS,
  convertToPaceSec,
  formatDistance,
  calculateDynamicPresets,
  createStep,
  createDefaultSteps,
  mapIcuDocToSteps,
  downloadFile,
  PRESET_COLORS,
  DEFAULT_THRESHOLD
} from '../utils/WorkoutBuilderHelpers.js';

export default function WorkoutBuilder() {
  const { paces, loading: pacesLoading } = usePaces();

  const [mode, setMode] = useState('EMPTY');
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [steps, setSteps] = useState([]);

  // New Workout settings state
  const [workoutMode, setWorkoutMode] = useState('time'); // 'time' | 'distance'
  const [paceMethod, setPaceMethod] = useState('Pace'); 

  const [originalWorkoutSnapshot, setOriginalWorkoutSnapshot] = useState(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);

  const [folders, setFolders] = useState([]);
  const [workoutsList, setWorkoutsList] = useState([]);
  const [selectedEditFolderId, setSelectedEditFolderId] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [saveFolderId, setSaveFolderId] = useState('');
  const [inlineFolderInput, setInlineFolderInput] = useState('');
  const [showInlineFolderInput, setShowInlineFolderInput] = useState(false);

  const [apiLoading, setApiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  
  // Compute preset values dynamically using useMemo inside the component
  const dynamicPresets = useMemo(() => {
    return calculateDynamicPresets(paces, paces.threshhold_pace, paceMethod);
  }, [paces, paceMethod]);

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

  const handleStartCreateNew = () => {
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setSteps(createDefaultSteps(workoutMode));
    setOriginalWorkoutSnapshot(null);
    setMode('CREATING');
    setIsOptionsMenuOpen(false);
  };

  const handleOpenEditModal = async () => {
    setIsOptionsMenuOpen(false);
    setApiLoading(true);
    try {
      const folderList = await loadFolders();
      if (folderList.length > 0) {
        const initialFolder = folderList[0];
        setSelectedEditFolderId(initialFolder.id);

        if (Array.isArray(initialFolder.children)) {
          setWorkoutsList(initialFolder.children);
        } else {
          const wList = await fetchWorkoutsApi(initialFolder.id);
          setWorkoutsList(wList);
        }
      }
      setIsEditModalOpen(true);
    } catch (err) {
      setStatusMessage(`Error opening edit dialog: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSelectWorkoutToEdit = (workout) => {
    try {
      const loadedSteps = mapIcuDocToSteps(workout);
      setWorkoutId(workout.id);
      setWorkoutTitle(workout.name || 'Untitled Workout');
      setWorkoutDescription(workout.workout_doc?.description || workout.description || '');
      setSelectedFolderId(workout.folder_id || '');
      setSteps(loadedSteps);

      setOriginalWorkoutSnapshot({
        id: workout.id,
        name: workout.name || 'Untitled Workout',
        workoutDescription: workout.workout_doc?.description || workout.description || '',
        folder_id: workout.folder_id || '',
        steps: JSON.parse(JSON.stringify(loadedSteps)),
      });

      setMode('EDITING');
      setIsEditModalOpen(false);
    } catch (err) {
      setStatusMessage(`Failed to load selected workout: ${err.message}`);
    }
  };

  const hasUnsavedChanges = () => {
    if (mode === 'CREATING') {
      return steps.length > 0 || workoutTitle !== 'New Workout' || workoutDescription !== '';
    }
    if (mode === 'EDITING' && originalWorkoutSnapshot) {
      const currentSnapshot = {
        id: workoutId,
        name: workoutTitle,
        workoutDescription,
        folder_id: selectedFolderId,
        steps,
      };
      return JSON.stringify(currentSnapshot) !== JSON.stringify(originalWorkoutSnapshot);
    }
    return false;
  };

  const handleDuplicateWorkout = () => {
    setIsOptionsMenuOpen(false);
    const newTitle = workoutTitle ? `${workoutTitle} (Copy)` : 'New Workout (Copy)';
    setMode('CREATING');
    setWorkoutId(null);
    setWorkoutTitle(newTitle);
    setSteps(JSON.parse(JSON.stringify(steps)));
    setOriginalWorkoutSnapshot(null);
    setStatusMessage(`Duplicated workout as "${newTitle}". Save when ready.`);
  };

  const handleCloseWorkout = () => {
    setIsOptionsMenuOpen(false);
    if (hasUnsavedChanges()) {
      const confirmClose = window.confirm(
        'You have unsaved changes in this workout. Are you sure you want to close it and lose your changes?'
      );
      if (!confirmClose) return;
    }
    setMode('EMPTY');
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setSteps([]);
    setOriginalWorkoutSnapshot(null);
    setStatusMessage('Closed current workout.');
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
      setStatusMessage(`Created folder "${createdFolder.name || newFolderName}" successfully.`);
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

    setApiLoading(true);
    const loadedFolders = await loadFolders();
    setSaveFolderId(selectedFolderId || (loadedFolders.length > 0 ? loadedFolders[0].id : ''));
    setShowInlineFolderInput(false);
    setApiLoading(false);

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

  const calculateTotals = (stepList, currentMode = workoutMode) => {
    let totalSec = 0;
    let totalMiles = 0;

    if (!Array.isArray(stepList)) return { totalSec, totalMiles };

    stepList.forEach((step) => {
      if (step.type === 'repeat') {
        const nested = calculateTotals(step.steps || [], currentMode);
        totalSec += nested.totalSec * (step.iterations || 1);
        totalMiles += nested.totalMiles * (step.iterations || 1);
      } else {
        const pace = step.targetPaceSec || 1;
        if (currentMode === 'distance') {
          const miles = step.distanceMiles || 0;
          totalMiles += miles;
          totalSec += miles * pace;
        } else {
          const sec = step.durationSec || 0;
          totalSec += sec;
          totalMiles += sec / pace;
        }
      }
    });

    return { totalSec, totalMiles };
  };

  const totals = useMemo(() => calculateTotals(steps, workoutMode), [steps, workoutMode]);

  const generateIcuText = (stepList) => {
    if (!Array.isArray(stepList)) return '';
    const lines = [];

    const processSteps = (list) => {
      list.forEach((s) => {
        if (s.type === 'repeat') {
          lines.push(`\n${s.iterations}x`);
          processSteps(s.steps || []);
          lines.push('');
        } else {
          const durStr = workoutMode === 'distance' 
            ? `${(s.distanceMiles || 0).toFixed(2)}mi` 
            : formatTime(s.durationSec);
          lines.push(`- ${durStr} @ ${formatMMSS(s.targetPaceSec)} Pace (${s.type})`);
        }
      });
    };

    processSteps(stepList);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const handleCopyWorkoutText = () => {
    setIsOptionsMenuOpen(false);
    const text = generateIcuText(steps);
    navigator.clipboard.writeText(text);
    setStatusMessage('Workout text copied to clipboard!');
  };

  const workoutPayloadObject = useMemo(() => {
    const METERS_PER_MILE = 1609.344;

    const buildIcuStep = (step) => {
      if (step.type === 'repeat') {
        const childIcuSteps = (step.steps || []).map(buildIcuStep);
        let repeatSecs = 0;
        let repeatMiles = 0;

        (step.steps || []).forEach((child) => {
          const p = child.targetPaceSec || 1;
          if (workoutMode === 'distance') {
            const m = child.distanceMiles || 0;
            repeatMiles += m;
            repeatSecs += m * p;
          } else {
            const s = child.durationSec || 0;
            repeatSecs += s;
            repeatMiles += s / p;
          }
        });

        return {
          reps: step.iterations || 1,
          text: `Repeats ${step.iterations || 1}x`,
          steps: childIcuSteps,
          distance: repeatMiles * (step.iterations || 1) * METERS_PER_MILE,
          duration: repeatSecs * (step.iterations || 1),
        };
      }

      const stepSecs = workoutMode === 'distance' 
        ? (step.distanceMiles || 0) * (step.targetPaceSec || 1) 
        : (step.durationSec || 0);

      const baseStep = {
        duration: stepSecs,
        pace: { units: 'secs', value: step.targetPaceSec || 0 },
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

    const icuSteps = (steps || []).map(buildIcuStep);
    const totalMeters = totals.totalMiles * METERS_PER_MILE;

    return {
      id: workoutId || 1,
      icu_training_load: Math.round(totals.totalSec / 60),
      name: workoutTitle,
      description: generateIcuText(steps),
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
        description: workoutDescription,
      },
      folder_id: saveFolderId ? Number(saveFolderId) : (selectedFolderId ? Number(selectedFolderId) : null),
      distance: Number(totalMeters.toFixed(3)),
    };
  }, [steps, workoutTitle, workoutDescription, totals, selectedFolderId, saveFolderId, workoutId, workoutMode]);

  const handleConfirmSaveWorkout = async () => {
    if (!saveTitle.trim()) {
      alert('Please enter a workout name.');
      return;
    }
    setApiLoading(true);
    setStatusMessage('Saving workout...');

    const targetWorkoutId = saveAsNew ? null : workoutId;
    const action = targetWorkoutId ? 'update_workout' : 'create_workout';

    try {
      const payload = { 
        ...workoutPayloadObject, 
        name: saveTitle, 
        folder_id: saveFolderId ? Number(saveFolderId) : null 
      };

      const result = await saveWorkoutApi(action, targetWorkoutId, payload);
      const finalId = result.id || targetWorkoutId;

      setWorkoutId(finalId);
      setWorkoutTitle(saveTitle);
      setSelectedFolderId(saveFolderId);

      setOriginalWorkoutSnapshot({
        id: finalId,
        name: saveTitle,
        workoutDescription,
        folder_id: saveFolderId,
        steps: JSON.parse(JSON.stringify(steps)),
      });

      setMode('EDITING');
      setIsSaveModalOpen(false);
      setStatusMessage(`Successfully saved workout "${saveTitle}"!`);
    } catch (err) {
      setStatusMessage(`Error saving workout: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const addStep = (type, parentRepeatId = null) => {
    const newStep = createStep(type, workoutMode);
    if (!parentRepeatId) {
      setSteps([...steps, newStep]);
    } else {
      const addRecursive = (list) =>
        list.map((s) => {
          if (s.id === parentRepeatId && s.type === 'repeat') {
            return { ...s, steps: [...(s.steps || []), newStep] };
          }
          if (s.type === 'repeat') {
            return { ...s, steps: addRecursive(s.steps || []) };
          }
          return s;
        });
      setSteps(addRecursive(steps));
    }
  };

  const removeStep = (id) => {
    const filterRecursive = (list) =>
      list.filter((s) => s.id !== id).map((s) => (s.type === 'repeat' ? { ...s, steps: filterRecursive(s.steps || []) } : s));
    setSteps(filterRecursive(steps));
  };

  const updateStepField = (id, field, value) => {
    const updateRecursive = (list) =>
      list.map((s) => {
        if (s.id === id) return { ...s, [field]: value };
        if (s.type === 'repeat') return { ...s, steps: updateRecursive(s.steps || []) };
        return s;
      });
    setSteps(updateRecursive(steps));
  };

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
          return { ...s, steps: (s.steps || []).filter((child) => child.id !== stepId) };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: removeFromTree(s.steps || [], parentId, stepId) };
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
          const nextSteps = [...(s.steps || [])];
          nextSteps.splice(index, 0, item);
          return { ...s, steps: nextSteps };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: insertIntoTree(s.steps || [], parentId, index, item) };
        }
        return s;
      });
    };

    const treeWithoutItem = removeFromTree(steps, sourceParentId, itemToMove.id);
    setSteps(insertIntoTree(treeWithoutItem, targetParentId, targetIndex, itemToMove));
    setDraggedItem(null);
  };

  return (
    <div className="workout-builder-container">
      {/* Header Bar */}
      <div className="builder-header-bar">
        <h1 className="builder-header-title">Workout Builder</h1>

        <OptionsMenu
          isOpen={isOptionsMenuOpen}
          onToggleOpen={() => setIsOptionsMenuOpen((prev) => !prev)}
          mode={mode}
          menuButtonStyle={menuButtonStyle}
          onStartCreateNew={handleStartCreateNew}
          onOpenEditModal={handleOpenEditModal}
          onOpenCreateFolderModal={handleOpenCreateFolderModal}
          onOpenSaveModal={handleOpenSaveModal}
          onDuplicateWorkout={handleDuplicateWorkout}
          onCopyWorkoutText={handleCopyWorkoutText}
          onCancelEdits={handleCancelEdits}
          onCloseWorkout={handleCloseWorkout}
        />

      </div>

      {statusMessage && (
        <div className="status-message-banner">
          {statusMessage}
        </div>
      )}

      {mode === 'EMPTY' && (
        <div className="empty-state-card">
          <h3>No Workout Selected</h3>
          <p>Click the <strong>Options</strong> button above to create a new workout or edit an existing one.</p>
        </div>
      )}

      {(mode === 'CREATING' || mode === 'EDITING') && (
        <div>
          {/* Controls Bar: Time/Distance Toggle, Threshold Display & Pace Method Dropdown */}
          <ControlBar
            workoutMode={workoutMode}
            setWorkoutMode={setWorkoutMode}
            thresholdPaceSec={paces.threshhold_pace}
            paceMethod={paceMethod}
            setPaceMethod={setPaceMethod}
          />

          <div className="builder-header">
            <input
              type="text"
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              className="builder-title-input"
              placeholder="Workout Title"
            />
            <div className="builder-totals">
              Total Time: <strong className="total-time-val">{formatTime(totals.totalSec)}</strong> | Total Dist: <strong className="total-dist-val">{formatDistance(totals.totalMiles)}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="description-label">
              Workout Description
            </label>
            <textarea
              value={workoutDescription}
              onChange={(e) => setWorkoutDescription(e.target.value)}
              placeholder="Add an optional description or notes for this workout..."
              rows={2}
              className="description-textarea"
            />
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Workout Profile Chart</span>
              <button className="btn-zoom" onClick={() => setIsZoomOpen(true)}>🔍 Zoom Chart</button>
            </div>
            <RenderWorkoutChart steps={steps} height={120} workoutMode={workoutMode} presets={dynamicPresets} />
          </div>

          {/* ---------------------------------------------------------------------------------------------------------- */}
          {/* POC to see if we can get WorkoutChart working before removing the chart code from WorkoutBuilder */}

          <div className="chart-card">
            <div className="chart-header">
                <span className="chart-title">WorkoutChart POC</span>
             </div>
            <WorkoutChart
              workout={convertWorkoutToTargetFormat(workoutPayloadObject)}
              chartHeight="140px"
            />
          </div>

          <div className="json-preview-container">
            <label className="json-preview-label">
              WorkoutChart JSON 2 (Read-Only)
            </label>
            <textarea
              readOnly
              value={convertWorkoutToTargetFormat(workoutPayloadObject)}
              rows={14}
              className="json-preview-textarea"
            />
          </div>

          {/* ---------------------------------------------------------------------------------------------------------- */}

          <div className="action-bar">
            <button className="btn-add-step" onClick={() => addStep('warmup')}>+ Warmup</button>
            <button className="btn-add-step" onClick={() => addStep('run')}>+ Run</button>
            <button className="btn-add-step" onClick={() => addStep('recovery')}>+ Recovery</button>
            <button className="btn-add-step" onClick={() => addStep('cooldown')}>+ Cooldown</button>
            <button className="btn-add-step btn-add-repeat" onClick={() => addStep('repeat')}>+ Repeat</button>
          </div>

          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, null, steps.length)} style={{ minHeight: '120px', marginBottom: '24px' }}>
            {steps.map((step, index) => (
              <RenderStepRow
                key={step.id}
                step={step}
                index={index}
                parentId={null}
                workoutMode={workoutMode}
                presets={dynamicPresets}
                onRemove={removeStep}
                onUpdate={updateStepField}
                onAddChild={addStep}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
              />
            ))}
          </div>

          <div className="json-preview-container">
            <label className="json-preview-label">
              Intervals.icu JSON Representation (Read-Only)
            </label>
            <textarea
              readOnly
              value={JSON.stringify([workoutPayloadObject], null, 2)}
              rows={14}
              className="json-preview-textarea"
            />
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------*/}
      {/* --------------------------------------------------------------------------*/}
      {/* --------------------------------------------------------------------------*/}

      {/* --- MODALS --- */}
      <Modal_Folder_Create
      isOpen={isFolderModalOpen}
      onClose={() => setIsFolderModalOpen(false)}
      newFolderName={newFolderName}
      setNewFolderName={setNewFolderName}
      handleCreateFolderSubmit={handleCreateFolderSubmit}
      apiLoading={apiLoading}
    />

    <Modal_Workout_Edit
      isOpen={isEditModalOpen}
      onClose={() => setIsEditModalOpen(false)}
      selectedEditFolderId={selectedEditFolderId}
      setSelectedEditFolderId={setSelectedEditFolderId}
      folders={folders}
      fetchWorkoutsApi={fetchWorkoutsApi}
      setWorkoutsList={setWorkoutsList}
      setStatusMessage={setStatusMessage}
      setApiLoading={setApiLoading}
      apiLoading={apiLoading}
      workoutsList={workoutsList}
      mapIcuDocToSteps={mapIcuDocToSteps}
      calculateTotals={calculateTotals}
      workoutMode={workoutMode}
      handleSelectWorkoutToEdit={handleSelectWorkoutToEdit}
      formatTime={formatTime}
      formatDistance={formatDistance}
      RenderWorkoutChart={RenderWorkoutChart}
      dynamicPresets={dynamicPresets}
    />

    <Modal_Workout_Save
      isOpen={isSaveModalOpen}
      onClose={() => setIsSaveModalOpen(false)}
      saveAsNew={saveAsNew}
      saveTitle={saveTitle}
      setSaveTitle={setSaveTitle}
      saveFolderId={saveFolderId}
      setSaveFolderId={setSaveFolderId}
      folders={folders}
      showInlineFolderInput={showInlineFolderInput}
      setShowInlineFolderInput={setShowInlineFolderInput}
      inlineFolderInput={inlineFolderInput}
      setInlineFolderInput={setInlineFolderInput}
      handleCreateInlineFolder={handleCreateInlineFolder}
      handleConfirmSaveWorkout={handleConfirmSaveWorkout}
      apiLoading={apiLoading}
    />

    <Modal_Workout_Zoom
      isOpen={isZoomOpen}
      onClose={() => setIsZoomOpen(false)}
      workoutTitle={workoutTitle}
      steps={steps}
      workoutMode={workoutMode}
      dynamicPresets={dynamicPresets}
      RenderWorkoutChart={RenderWorkoutChart}
    />

      {/* --------------------------------------------------------------------------*/}
      {/* --------------------------------------------------------------------------*/}
      {/* --------------------------------------------------------------------------*/}

      </div>
  );
}

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
  top: 0, left: 0, right: 0, bottom: 0,
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

function MMSSInput({ valueSec, onChange }) {
  const [text, setText] = useState(formatMMSS(valueSec));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setText(formatMMSS(valueSec));
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
        setText(formatMMSS(parsedSec));
        onChange(parsedSec);
      }}
      className="time-pace-input"
    />
  );
}

function RenderStepRow({ step, index, parentId, workoutMode, presets, onRemove, onUpdate, onAddChild, onDragStart, onDrop }) {
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

function RenderWorkoutChart({ steps, height, workoutMode, presets }) {
  const flattenSteps = (list) => {
    let result = [];
    if (!Array.isArray(list)) return result;

    list.forEach((s) => {
      if (s.type === 'repeat') {
        const reps = s.iterations || 1;
        for (let i = 0; i < reps; i++) {
          result = result.concat(flattenSteps(s.steps || []));
        }
      } else {
        result.push(s);
      }
    });
    return result;
  };

  const flatSteps = flattenSteps(steps);
  const totalWeight = flatSteps.reduce((acc, curr) => {
    const val = workoutMode === 'distance' 
      ? (curr.distanceMiles || 0) 
      : (curr.durationSec || 0);
    return acc + val;
  }, 0) || 1;

  const velocities = flatSteps.map((s) => (s.targetPaceSec > 0 ? 1 / s.targetPaceSec : 0));
  const maxVel = Math.max(...velocities, 0.0001);
  const minVel = Math.min(...velocities, maxVel);

  const getBarColor = (paceSec) => {
    if (!paceSec || paceSec <= 0) return PRESET_COLORS[0];
    if (!presets || presets.length === 0) return PRESET_COLORS[0];

    let closestColor = PRESET_COLORS[0];
    let smallestDiff = Infinity;

    presets.forEach((p) => {
      const diff = Math.abs(p.targetPaceSec - paceSec);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestColor = p.color;
      }
    });

    return closestColor;
  };

  return (
    <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'flex-end', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
      {flatSteps.map((step, idx) => {
        const stepWeight = workoutMode === 'distance' 
          ? (step.distanceMiles || 0) 
          : (step.durationSec || 0);
        const widthPct = (stepWeight / totalWeight) * 100;
        const currentVel = step.targetPaceSec > 0 ? 1 / step.targetPaceSec : 0;
        const barHeightPct = maxVel === minVel ? 60 : 25 + ((currentVel - minVel) / (maxVel - minVel)) * 70;
        const barColor = getBarColor(step.targetPaceSec);

        const durLabel = workoutMode === 'distance' 
          ? formatDistance(step.distanceMiles) 
          : formatTime(step.durationSec);

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              height: `${barHeightPct}%`,
              backgroundColor: barColor,
              borderRight: '1px solid rgba(255,255,255,0.4)',
            }}
            title={`${(step.type || 'run').toUpperCase()}: ${durLabel} @ ${formatMMSS(step.targetPaceSec)}/mi`}
          />
        );
      })}
    </div>
  );
}