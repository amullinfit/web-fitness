import React, { useState, useEffect, useMemo } from 'react';
import { usePaces } from '../utils/PacesContext.jsx'; 
import '../CSS/WorkoutBuilder.css';

import { useWorkoutSteps } from '../hooks/useWorkoutSteps';

import RenderWorkoutChart from '../utils/RenderWorkoutChart';
import RenderStepRow from '../utils/RenderStepRow';
import { OptionsMenu, ControlBar } from '../utils/WorkoutBuilderMenus';
import { convertWorkoutToTargetFormat } from '../utils/WorkoutConverter.js';

import Modal_Folder_Create from '../modals/Modal_Folder_Create';
import Modal_Workout_Edit from '../modals/Modal_Workout_Edit';
import Modal_Workout_Save from '../modals/Modal_Workout_Save';
import Modal_Workout_Zoom from '../modals/Modal_Workout_Zoom';

import { 
  fetchFoldersApi, 
  fetchWorkoutsApi, 
  createFolderApi, 
  saveWorkoutApi, 
  formatTime, 
  formatDistance, 
  calculateDynamicPresets, 
  createDefaultSteps, 
  mapIcuDocToSteps 
} from '../utils/WorkoutBuilderHelpers.js';

export default function WorkoutBuilder() {
  const { paces } = usePaces();

  // --- Core State ---
  const [mode, setMode] = useState('EMPTY'); // 'EMPTY', 'BUILDING', 'SAVED'
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  // Metadata
  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');

  // Raw unaltered document state for debugging/inspection
  const [unalteredWorkout, setUnalteredWorkout] = useState('');

  // Mode Options
  const [workoutMode, setWorkoutMode] = useState('time'); // 'time' or 'distance'
  const [paceMethod, setPaceMethod] = useState('Pace'); 

  // --- Custom Hook for Steps State & Recursive D&D ---
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

  // Initial Load: Fetch folders & workouts
  useEffect(() => {
    async function initData() {
      try {
        const fetchedFolders = await fetchFoldersApi();
        setFolders(fetchedFolders || []);
        const fetchedWorkouts = await fetchWorkoutsApi();
        setSavedWorkouts(fetchedWorkouts || []);
      } catch (err) {
        console.error('Failed to initialize workout builder data:', err);
      }
    }
    initData();
  }, []);

  // Compute dynamic pace presets based on user's pace context
  const dynamicPresets = useMemo(() => {
    return calculateDynamicPresets(paces);
  }, [paces]);

  // Aggregate Stats (Total Duration & Distance)
  const totals = useMemo(() => {
    const calcTotals = (list) => {
      let timeSec = 0;
      let distMiles = 0;

      list.forEach((s) => {
        if (s.type === 'repeat') {
          const reps = s.iterations || 1;
          const [subTime, subDist] = calcTotals(s.steps || []);
          timeSec += subTime * reps;
          distMiles += subDist * reps;
        } else {
          if (workoutMode === 'time') {
            const dur = s.durationSec || 0;
            const pace = s.targetPaceSec || 0;
            timeSec += dur;
            distMiles += pace > 0 ? dur / pace : 0;
          } else {
            const dist = s.distanceMiles || 0;
            const pace = s.targetPaceSec || 0;
            distMiles += dist;
            timeSec += dist * pace;
          }
        }
      });

      return [timeSec, distMiles];
    };

    const [totalTimeSec, totalDistanceMiles] = calcTotals(steps);
    return {
      timeFormatted: formatTime(totalTimeSec),
      distanceFormatted: formatDistance(totalDistanceMiles)
    };
  }, [steps, workoutMode]);

  // --- Handlers ---
  const handleNewWorkout = () => {
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setUnalteredWorkout('');
    setSteps(createDefaultSteps(workoutMode));
    setMode('BUILDING');
  };

  // =========================================================================
  // RETRIEVAL LOGIC: Called when a user selects a workout from OptionsMenu
  // =========================================================================
  const handleSelectWorkout = (id) => {
    const found = savedWorkouts.find((w) => w.id === id);
    if (found) {
      setWorkoutId(found.id);
      setWorkoutTitle(found.name || 'Untitled');
      setWorkoutDescription(found.description || '');
      setSelectedFolderId(found.folder_id || '');

      // Store raw document (formats object/JSON or string representation)
      const rawDoc = typeof found.document === 'object' 
        ? JSON.stringify(found.document, null, 2) 
        : (found.document || '');
      
      setUnalteredWorkout(rawDoc);

      // Parse document into builder UI step objects
      setSteps(mapIcuDocToSteps(found.document, workoutMode));
      setMode('BUILDING');
    }
  };

  const handleSaveWorkout = async () => {
    const icuDocument = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const payload = {
      id: workoutId,
      name: workoutTitle,
      description: workoutDescription,
      folder_id: selectedFolderId,
      document: icuDocument
    };

    try {
      const saved = await saveWorkoutApi(payload);
      if (saved) {
        setWorkoutId(saved.id);
        const updatedList = await fetchWorkoutsApi();
        setSavedWorkouts(updatedList || []);
        setIsSaveModalOpen(false);
        setMode('SAVED');
      }
    } catch (err) {
      console.error('Error saving workout:', err);
    }
  };

  const handleCreateFolder = async (folderName) => {
    try {
      const newFolder = await createFolderApi(folderName);
      if (newFolder) {
        setFolders((prev) => [...prev, newFolder]);
        setSelectedFolderId(newFolder.id);
        setIsFolderModalOpen(false);
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  return (
    <div className="workout-builder-container">
      {/* Top Header / Action Bar */}
      <div className="workout-builder-header">
        <div className="header-titles">
          <h2>{workoutTitle}</h2>
          {workoutDescription && <p className="workout-desc">{workoutDescription}</p>}
        </div>

        <div className="header-controls">
          <button className="btn-secondary" onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}>
            Options ⚙
          </button>
          <button className="btn-primary" onClick={handleNewWorkout}>
            + New Workout
          </button>
        </div>
      </div>

      {/* Flyout Options Menu */}
      {isOptionsMenuOpen && (
        <OptionsMenu
          workoutMode={workoutMode}
          setWorkoutMode={setWorkoutMode}
          paceMethod={paceMethod}
          setPaceMethod={setPaceMethod}
          savedWorkouts={savedWorkouts}
          onSelectWorkout={handleSelectWorkout}
          onClose={() => setIsOptionsMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      {mode === 'EMPTY' ? (
        <div className="empty-state">
          <h3>No Workout Selected</h3>
          <p>Create a new workout or choose an existing one from the Options menu.</p>
          <button className="btn-primary" onClick={handleNewWorkout}>
            Create New Workout
          </button>
        </div>
      ) : (
        <>
          {/* Summary Control Bar */}
          <ControlBar
            totals={totals}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
            onOpenEditModal={() => setIsEditModalOpen(true)}
            onOpenZoomModal={() => setIsZoomModalOpen(true)}
          />

          {/* Interactive Visual Chart */}
          <div className="chart-preview-container" style={{ margin: '16px 0', cursor: 'pointer' }} onClick={() => setIsZoomModalOpen(true)}>
            <RenderWorkoutChart 
              steps={steps} 
              height={140} 
              workoutMode={workoutMode} 
              presets={dynamicPresets} 
            />
          </div>

          {/* Unaltered Workout Raw Output Box */}
          <div className="unaltered-workout-container" style={{ marginBottom: '20px' }}>
            <label 
              htmlFor="unaltered-workout-input" 
              style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '13px' }}
            >
              Unaltered workout
            </label>
            <textarea
              id="unaltered-workout-input"
              readOnly
              value={unalteredWorkout}
              placeholder="No raw Intervals.icu payload available..."
              rows={5}
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

          {/* Steps Container (Recursive Drag-and-Drop) */}
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

          {/* Root Add Buttons */}
          <div className="root-add-actions">
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
        <ModalFolderCreate
          onClose={() => setIsFolderModalOpen(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {isEditModalOpen && (
        <ModalWorkoutEdit
          title={workoutTitle}
          description={workoutDescription}
          folderId={selectedFolderId}
          folders={folders}
          onSave={(newTitle, newDesc, newFolder) => {
            setWorkoutTitle(newTitle);
            setWorkoutDescription(newDesc);
            setSelectedFolderId(newFolder);
            setIsEditModalOpen(false);
          }}
          onClose={() => setIsEditModalOpen(false)}
          onOpenFolderModal={() => setIsFolderModalOpen(true)}
        />
      )}

      {isSaveModalOpen && (
        <ModalWorkoutSave
          title={workoutTitle}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onConfirmSave={handleSaveWorkout}
          onClose={() => setIsSaveModalOpen(false)}
        />
      )}

      {isZoomModalOpen && (
        <ModalWorkoutZoom
          steps={steps}
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onClose={() => setIsZoomModalOpen(false)}
        />
      )}
    </div>
  );
}