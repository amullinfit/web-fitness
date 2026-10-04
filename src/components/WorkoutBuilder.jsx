//
// WorkoutBuilder.jsx
//
import React, { useState, useEffect, useMemo } from 'react';
import { usePaces } from '../utils/PacesContext.jsx'; 
import '../CSS/WorkoutBuilder.css';

import { useWorkoutSteps } from '../hooks/useWorkoutSteps';

import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';

import RenderStepRow from '../utils/RenderStepRow';

import { OptionsMenu } from '../utils/WorkoutBuilderMenus';

import { 
  convertWorkoutToTargetFormat,
} from '../utils/WorkoutConverter.js';

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
  addIdsToBaseWorkout
} from '../utils/WorkoutBuilderHelpers.js';

export default function WorkoutBuilder() {
  console.log('[App Debug WorkoutBuilder] WorkoutBuilder rendering');

  const { paces } = usePaces();

  // --- Core State ---
  const [mode, setMode] = useState('EMPTY'); // 'EMPTY', 'BUILDING', 'SAVED'

  // Panel collapse state
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  // Metadata
  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');

  // Raw document state
  const [unalteredWorkout, setUnalteredWorkout] = useState('');
  const [baseWorkout, setBaseWorkout] = useState(null);

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

  // Keep baseWorkout.workout_doc.steps synced with hook steps
  useEffect(() => {
    console.log('[App Debug WorkoutBuilder] useEffect: syncing steps to baseWorkout');
    if (baseWorkout && baseWorkout.workout_doc) {
      setBaseWorkout((prev) => ({
        ...prev,
        workout_doc: {
          ...prev.workout_doc,
          steps: steps
        }
      }));
    }
  }, [steps]);

  // Sync root 'name' field in baseWorkout with workoutTitle
  useEffect(() => {
    console.log('[App Debug WorkoutBuilder] useEffect: syncing workoutTitle to baseWorkout');
    if (baseWorkout) {
      setBaseWorkout((prev) => ({
        ...prev,
        name: workoutTitle
      }));
    }
  }, [workoutTitle]);

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
    console.log('[App Debug WorkoutBuilder] showToast triggered with message:', msg);
    setStatusMessage(msg);
    setTimeout(() => {
      console.log('[App Debug WorkoutBuilder] showToast timeout clear message');
      setStatusMessage('');
    }, 3000);
  };

  // Initial Load
  useEffect(() => {
    console.log('[App Debug WorkoutBuilder] useEffect: initial data fetch starting');
    async function initData() {
      console.log('[App Debug WorkoutBuilder] initData executing');
      try {
        const fetchedFolders = await fetchFoldersApi();
        setFolders(fetchedFolders || []);
        const fetchedWorkouts = await fetchWorkoutsApi();
        const workoutsArray = Array.isArray(fetchedWorkouts) 
          ? fetchedWorkouts 
          : (fetchedWorkouts?.workouts || []);
        setSavedWorkouts(workoutsArray);
        console.log('[App Debug WorkoutBuilder] initData successfully fetched folders and workouts');
      } catch (err) {
        console.error('Failed to initialize workout builder data:', err);
      }
    }
    initData();
  }, []);

  // Presets & Totals
  const dynamicPresets = useMemo(() => {
    console.log('[App Debug WorkoutBuilder] useMemo: calculating dynamicPresets');
    return calculateDynamicPresets(paces, paces?.threshold_pace || 360, paceMethod);
  }, [paces, paceMethod]);

  // --- Handlers for Options Menu ---

  const handleNewWorkout = () => {
    console.log('[App Debug WorkoutBuilder] handleNewWorkout invoked');
    const initialTitle = 'New Workout';
    setWorkoutId(null);
    setWorkoutTitle(initialTitle);
    setWorkoutDescription('');
    setUnalteredWorkout('');
    const defaultSteps = createDefaultSteps(workoutMode);    
    const newBase = { 
      name: initialTitle, // Root element
      workout_doc: { 
        steps: defaultSteps 
      } 
    };
    setBaseWorkout(newBase);
    setSteps(defaultSteps);
    setMode('BUILDING');
  };
  
  const handleSelectWorkout = (id) => {
    console.log('[App Debug WorkoutBuilder] handleSelectWorkout invoked with id:', id);
    const found = savedWorkouts.find((w) => String(w.id) === String(id));
    if (found) {
      const title = found.name || found.title || 'Untitled';
      setWorkoutId(found.id);
      setWorkoutTitle(title);
      setWorkoutDescription(found.description || '');
      setSelectedFolderId(found.folder_id ?? found.folderId ?? '');
  
      const rawDocObj = found;
      const parsedObj = typeof rawDocObj === 'string' 
        ? (() => {
            console.log('[App Debug WorkoutBuilder] handleSelectWorkout parsing JSON string document');
            try { return JSON.parse(rawDocObj); } catch { return null; }
          })() 
        : rawDocObj;
  
      const preparedBase = addIdsToBaseWorkout(parsedObj);
      
      // Set root 'name' property
      const baseWithTitle = {
        ...preparedBase,
        name: title
      };
  
      setUnalteredWorkout(parsedObj);
      setBaseWorkout(baseWithTitle);
      setSteps(preparedBase?.workout_doc?.steps || []);
  
      setMode('BUILDING');
      setIsEditModalOpen(false);
    }
  };

  const handleOpenSaveModal = (isSaveAs = false) => {
    console.log('[App Debug WorkoutBuilder] handleOpenSaveModal invoked with isSaveAs:', isSaveAs);
    setIsSaveAsMode(isSaveAs);
    setIsSaveModalOpen(true);
  };

  const handleSaveWorkout = async (overrideTitle, overrideFolderId) => {
    console.log('[App Debug WorkoutBuilder] handleSaveWorkout invoked', { overrideTitle, overrideFolderId });
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
    console.log('[App Debug WorkoutBuilder] handleDuplicateWorkout invoked');
    setWorkoutId(null);
    setWorkoutTitle(`${workoutTitle} (Copy)`);
    setMode('BUILDING');
    showToast('Workout duplicated!');
  };

  const handleCopyWorkoutText = () => {
    console.log('[App Debug WorkoutBuilder] handleCopyWorkoutText invoked');
    const textOutput = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const stringified = typeof textOutput === 'object' ? JSON.stringify(textOutput, null, 2) : textOutput;
    navigator.clipboard.writeText(stringified);
    showToast('Workout plain text copied to clipboard!');
  };

  const triggerFileDownload = (content, fileName, mimeType) => {
    console.log('[App Debug WorkoutBuilder] triggerFileDownload invoked', { fileName, mimeType });
    const blob = new Blob([content], { type: mimeType });
    const url = URL.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIcu = () => {
    console.log('[App Debug WorkoutBuilder] handleDownloadIcu invoked');
    const textOutput = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const content = typeof textOutput === 'object' ? JSON.stringify(textOutput, null, 2) : textOutput;
    const cleanTitle = workoutTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerFileDownload(content, `${cleanTitle}.icu`, 'text/plain');
  };

  const handleDownloadZwo = () => {
    console.log('[App Debug WorkoutBuilder] handleDownloadZwo invoked');
    const zwoContent = convertWorkoutToTargetFormat(steps, workoutMode, 'ZWO');
    const cleanTitle = workoutTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerFileDownload(zwoContent, `${cleanTitle}.zwo`, 'application/xml');
  };

  const handleCreateFolder = async (folderName) => {
    console.log('[App Debug WorkoutBuilder] handleCreateFolder invoked with folderName:', folderName);
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
    console.log('[App Debug WorkoutBuilder] handleCancelEdits invoked');
    if (workoutId) {
      handleSelectWorkout(workoutId);
      showToast('Reverted edits back to saved state.');
    } else {
      handleNewWorkout();
    }
  };

  const handleCloseWorkout = () => {
    console.log('[App Debug WorkoutBuilder] handleCloseWorkout invoked');
    setWorkoutId(null);
    setMode('EMPTY');
  };

  return (
    <div className="workout-builder-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {statusMessage && <div className="status-message-banner">{statusMessage}</div>}

      {/* --- MAIN PAGE SPLIT CONTAINER --- */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT MAIN PANEL (Header + Chart + Scrollable Steps) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* FIXED / STICKY TOP HEADER & CHART SECTION */}
          <div 
            className="builder-fixed-header-section" 
            style={{ 
              backgroundColor: '#fff', 
              boxShadow: '0px 2px 5px rgba(0,0,0,0.05)',
              paddingBottom: '8px',
              paddingLeft: '16px',
              paddingRight: '16px'
            }}
          >
          <div className="builder-header-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="builder-header-title">Workout Builder:</h1>
              <input
                type="text"
                value={workoutTitle}
                onChange={(e) => {
                  console.log('[App Debug WorkoutBuilder] workoutTitle input changed:', e.target.value);
                  setWorkoutTitle(e.target.value);
                }}
                placeholder="Workout Title"
                className="workout-title-input"
                style={{ fontSize: '18px', padding: '4px 8px', fontWeight: 'bold' }}
              />
            </div>
              <OptionsMenu
                mode={mode}
                onStartCreateNew={handleNewWorkout}
                onOpenSelectModal={() => {
                  console.log('[App Debug WorkoutBuilder] OptionsMenu -> onOpenSelectModal');
                  setIsEditModalOpen(true);
                }}
                onOpenCreateFolderModal={() => {
                  console.log('[App Debug WorkoutBuilder] OptionsMenu -> onOpenCreateFolderModal');
                  setIsFolderModalOpen(true);
                }}
                onOpenSaveModal={handleOpenSaveModal}
                onDuplicateWorkout={handleDuplicateWorkout}
                onCopyWorkoutText={handleCopyWorkoutText}
                onDownloadIcu={handleDownloadIcu}
                onDownloadZwo={handleDownloadZwo}
                onCancelEdits={handleCancelEdits}
                onCloseWorkout={handleCloseWorkout}
              />
            </div>

            {mode !== 'EMPTY' && (
              <div className="chart-preview-container" style={{ margin: '8px 0', cursor: 'pointer' }}>
                <WorkoutChart
                  workout={baseWorkout}
                  thresholdPace={paces?.threshold_pace || 400}
                  chartHeight={"140px"}
                  showBarPace={false}
                />
                <WorkoutTextSection 
                  workout={baseWorkout}
                  threshold={paces?.threshold_pace}
                  paceDetails={paces}
                  />
              </div>
            )}
          </div>

          {/* SCROLLABLE STEPS SECTION */}
          <div 
            className="builder-scrollable-content" 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '16px' 
            }}
          >
            {mode === 'EMPTY' ? (
              <div className="empty-state-card">
                <h3>No Workout Selected</h3>
                <p>Select an existing workout from Options or create a new one to get started.</p>
                <button className="btn-primary" onClick={handleNewWorkout}>
                  + Create New Workout
                </button>
              </div>
            ) : (
              <div>
                <div 
                  className="steps-list-container" 
                  onDragOver={(e) => {
                    console.log('[App Debug WorkoutBuilder] onDragOver steps container');
                    e.preventDefault();
                  }} 
                  onDrop={(e) => {
                    console.log('[App Debug WorkoutBuilder] onDrop root steps container');
                    handleDrop(e, null, baseWorkout?.workout_doc?.steps?.length || 0);
                  }}
                >
                  {baseWorkout?.workout_doc?.steps?.map((step, index) => (
                    <RenderStepRow
                      key={step.id || `step-${index}`}
                      step={step}
                      index={index}
                      parentId={null}
                      paceDetails={paces}
                      onRemove={removeStep}
                      onUpdate={updateStepField}
                      onAddChild={addStep}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>

                <div className="root-add-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button className="btn-add-step" onClick={() => {
                    console.log('[App Debug WorkoutBuilder] Add Run button clicked');
                    addStep('run', null);
                  }}>
                    + Add Run
                  </button>
                  <button className="btn-add-step" onClick={() => {
                    console.log('[App Debug WorkoutBuilder] Add Recovery button clicked');
                    addStep('recovery', null);
                  }}>
                    + Add Recovery
                  </button>
                  <button className="btn-add-step" onClick={() => {
                    console.log('[App Debug WorkoutBuilder] Add Repeat Block button clicked');
                    addStep('repeat', null);
                  }}>
                    + Add Repeat Block
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT PANEL: Full-Height "Updated Live" View (Collapsible) */}
        <div 
          className="baseworkout-column-container" 
          style={{ 
            width: isRightPanelCollapsed ? '40px' : '400px', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            borderLeft: '1px solid #e0e0e0',
            padding: isRightPanelCollapsed ? '16px 8px' : '16px',
            transition: 'width 0.2s ease-in-out',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isRightPanelCollapsed ? '0px' : '8px' }}>
            {!isRightPanelCollapsed && (
              <label 
                htmlFor="baseworkout-input" 
                style={{ fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}
              >
                Updated Live
              </label>
            )}
            <button
              type="button"
              onClick={() => {
                console.log('[App Debug WorkoutBuilder] Toggle panel collapse button clicked');
                setIsRightPanelCollapsed((prev) => !prev);
              }}
              title={isRightPanelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
              style={{
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '12px',
                marginLeft: isRightPanelCollapsed ? 'auto' : '0',
                marginRight: isRightPanelCollapsed ? 'auto' : '0'
              }}
            >
              {isRightPanelCollapsed ? '◀' : '▶'}
            </button>
          </div>

          {!isRightPanelCollapsed && (
            <textarea
              id="baseworkout-input"
              readOnly
              value={JSON.stringify(baseWorkout || {}, null, 2)}
              placeholder="No baseWorkout payload available..."
              style={{
                width: '100%',
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '12px',
                backgroundColor: '#f4f4f6',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'none',
                overflowY: 'auto'
              }}
            />
          )}
        </div>

      </div>

      {/* Modals */}
      {isFolderModalOpen && (
        <Modal_Folder_Create
          onClose={() => {
            console.log('[App Debug WorkoutBuilder] Modal_Folder_Create onClose');
            setIsFolderModalOpen(false);
          }}
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
          onClose={() => {
            console.log('[App Debug WorkoutBuilder] Modal_Workout_Edit onClose');
            setIsEditModalOpen(false);
          }}
        />
      )}

      {isSaveModalOpen && (
        <Modal_Workout_Save
          title={workoutTitle}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onConfirmSave={handleSaveWorkout}
          onClose={() => {
            console.log('[App Debug WorkoutBuilder] Modal_Workout_Save onClose');
            setIsSaveModalOpen(false);
          }}
        />
      )}

      {isZoomModalOpen && (
        <Modal_Workout_Zoom
          steps={steps}
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onClose={() => {
            console.log('[App Debug WorkoutBuilder] Modal_Workout_Zoom onClose');
            setIsZoomModalOpen(false);
          }}
        />
      )}
    </div>
  );
}