//
// WorkoutBuilder.jsx
//
import React, { useState, useEffect, useMemo } from 'react';
import { usePaces } from '../utils/PacesContext.jsx'; 
import '../CSS/WorkoutBuilder.css';

import { useWorkoutSteps } from '../hooks/useWorkoutSteps';

import WorkoutChart from './WorkoutChart';
import RenderWorkoutChart from '../utils/RenderWorkoutChart';
import RenderStepRow from '../utils/RenderStepRow';

import { OptionsMenu, ControlBar } from '../utils/WorkoutBuilderMenus';
import { convertStepsToWorkout, convertWorkoutToTargetFormat } from '../utils/WorkoutConverter.js';

import Modal_Folder_Create from '../modals/Modal_Folder_Create';
import Modal_Workout_Edit from '../modals/Modal_Workout_Edit';
import Modal_Workout_Save from '../modals/Modal_Workout_Save';
import Modal_Workout_Zoom from '../modals/Modal_Workout_Zoom';

import { 
  fetchFoldersApi, 
  fetchWorkoutsApi, 
  createFolderApi, 
  saveWorkoutApi, 
  calculateDynamicPresets, 
  createDefaultSteps, 
  mapIcuDocToSteps 
} from '../utils/WorkoutBuilderHelpers.js';

export default function WorkoutBuilder() {
  const { paces } = usePaces();

  // --- Core State ---
  const [mode, setMode] = useState('EMPTY'); // 'EMPTY', 'BUILDING', 'SAVED'

  // Metadata
  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');

  // Raw document state
  const [unalteredWorkout, setUnalteredWorkout] = useState('');

  // Mode Options
  const [workoutMode, setWorkoutMode] = useState('time'); // 'time' or 'distance'
  const [paceMethod, setPaceMethod] = useState('Pace'); 

  // --- Custom Hook for Steps State ---
  const { 
    steps, 
    setSteps, 
    addStep, 
    removeStep, 
    updateStepField, 
    handleDragStart, 
    handleDrop 
  } = useWorkoutSteps([], workoutMode);

  // --- Data / Folders / Workouts State ---
  const [folders, setFolders] = useState([]);
  const [savedWorkouts, setSavedWorkouts] = useState([]);

  // --- Modal Visibility States ---
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isSaveAsMode, setIsSaveAsMode] = useState(false);

  // Status/Toast Message
  const [statusMessage, setStatusMessage] = useState('');

  const showToast = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Initial Load
  useEffect(() => {
    async function initData() {
      try {
        const fetchedFolders = await fetchFoldersApi();
        setFolders(fetchedFolders || []);
        const fetchedWorkouts = await fetchWorkoutsApi();
        const workoutsArray = Array.isArray(fetchedWorkouts) 
          ? fetchedWorkouts 
          : (fetchedWorkouts?.workouts || []);
        setSavedWorkouts(workoutsArray);
      } catch (err) {
        console.error('Failed to initialize workout builder data:', err);
      }
    }
    initData();
  }, []);

  // Presets & Totals
  const dynamicPresets = useMemo(
    () => calculateDynamicPresets(paces, paces?.threshold || 360, paceMethod),
    [paces, paceMethod]
  );

  // --- Handlers for Options Menu ---

  const handleNewWorkout = () => {
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setUnalteredWorkout('');
    setSteps(createDefaultSteps(workoutMode));
    setMode('BUILDING');
  };

  const handleSelectWorkout = (id) => {
    const found = savedWorkouts.find((w) => String(w.id) === String(id));
    if (found) {
      setWorkoutId(found.id);
      setWorkoutTitle(found.name || found.title || 'Untitled');
      setWorkoutDescription(found.description || '');
      setSelectedFolderId(found.folder_id ?? found.folderId ?? '');

      // Check all potential object locations for the document payload
      const rawDocObj = found;
      const parsedDoc = typeof rawDocObj === 'string' 
        ? (() => { try { return JSON.parse(rawDocObj); } catch { return null; } })() 
        : rawDocObj;

      const displayDoc = typeof rawDocObj === 'string'
        ? rawDocObj
        : JSON.stringify(rawDocObj || {}, null, 2);

        setUnalteredWorkout(rawDocObj);
        setSteps(mapIcuDocToSteps(parsedDoc, workoutMode));

      setMode('BUILDING');
      setIsEditModalOpen(false);
    }
  };

  const handleOpenSaveModal = (isSaveAs = false) => {
    setIsSaveAsMode(isSaveAs);
    setIsSaveModalOpen(true);
  };

  const handleSaveWorkout = async (overrideTitle, overrideFolderId) => {
    const icuDocument = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const targetId = isSaveAsMode ? null : workoutId;

    const payload = {
      id: targetId,
      name: overrideTitle || workoutTitle,
      description: workoutDescription,
      folder_id: overrideFolderId || selectedFolderId,
      document: icuDocument
    };

    try {
      const saved = await saveWorkoutApi(payload);
      if (saved) {
        setWorkoutId(saved.id);
        setWorkoutTitle(payload.name);
        setSelectedFolderId(payload.folder_id);
        const updatedData = await fetchWorkoutsApi();
        const workoutsArray = Array.isArray(updatedData) 
          ? updatedData 
          : (updatedData?.workouts || []);
        setSavedWorkouts(workoutsArray);
        setIsSaveModalOpen(false);
        setMode('SAVED');
        showToast(isSaveAsMode ? 'Workout saved as new file!' : 'Workout saved successfully!');
      }
    } catch (err) {
      console.error('Error saving workout:', err);
    }
  };

  const handleDuplicateWorkout = () => {
    setWorkoutId(null);
    setWorkoutTitle(`${workoutTitle} (Copy)`);
    setMode('BUILDING');
    showToast('Workout duplicated!');
  };

  const handleCopyWorkoutText = () => {
    const textOutput = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const stringified = typeof textOutput === 'object' ? JSON.stringify(textOutput, null, 2) : textOutput;
    navigator.clipboard.writeText(stringified);
    showToast('Workout plain text copied to clipboard!');
  };

  const triggerFileDownload = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIcu = () => {
    const textOutput = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const content = typeof textOutput === 'object' ? JSON.stringify(textOutput, null, 2) : textOutput;
    const cleanTitle = workoutTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerFileDownload(content, `${cleanTitle}.icu`, 'text/plain');
  };

  const handleDownloadZwo = () => {
    const zwoContent = convertWorkoutToTargetFormat(steps, workoutMode, 'ZWO');
    const cleanTitle = workoutTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerFileDownload(zwoContent, `${cleanTitle}.zwo`, 'application/xml');
  };

  const handleCreateFolder = async (folderName) => {
    try {
      const newFolder = await createFolderApi(folderName);
      if (newFolder) {
        const newId = newFolder.id || newFolder._id;
        setFolders((prev) => [...prev, newFolder]);
        setSelectedFolderId(newId);
        setIsFolderModalOpen(false);
        showToast(`Folder "${folderName}" created.`);
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleCancelEdits = () => {
    if (workoutId) {
      handleSelectWorkout(workoutId);
      showToast('Reverted edits back to saved state.');
    } else {
      handleNewWorkout();
    }
  };

  const handleCloseWorkout = () => {
    setWorkoutId(null);
    setMode('EMPTY');
  };

  return (
    <div className="workout-builder-container">
      {statusMessage && <div className="status-message-banner">{statusMessage}</div>}

      <div className="builder-header-bar">
        <h1 className="builder-header-title">Workout Builder</h1>
        <OptionsMenu
          mode={mode}
          onStartCreateNew={handleNewWorkout}
          onOpenSelectModal={() => setIsEditModalOpen(true)}
          onOpenCreateFolderModal={() => setIsFolderModalOpen(true)}
          onOpenSaveModal={handleOpenSaveModal}
          onDuplicateWorkout={handleDuplicateWorkout}
          onCopyWorkoutText={handleCopyWorkoutText}
          onDownloadIcu={handleDownloadIcu}
          onDownloadZwo={handleDownloadZwo}
          onCancelEdits={handleCancelEdits}
          onCloseWorkout={handleCloseWorkout}
        />
      </div>

      {mode === 'EMPTY' ? (
        <div className="empty-state-card">
          <h3>No Workout Selected</h3>
          <p>Select an existing workout from Options or create a new one to get started.</p>
          <button className="btn-primary" onClick={handleNewWorkout}>
            + Create New Workout
          </button>
        </div>
      ) : (
        <>
          <ControlBar
            workoutMode={workoutMode}
            setWorkoutMode={setWorkoutMode}
            paceMethod={paceMethod}
            setPaceMethod={setPaceMethod}
            thresholdPaceSec={paces?.threshold_pace || 0} 
          />


          <div className="unaltered-workout-container" style={{ marginTop: '16px', marginBottom: '16px' }}>
            <label 
              htmlFor="unaltered-workout-input" 
              style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '13px' }}
            >
              Workout Data - Unaltered
            </label>
            <textarea
              id="unaltered-workout-input"
              readOnly
              value={JSON.stringify(unalteredWorkout || {}, null, 2)}
              placeholder="No raw Intervals.icu payload available..."
              rows={4}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '8px',
                backgroundColor: '#f4f4f6',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical'
              }}
            />
          </div>

          <div className="unaltered-workout-container" style={{ marginTop: '16px', marginBottom: '16px' }}>
            <label 
              htmlFor="unaltered-workout-input" 
              style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '13px' }}
            >
              Workout Data - steps (changes with updates)
            </label>
            <textarea
              id="unaltered-workout-input"
              readOnly
              value={JSON.stringify(steps || {}, null, 2)}
              placeholder="No raw Intervals.icu payload available..."
              rows={4}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '8px',
                backgroundColor: '#f4f4f6',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical'
              }}
            />
          </div>

          <div className="chart-preview-container" style={{ margin: '16px 0', cursor: 'pointer' }}>
            <WorkoutChart
              workout={unalteredWorkout}
              thresholdPace={400}
              chartHeight={"200px"}
            />
          </div>

          <div 
            className="steps-list-container" 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={(e) => handleDrop(e, null, steps.length)}
          >
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

          <div className="root-add-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button className="btn-add-step" onClick={() => addStep('run', null)}>
              + Add Run
            </button>
            <button className="btn-add-step" onClick={() => addStep('recovery', null)}>
              + Add Recovery
            </button>
            <button className="btn-add-step" onClick={() => addStep('repeat', null)}>
              + Add Repeat Block
            </button>
          </div>

        </>
      )}

      {/* Modals */}
      {isFolderModalOpen && (
        <Modal_Folder_Create
          onClose={() => setIsFolderModalOpen(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {isEditModalOpen && (
        <Modal_Workout_Edit
          isOpen={isEditModalOpen}
          workouts={savedWorkouts}
          folders={folders}
          currentFolderId={selectedFolderId}
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onSelectWorkout={handleSelectWorkout}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {isSaveModalOpen && (
        <Modal_Workout_Save
          title={workoutTitle}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onConfirmSave={handleSaveWorkout}
          onClose={() => setIsSaveModalOpen(false)}
        />
      )}

      {isZoomModalOpen && (
        <Modal_Workout_Zoom
          steps={steps}
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onClose={() => setIsZoomModalOpen(false)}
        />
      )}
    </div>
  );
}