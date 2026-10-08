//
// WorkoutBuilder.jsx
//

import React, { useState, useEffect, useMemo } from 'react';
import { useReadOnly } from '../context/ReadOnlyContext.jsx';
import { usePaces } from '../utils/PacesContext.jsx';
import '../CSS/WorkoutBuilder.css';

import { useWorkoutSteps } from '../hooks/useWorkoutSteps';

import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';

import RenderStepRow from '../utils/RenderStepRow';

import { OptionsMenu } from '../utils/WorkoutBuilderMenus';

import Modal_Folder_Create from '../modals/Modal_Folder_Create';
import Modal_Workout_Edit from '../modals/Modal_Workout_Edit';
import Modal_Workout_Save from '../modals/Modal_Workout_Save';
import Modal_Workout_Zoom from '../modals/Modal_Workout_Zoom';

import {
  fetchWorkoutsApi,
  createFolderApi,
  saveWorkoutApi,
  calculateDynamicPresets,
  createDefaultSteps,
  addIdsToBaseWorkout,
  buildWorkoutDescription,
} from '../utils/WorkoutBuilderHelpers.js';


export default function WorkoutBuilder() {
  const { paces } = usePaces();
  const readOnly = useReadOnly();

  // ------------------------------------------------------------
  // Core State
  // ------------------------------------------------------------

  const [mode, setMode] = useState('EMPTY');

  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  // ------------------------------------------------------------
  // Workout Metadata
  // ------------------------------------------------------------

  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');

  // ------------------------------------------------------------
  // Raw / Working Workout Document
  // ------------------------------------------------------------

  const [unalteredWorkout, setUnalteredWorkout] = useState('');
  const [baseWorkout, setBaseWorkout] = useState(null);

  // ------------------------------------------------------------
  // Workout Options
  // ------------------------------------------------------------

  const [workoutMode, setWorkoutMode] = useState('time');
  const [paceMethod, setPaceMethod] = useState('Pace');

  // ------------------------------------------------------------
  // Save Modal State
  // ------------------------------------------------------------

  const [saveTitle, setSaveTitle] = useState('');
  const [saveFolderId, setSaveFolderId] = useState('');
  const [isSaveAsMode, setIsSaveAsMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------
  // Status / Toast
  // ------------------------------------------------------------

  const [statusMessage, setStatusMessage] = useState('');

  const showToast = (msg) => {
    console.log(
      '[App Debug WorkoutBuilder] showToast triggered with message:',
      msg
    );

    setStatusMessage(msg);

    setTimeout(() => {
      console.log(
        '[App Debug WorkoutBuilder] showToast timeout clear message'
      );
      setStatusMessage('');
    }, 3000);
  };

  // ------------------------------------------------------------
  // Custom Hook for Workout Steps
  // ------------------------------------------------------------

  const {
    steps,
    setSteps,
    addStep,
    removeStep,
    updateStepField,
    handleDragStart,
    handleDrop,
  } = useWorkoutSteps([], workoutMode);

  // ------------------------------------------------------------
  // Keep the live workout document AND root description
  // synchronized with the current edited steps.
  //
  // RenderStepRow -> updateStepField() -> steps
  //
  // Description belongs ONLY at the root of baseWorkout.
  // It must NOT exist inside workout_doc.
  // ------------------------------------------------------------

  useEffect(() => {
    if (!baseWorkout?.workout_doc) {
      return;
    }
  
    const liveDescription =
      buildWorkoutDescription(steps);
  
    setBaseWorkout((prev) => {
      if (!prev?.workout_doc) {
        return prev;
      }
  
      // Strip any existing nested description.
      const {
        description: _workoutDocDescription,
        ...workoutDocWithoutDescription
      } = prev.workout_doc;
  
      return {
        ...prev,
  
        // Description ONLY at the root.
        description: liveDescription,
  
        workout_doc: {
          ...workoutDocWithoutDescription,
          steps,
        },
      };
    });
  }, [steps]);

  
  // ------------------------------------------------------------
  // Keep baseWorkout.name synchronized with workoutTitle
  // ------------------------------------------------------------

  useEffect(() => {
    if (!baseWorkout) {
      return;
    }

    setBaseWorkout((prev) => ({
      ...prev,
      name: workoutTitle,
    }));
  }, [workoutTitle]);

  // ------------------------------------------------------------
  // Folders / Saved Workouts
  // ------------------------------------------------------------

  const [folders, setFolders] = useState([]);
  const [savedWorkouts, setSavedWorkouts] = useState([]);

  // ------------------------------------------------------------
  // Modal Visibility
  // ------------------------------------------------------------

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  // ------------------------------------------------------------
  // Initial Data Load
  // ------------------------------------------------------------

  useEffect(() => {
    console.log(
      '[App Debug WorkoutBuilder] Initial data fetch starting'
    );

    async function initData() {
      try {
        console.log(
          '[App Debug WorkoutBuilder] Fetching folders and workouts...'
        );

        const fetchedData = await fetchWorkoutsApi();

        console.log(
          '[App Debug WorkoutBuilder] Folders and workouts received:',
          fetchedData
        );

        setFolders(fetchedData?.folders || []);
        setSavedWorkouts(fetchedData?.workouts || []);

        console.log(
          '[App Debug WorkoutBuilder] Initial data load complete'
        );
      } catch (err) {
        console.error(
          '[App Debug WorkoutBuilder] Failed to initialize workout builder:',
          err
        );
      }
    }

    initData();
  }, []);

  // ------------------------------------------------------------
  // Dynamic Presets
  // ------------------------------------------------------------

  const dynamicPresets = useMemo(() => {
    console.log(
      '[App Debug WorkoutBuilder] Calculating dynamicPresets'
    );

    return calculateDynamicPresets(
      paces,
      paces?.threshold_pace || 360,
      paceMethod
    );
  }, [paces, paceMethod]);

  // ============================================================
  // CREATE NEW WORKOUT
  // ============================================================

  const handleNewWorkout = () => {
    console.log(
      '[App Debug WorkoutBuilder] Step 1: handleNewWorkout invoked'
    );

    const initialTitle = 'New Workout';

    const defaultSteps = createDefaultSteps(workoutMode);

    const newBase = {
      name: initialTitle,
      description: buildWorkoutDescription(defaultSteps),
      workout_doc: {
        steps: defaultSteps,
      },
    };
    
    console.log(
      '[App Debug WorkoutBuilder] New baseWorkout created:',
      newBase
    );

    setWorkoutId(null);
    setWorkoutTitle(initialTitle);
    setWorkoutDescription('');
    setUnalteredWorkout('');
    setBaseWorkout(newBase);
    setSteps(defaultSteps);
    setSelectedFolderId('');
    setMode('BUILDING');
  };

  // ============================================================
  // SELECT EXISTING WORKOUT
  // ============================================================

  const handleSelectWorkout = (id) => {
    console.log(
      '[App Debug WorkoutBuilder] handleSelectWorkout invoked with id:',
      id
    );

    const found = savedWorkouts.find(
      (w) => String(w.id) === String(id)
    );

    if (!found) {
      console.warn(
        '[App Debug WorkoutBuilder] No workout found for id:',
        id
      );
      return;
    }

    const title =
      found.name ||
      found.title ||
      'Untitled';

    const folderId =
      found.folder_id ??
      found.folderId ??
      '';

    let parsedObj = found;

    if (typeof found === 'string') {
      console.log(
        '[App Debug WorkoutBuilder] Parsing workout JSON string'
      );

      try {
        parsedObj = JSON.parse(found);
      } catch (err) {
        console.error(
          '[App Debug WorkoutBuilder] Failed to parse workout JSON:',
          err
        );
        return;
      }
    }

    const preparedBase = addIdsToBaseWorkout(parsedObj);

    const baseWithTitle = {
      ...preparedBase,
      name: title,
    };

    console.log(
      '[App Debug WorkoutBuilder] Loaded workout into baseWorkout:',
      baseWithTitle
    );

    setWorkoutId(found.id);
    setWorkoutTitle(title);
    setWorkoutDescription(found.description || '');
    setSelectedFolderId(folderId);
    setSaveTitle(title);
    setSaveFolderId(folderId);

    setUnalteredWorkout(parsedObj);
    setBaseWorkout(baseWithTitle);

    setSteps(
      preparedBase?.workout_doc?.steps || []
    );

    setMode('BUILDING');
    setIsEditModalOpen(false);
  };

  // ============================================================
  // OPEN SAVE MODAL
  // ============================================================

  const handleOpenSaveModal = (isSaveAs = false) => {
    console.log(
      '[Save Flow] Step 1: Save menu option selected',
      {
        isSaveAs,
        workoutId,
        workoutTitle,
        selectedFolderId,
      }
    );

    const initialTitle = isSaveAs
      ? `${workoutTitle} (Copy)`
      : workoutTitle;

    setIsSaveAsMode(isSaveAs);
    setSaveTitle(initialTitle);
    setSaveFolderId(selectedFolderId || '');
    setIsSaveModalOpen(true);

    console.log(
      '[Save Flow] Step 2: Save modal opening',
      {
        saveTitle: initialTitle,
        saveFolderId: selectedFolderId || '',
        isSaveAs,
      }
    );
  };

  // ============================================================
  // SAVE WORKOUT
  // ============================================================

  const getCurrentWorkoutDoc = () => {
    const {
      description: _workoutDocDescription,
      ...workoutDocWithoutDescription
    } = baseWorkout?.workout_doc || {};
  
    return {
      ...workoutDocWithoutDescription,
      name: workoutTitle,
      steps: steps || [],
    };
  };

  const getCurrentWorkout = () => {
    const {
      description: _workoutDocDescription,
      ...workoutDocWithoutDescription
    } = baseWorkout?.workout_doc || {};
  
    const currentDescription =
      buildWorkoutDescription(steps || []);
  
    return {
      ...baseWorkout,
  
      name: workoutTitle,
  
      description: currentDescription,
  
      workout_doc: {
        ...workoutDocWithoutDescription,
        name: workoutTitle,
        steps: steps || [],
      },
    };
  };

  const handleSaveWorkout = async (
    overrideTitle,
    overrideFolderId
  ) => {
    if (readOnly) return;
    console.log(
      '[Save Flow Builder 1/8] handleSaveWorkout invoked',
      {
        overrideTitle,
        overrideFolderId,
        workoutId,
        isSaveAsMode,
      }
    );
  
    const finalTitle =
      overrideTitle?.trim() ||
      workoutTitle;
  
    const finalFolderId =
      overrideFolderId !== undefined
        ? overrideFolderId
        : selectedFolderId;
  
    // ----------------------------------------------------------
    // Description is generated from the CURRENT edited steps.
    //
    // This guarantees that Save uses exactly what the user
    // currently sees in the live builder.
    // ----------------------------------------------------------
  
    const finalDescription =
      buildWorkoutDescription(steps);
  
    /*
    * workout_doc should contain the workout structure,
    * but description belongs at the root workout level.
    *
    * Remove any legacy description that may already exist
    * inside workout_doc.
    */
    const currentWorkout =
      getCurrentWorkout();
  
    const currentWorkoutDoc = {
      ...currentWorkout.workout_doc,
      name: finalTitle,
    };
        
    const targetId =
      isSaveAsMode
        ? null
        : workoutId;
  
    const payload = {
      id: targetId,
      name: finalTitle,
      description: finalDescription,
      folder_id: finalFolderId,
      workout_doc: currentWorkoutDoc,
    };
  
    console.log(
      '[Save Flow Builder 2/8] Final builder save payload:',
      payload
    );
  
    console.log(
      '[Save Flow Builder 3/8] Generated description:',
      {
        description: finalDescription,
        descriptionLength:
          finalDescription.length,
      }
    );
  
    console.log(
      '[Save Flow Builder 4/8] Current step count:',
      Array.isArray(steps)
        ? steps.length
        : 0
    );
  
    try {
      console.log(
        '[Save Flow Builder 5/8] Calling saveWorkoutApi...'
      );
  
      const saved =
        await saveWorkoutApi(
          payload,
          isSaveAsMode
        );
  
      console.log(
        '[Save Flow Builder 6/8] saveWorkoutApi returned:',
        saved
      );
  
      if (!saved) {
        throw new Error(
          'Save API returned no workout data.'
        );
      }
  
      const newId =
        saved.id ||
        saved.workout_id ||
        targetId;
  
      console.log(
        '[Save Flow Builder 7/8] Updating local builder state:',
        {
          newId,
          finalTitle,
          finalFolderId,
        }
      );
  
      setWorkoutId(newId);
      setWorkoutTitle(finalTitle);
  
      // Use the description we actually submitted.
      setWorkoutDescription(
        saved.description ??
        finalDescription
      );
  
      setSelectedFolderId(
        finalFolderId
      );
  
      const preparedSavedBase =
        addIdsToBaseWorkout(saved);
    
      setUnalteredWorkout(saved);
      
      // Remove description from workout_doc in case the API
      // response still contains the legacy nested property.
      const {
        description: _savedWorkoutDocDescription,
        ...savedWorkoutDocWithoutDescription
      } = preparedSavedBase?.workout_doc || {};
      
      setBaseWorkout({
        ...preparedSavedBase,
      
        name: finalTitle,
      
        // Description belongs ONLY at the root.
        description:
          saved.description ??
          finalDescription,
      
        workout_doc: {
          ...savedWorkoutDocWithoutDescription,
          steps,
        },
      });
            
      console.log(
        '[Save Flow Builder 8/8] Refreshing saved workout list...'
      );
  
      const updatedData =
        await fetchWorkoutsApi();
  
      const workoutsArray =
        Array.isArray(updatedData)
          ? updatedData
          : (
              updatedData?.workouts ||
              []
            );
  
      setSavedWorkouts(
        workoutsArray
      );
  
      setIsSaveModalOpen(false);
      setIsSaveAsMode(false);
      setMode('SAVED');
  
      showToast(
        isSaveAsMode
          ? 'Workout saved as new file!'
          : 'Workout saved successfully!'
      );
  
      console.log(
        '[Save Flow SUCCESS] Workout save flow completed successfully.'
      );
  
    } catch (err) {
      console.error(
        '[Save Flow ERROR] handleSaveWorkout failed:',
        err
      );
  
      showToast(
        `Failed to save workout: ${
          err?.message ||
          'Unknown error'
        }`
      );
    }
  };
    
  // ============================================================
  // DUPLICATE WORKOUT
  // ============================================================

  const handleDuplicateWorkout = () => {
    if (readOnly) return;
    console.log(
      '[App Debug WorkoutBuilder] handleDuplicateWorkout invoked'
    );

    if (!baseWorkout) {
      showToast('No workout is currently loaded.');
      return;
    }

    const duplicateTitle =
      `${workoutTitle || 'Workout'} (Copy)`;

    setSaveTitle(duplicateTitle);
    setSaveFolderId(selectedFolderId || '');
    setWorkoutTitle(duplicateTitle);

    setMode('BUILDING');

    handleOpenSaveModal(true);
  };

  // ============================================================
  // COPY WORKOUT TEXT
  // ============================================================

  const handleCopyWorkoutText = async () => {
    console.log(
      '[App Debug WorkoutBuilder] handleCopyWorkoutText invoked'
    );
  
    try {
      const currentWorkout =
        getCurrentWorkout();
  
      console.log(
        '[App Debug WorkoutBuilder] Copying complete current workout:',
        currentWorkout
      );
  
      const stringified =
        JSON.stringify(
          currentWorkout,
          null,
          2
        );
  
      await navigator.clipboard.writeText(
        stringified
      );
  
      showToast(
        'Complete workout JSON copied to clipboard!'
      );
    } catch (err) {
      console.error(
        '[App Debug WorkoutBuilder] Copy workout failed:',
        err
      );
  
      showToast(
        'Failed to copy workout text.'
      );
    }
  };
      
  // ============================================================
  // FILE DOWNLOAD
  // ============================================================

  const triggerFileDownload = (
    content,
    fileName,
    mimeType
  ) => {
    console.log(
      '[App Debug WorkoutBuilder] triggerFileDownload invoked',
      {
        fileName,
        mimeType,
      }
    );

    const blob = new Blob(
      [content],
      { type: mimeType }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const handleDownloadIcu = async () => {
    console.log(
      '[App Debug WorkoutBuilder] handleDownloadIcu invoked'
    );

    const {
      convertWorkoutToTargetFormat,
    } = await import(
      '../utils/WorkoutConverter.js'
    );

    const textOutput =
      convertWorkoutToTargetFormat(
        steps,
        workoutMode,
        paceMethod
      );

    const content =
      typeof textOutput === 'object'
        ? JSON.stringify(
            textOutput,
            null,
            2
          )
        : textOutput;

    const cleanTitle =
      workoutTitle
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();

    triggerFileDownload(
      content,
      `${cleanTitle}.icu`,
      'text/plain'
    );
  };

  const handleDownloadZwo = async () => {
    console.log(
      '[App Debug WorkoutBuilder] handleDownloadZwo invoked'
    );

    const {
      convertWorkoutToTargetFormat,
    } = await import(
      '../utils/WorkoutConverter.js'
    );

    const zwoContent =
      convertWorkoutToTargetFormat(
        steps,
        workoutMode,
        'ZWO'
      );

    const cleanTitle =
      workoutTitle
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();

    triggerFileDownload(
      zwoContent,
      `${cleanTitle}.zwo`,
      'application/xml'
    );
  };

  // ============================================================
  // CREATE FOLDER
  // ============================================================

  const handleCreateFolder = async (
    folderName
  ) => {
    if (readOnly) return;
    console.log(
      '[App Debug WorkoutBuilder] handleCreateFolder invoked:',
      folderName
    );

    try {
      const newFolder =
        await createFolderApi(
          folderName
        );

      if (newFolder) {
        const newId =
          newFolder.id ||
          newFolder._id;

        setFolders((prev) => [
          ...prev,
          newFolder,
        ]);

        setSelectedFolderId(newId);
        setSaveFolderId(newId);
        setIsFolderModalOpen(false);

        showToast(
          `Folder "${folderName}" created.`
        );
      }
    } catch (err) {
      console.error(
        '[App Debug WorkoutBuilder] Error creating folder:',
        err
      );
    }
  };

  // ============================================================
  // CANCEL EDITS
  // ============================================================

  const handleCancelEdits = () => {
    console.log(
      '[App Debug WorkoutBuilder] handleCancelEdits invoked'
    );

    if (workoutId) {
      handleSelectWorkout(workoutId);
      showToast(
        'Reverted edits back to saved state.'
      );
    } else {
      handleNewWorkout();
    }
  };

  // ============================================================
  // CLOSE WORKOUT
  // ============================================================

  const handleCloseWorkout = () => {
    console.log(
      '[App Debug WorkoutBuilder] handleCloseWorkout invoked'
    );

    setWorkoutId(null);
    setBaseWorkout(null);
    setSteps([]);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setMode('EMPTY');
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="workout-builder-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {statusMessage && (
        <div className="status-message-banner">
          {statusMessage}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* LEFT MAIN PANEL */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* HEADER */}
          <div
            className="builder-fixed-header-section"
            style={{
              backgroundColor: '#fff',
              boxShadow:
                '0px 2px 5px rgba(0,0,0,0.05)',
              paddingBottom: '8px',
              paddingLeft: '16px',
              paddingRight: '16px',
            }}
          >
            <div className="builder-header-bar">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <h1 className="builder-header-title">
                  Workout Builder:
                </h1>

                <input
                  type="text"
                  value={workoutTitle}
                  onChange={(e) => {
                    console.log(
                      '[App Debug WorkoutBuilder] workoutTitle changed:',
                      e.target.value
                    );

                    setWorkoutTitle(
                      e.target.value
                    );

                    setSaveTitle(
                      e.target.value
                    );
                  }}
                  placeholder="Workout Title"
                  className="workout-title-input"
                  disabled={readOnly}
                  style={{
                    fontSize: '18px',
                    padding: '4px 8px',
                    fontWeight: 'bold',
                  }}
                />
              </div>

              <OptionsMenu
                mode={mode}
                onStartCreateNew={
                  handleNewWorkout
                }
                onOpenSelectModal={() => {
                  console.log(
                    '[App Debug WorkoutBuilder] OptionsMenu -> Open Select'
                  );

                  setIsEditModalOpen(true);
                }}
                onOpenCreateFolderModal={() => {
                  console.log(
                    '[App Debug WorkoutBuilder] OptionsMenu -> Create Folder'
                  );

                  setIsFolderModalOpen(true);
                }}
                onOpenSaveModal={
                  handleOpenSaveModal
                }
                onDuplicateWorkout={
                  handleDuplicateWorkout
                }
                onCopyWorkoutText={
                  handleCopyWorkoutText
                }
                onDownloadIcu={
                  handleDownloadIcu
                }
                onDownloadZwo={
                  handleDownloadZwo
                }
                onCancelEdits={
                  handleCancelEdits
                }
                onCloseWorkout={
                  handleCloseWorkout
                }
              />
            </div>

            {mode !== 'EMPTY' && (
              <div
                className="chart-preview-container"
                style={{
                  margin: '8px 0',
                  cursor: 'pointer',
                }}
              >
                <WorkoutChart
                  workout={baseWorkout}
                  thresholdPace={
                    paces?.threshold_pace || 400
                  }
                  chartHeight="140px"
                  showBarPace={false}
                />

                <WorkoutTextSection
                  workout={baseWorkout}
                  threshold={
                    paces?.threshold_pace
                  }
                  paceDetails={paces}
                />
              </div>
            )}
          </div>

          {/* SCROLLABLE STEPS */}
          <div
            className="builder-scrollable-content"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
            }}
          >
            {mode === 'EMPTY' ? (
              <div className="empty-state-card">
                <h3>
                  No Workout Selected
                </h3>

                <p>
                  Select an existing workout
                  from Options or create a
                  new one to get started.
                </p>

                {!readOnly && (
                  <button
                    className="btn-primary"
                    onClick={handleNewWorkout}
                  >
                    + Create New Workout
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div
                  className="steps-list-container"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    console.log(
                      '[App Debug WorkoutBuilder] Root steps drop'
                    );

                    handleDrop(
                      e,
                      null,
                      baseWorkout?.workout_doc
                        ?.steps?.length || 0
                    );
                  }}
                >
                  {baseWorkout?.workout_doc?.steps?.map(
                    (step, index) => (
                      <RenderStepRow
                        key={
                          step.id ||
                          `step-${index}`
                        }
                        step={step}
                        index={index}
                        parentId={null}
                        paceDetails={paces}
                        readOnly={readOnly}
                        onRemove={removeStep}
                        onUpdate={updateStepField}
                        onAddChild={addStep}
                        onDragStart={
                          handleDragStart
                        }
                        onDrop={
                          handleDrop
                        }
                      />
                    )
                  )}
                </div>

                {!readOnly && <div
                  className="root-add-actions"
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  <button
                    className="btn-add-step"
                    onClick={() => {
                      console.log(
                        '[App Debug WorkoutBuilder] Add Run'
                      );

                      addStep(
                        'run',
                        null
                      );
                    }}
                  >
                    + Add Run
                  </button>

                  <button
                    className="btn-add-step"
                    onClick={() => {
                      console.log(
                        '[App Debug WorkoutBuilder] Add Recovery'
                      );

                      addStep(
                        'recovery',
                        null
                      );
                    }}
                  >
                    + Add Recovery
                  </button>

                  <button
                    className="btn-add-step"
                    onClick={() => {
                      console.log(
                        '[App Debug WorkoutBuilder] Add Repeat'
                      );

                      addStep(
                        'repeat',
                        null
                      );
                    }}
                  >
                    + Add Repeat Block
                  </button>
                </div>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT LIVE BASEWORKOUT PANEL */}
        <div
          className="baseworkout-column-container"
          style={{
            width:
              isRightPanelCollapsed
                ? '40px'
                : '400px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            borderLeft:
              '1px solid #e0e0e0',
            padding:
              isRightPanelCollapsed
                ? '16px 8px'
                : '16px',
            transition:
              'width 0.2s ease-in-out',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              marginBottom:
                isRightPanelCollapsed
                  ? '0px'
                  : '8px',
            }}
          >
            {!isRightPanelCollapsed && (
              <label
                htmlFor="baseworkout-input"
                style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                }}
              >
                Updated Live
              </label>
            )}

            <button
              type="button"
              onClick={() => {
                console.log(
                  '[App Debug WorkoutBuilder] Toggle panel collapse'
                );

                setIsRightPanelCollapsed(
                  (prev) => !prev
                );
              }}
              title={
                isRightPanelCollapsed
                  ? 'Expand Panel'
                  : 'Collapse Panel'
              }
              style={{
                background: 'none',
                border:
                  '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '12px',
                marginLeft:
                  isRightPanelCollapsed
                    ? 'auto'
                    : '0',
                marginRight:
                  isRightPanelCollapsed
                    ? 'auto'
                    : '0',
              }}
            >
              {isRightPanelCollapsed
                ? '◀'
                : '▶'}
            </button>
          </div>

          {!isRightPanelCollapsed && (
            <textarea
              id="baseworkout-input"
              readOnly
              value={JSON.stringify(
                baseWorkout || {},
                null,
                2
              )}
              placeholder="No baseWorkout payload available..."
              style={{
                width: '100%',
                flex: 1,
                fontFamily:
                  'monospace',
                fontSize: '12px',
                padding: '12px',
                backgroundColor:
                  '#f4f4f6',
                border:
                  '1px solid #ccc',
                borderRadius: '4px',
                resize: 'none',
                overflowY: 'auto',
              }}
            />
          )}
        </div>
      </div>

      {/* FOLDER MODAL */}
      {isFolderModalOpen && (
        <Modal_Folder_Create
          onClose={() => {
            setIsFolderModalOpen(false);
          }}
          onCreate={
            handleCreateFolder
          }
        />
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <Modal_Workout_Edit
          isOpen={isEditModalOpen}
          workouts={savedWorkouts}
          folders={folders}
          currentFolderId={
            selectedFolderId
          }
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onSelectWorkout={
            handleSelectWorkout
          }
          onClose={() => {
            setIsEditModalOpen(false);
          }}
        />
      )}

      {/* SAVE MODAL */}
      {isSaveModalOpen && (
        <Modal_Workout_Save
          isOpen={isSaveModalOpen}
          saveAsNew={isSaveAsMode}
          saveTitle={saveTitle}
          setSaveTitle={setSaveTitle}
          saveFolderId={saveFolderId}
          setSaveFolderId={
            setSaveFolderId
          }
          folders={folders}
          apiLoading={isSaving}
          onConfirmSave={
            handleSaveWorkout
          }
          onClose={() => {
            console.log(
              '[Save Flow] Save modal cancelled'
            );

            if (!isSaving) {
              setIsSaveModalOpen(false);
              setIsSaveAsMode(false);
            }
          }}
        />
      )}

      {/* ZOOM MODAL */}
      {isZoomModalOpen && (
        <Modal_Workout_Zoom
          steps={steps}
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onClose={() => {
            setIsZoomModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
