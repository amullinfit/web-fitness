import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Copy, 
  FilePlus, 
  Folder, 
  ArrowLeft, 
  Check, 
  ChevronUp, 
  ChevronDown,
  Layers,
  FileText
} from 'lucide-react';

// Helper to ensure step items have unique IDs for React key stability
const addIdsToBaseWorkout = (workout) => {
  if (!workout) return null;
  const stepsWithIds = (workout.steps || []).map((step, idx) => ({
    ...step,
    id: step.id || `step-${Date.now()}-${idx}`
  }));
  return { ...workout, steps: stepsWithIds };
};

// Fallback text serializer in case target format converter is missing or custom
const convertWorkoutToTargetFormat = (steps, mode, paceMethod) => {
  return steps.map((step) => {
    let line = `- `;
    if (step.type === 'warmup') line += 'Warmup ';
    else if (step.type === 'cooldown') line += 'Cooldown ';
    else if (step.type === 'rest') line += 'Rest ';
    
    if (step.duration) line += `${step.duration} `;
    if (step.target) line += `@ ${step.target}`;
    
    return line.trim();
  }).join('\n');
};

export default function WorkoutBuilder({
  initialWorkout = null,
  folders = [],
  saveWorkoutApi,
  fetchWorkoutsApi,
  setSavedWorkouts,
  showToast = () => {},
  onBack = () => {}
}) {
  // --- Core State ---
  const [workoutId, setWorkoutId] = useState(initialWorkout?.id || null);
  const [workoutTitle, setWorkoutTitle] = useState(initialWorkout?.name || initialWorkout?.title || 'New Workout');
  const [workoutDescription, setWorkoutDescription] = useState(initialWorkout?.description || '');
  const [selectedFolderId, setSelectedFolderId] = useState(initialWorkout?.folder_id ?? initialWorkout?.folderId ?? null);
  
  const [workoutMode, setWorkoutMode] = useState('distance'); // 'distance' | 'duration'
  const [paceMethod, setPaceMethod] = useState('pace'); // 'pace' | 'hr' | 'power'
  const [mode, setMode] = useState(initialWorkout?.id ? 'SAVED' : 'BUILDING'); // 'BUILDING' | 'SAVED' | 'EDITING'
  
  const [baseWorkout, setBaseWorkout] = useState(addIdsToBaseWorkout(initialWorkout));
  const [unalteredWorkout, setUnalteredWorkout] = useState(initialWorkout);

  // Steps state
  const [steps, setSteps] = useState(
    initialWorkout?.steps || [
      { id: 'step-1', type: 'warmup', duration: '10m', target: 'Zone 1 Pace', note: '' },
      { id: 'step-2', type: 'interval', duration: '1km', target: '5k Pace', note: '' },
      { id: 'step-3', type: 'rest', duration: '2m', target: 'Easy Jog', note: '' },
      { id: 'step-4', type: 'cooldown', duration: '10m', target: 'Zone 1 Pace', note: '' }
    ]
  );

  // Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaveAsMode, setIsSaveAsMode] = useState(false);
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [modalFolderInput, setModalFolderInput] = useState(null);

  // Keep state in sync if initialWorkout prop updates
  useEffect(() => {
    if (initialWorkout) {
      const prepared = addIdsToBaseWorkout(initialWorkout);
      setWorkoutId(initialWorkout.id || null);
      setWorkoutTitle(initialWorkout.name || initialWorkout.title || 'New Workout');
      setWorkoutDescription(initialWorkout.description || '');
      setSelectedFolderId(initialWorkout.folder_id ?? initialWorkout.folderId ?? null);
      if (initialWorkout.steps) setSteps(prepared.steps);
      setBaseWorkout(prepared);
      setUnalteredWorkout(initialWorkout);
      setMode('SAVED');
    }
  }, [initialWorkout]);

  // --- Step Manipulation Handlers ---
  const handleAddStep = (type = 'interval') => {
    const newStep = {
      id: `step-${Date.now()}`,
      type,
      duration: type === 'warmup' || type === 'cooldown' ? '10m' : '1km',
      target: 'Threshold Pace',
      note: ''
    };
    setSteps((prev) => [...prev, newStep]);
    setMode('BUILDING');
  };

  const handleUpdateStep = (id, key, value) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, [key]: value } : step))
    );
    setMode('BUILDING');
  };

  const handleDeleteStep = (id) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
    setMode('BUILDING');
  };

  const handleMoveStep = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const newSteps = [...steps];
    const [moved] = newSteps.splice(index, 1);
    newSteps.splice(targetIndex, 0, moved);
    setSteps(newSteps);
    setMode('BUILDING');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all steps?')) {
      setSteps([]);
      setMode('BUILDING');
    }
  };

  // --- Modal & Save Handlers ---
  const handleOpenSaveModal = (isSaveAs = false) => {
    console.log('[App Debug WorkoutBuilder] handleOpenSaveModal invoked with isSaveAs:', isSaveAs);
    setIsSaveAsMode(isSaveAs);
    setModalTitleInput(isSaveAs ? `${workoutTitle} (Copy)` : workoutTitle);
    setModalFolderInput(selectedFolderId);
    setIsSaveModalOpen(true);
  };

  const handleSaveWorkout = async (overrideTitle, overrideFolderId) => {
    console.log('[App Debug WorkoutBuilder] handleSaveWorkout invoked', { overrideTitle, overrideFolderId });
    
    const finalTitle = overrideTitle || workoutTitle;
    const finalFolderId = overrideFolderId !== undefined ? overrideFolderId : selectedFolderId;
    const icuDocument = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const targetId = isSaveAsMode ? null : workoutId;

    const payload = {
      id: targetId,
      name: finalTitle,
      description: workoutDescription,
      folder_id: finalFolderId,
      document: icuDocument,
      steps
    };

    try {
      let saved = null;
      if (typeof saveWorkoutApi === 'function') {
        saved = await saveWorkoutApi(payload);
      } else {
        // Local simulation fallback
        saved = { ...payload, id: targetId || `w-${Date.now()}` };
      }

      if (saved) {
        const newId = saved.id || saved.workout_id || targetId;
        setWorkoutId(newId);
        setWorkoutTitle(finalTitle);
        setSelectedFolderId(finalFolderId);

        const preparedSavedBase = addIdsToBaseWorkout(saved);
        setUnalteredWorkout(saved);
        setBaseWorkout({
          ...preparedSavedBase,
          name: finalTitle
        });

        // Re-fetch workouts list to stay synchronized if API provided
        if (typeof fetchWorkoutsApi === 'function' && typeof setSavedWorkouts === 'function') {
          const updatedData = await fetchWorkoutsApi();
          const workoutsArray = Array.isArray(updatedData) 
            ? updatedData 
            : (updatedData?.workouts || []);
          setSavedWorkouts(workoutsArray);
        }

        setIsSaveModalOpen(false);
        setIsSaveAsMode(false);
        setMode('SAVED');
        showToast(isSaveAsMode ? 'Workout saved as new file!' : 'Workout saved successfully!');
      }
    } catch (err) {
      console.error('Error saving workout:', err);
      showToast('Failed to save workout. Please try again.');
    }
  };

  const handleDuplicateWorkout = (workoutToDuplicate) => {
    console.log('[App Debug WorkoutBuilder] handleDuplicateWorkout invoked');

    const target = workoutToDuplicate || baseWorkout;
    const sourceTitle = target?.name || target?.title || workoutTitle || 'Workout';
    const sourceFolderId = target?.folder_id ?? target?.folderId ?? selectedFolderId;

    const duplicateTitle = `${sourceTitle} (Copy)`;

    setWorkoutId(null);
    setWorkoutTitle(duplicateTitle);
    setSelectedFolderId(sourceFolderId);
    setMode('BUILDING');

    handleOpenSaveModal(true);
    showToast('Workout duplicated! Choose a folder and save your new copy.');
  };

  const handleCopyWorkoutText = () => {
    console.log('[App Debug WorkoutBuilder] handleCopyWorkoutText invoked');
    const textOutput = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);
    const stringified = typeof textOutput === 'object' ? JSON.stringify(textOutput, null, 2) : textOutput;
    navigator.clipboard.writeText(stringified);
    showToast('Workout plain text copied to clipboard!');
  };

  const formattedOutput = convertWorkoutToTargetFormat(steps, workoutMode, paceMethod);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 bg-slate-900 text-slate-100 min-h-screen rounded-xl shadow-2xl">
      {/* Top Header / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={workoutTitle}
                onChange={(e) => {
                  setWorkoutTitle(e.target.value);
                  setMode('BUILDING');
                }}
                placeholder="Workout Title"
                className="bg-transparent text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
              />
              {mode === 'SAVED' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Check className="w-3 h-3 mr-1" /> Saved
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {workoutId ? `ID: ${workoutId}` : 'Unsaved Draft'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleCopyWorkoutText}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Text</span>
          </button>

          <button
            onClick={() => handleDuplicateWorkout()}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <FilePlus className="w-4 h-4" />
            <span>Duplicate</span>
          </button>

          {workoutId && (
            <button
              onClick={() => handleOpenSaveModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save As...</span>
            </button>
          )}

          <button
            onClick={() => {
              if (workoutId) {
                handleSaveWorkout(workoutTitle, selectedFolderId);
              } else {
                handleOpenSaveModal(false);
              }
            }}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{workoutId ? 'Save' : 'Save Workout'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Workout Builder Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Workout Steps ({steps.length})
              </h2>
              <button
                onClick={handleClearAll}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Steps List */}
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-all"
                >
                  <div className="flex flex-col gap-1 text-slate-500">
                    <button
                      onClick={() => handleMoveStep(index, -1)}
                      disabled={index === 0}
                      className="hover:text-slate-200 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveStep(index, 1)}
                      disabled={index === steps.length - 1}
                      className="hover:text-slate-200 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Step Type Selector */}
                  <select
                    value={step.type}
                    onChange={(e) => handleUpdateStep(step.id, 'type', e.target.value)}
                    className="bg-slate-800 text-xs font-semibold uppercase text-slate-200 border border-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="warmup">Warmup</option>
                    <option value="interval">Interval</option>
                    <option value="rest">Rest</option>
                    <option value="cooldown">Cooldown</option>
                  </select>

                  {/* Step Duration */}
                  <input
                    type="text"
                    value={step.duration}
                    onChange={(e) => handleUpdateStep(step.id, 'duration', e.target.value)}
                    placeholder="Duration (e.g. 5m, 1km)"
                    className="w-24 bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                  />

                  {/* Target Intensity */}
                  <input
                    type="text"
                    value={step.target}
                    onChange={(e) => handleUpdateStep(step.id, 'target', e.target.value)}
                    placeholder="Target (e.g. Zone 2, 5:00/km)"
                    className="flex-1 bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                  />

                  {/* Delete Step */}
                  <button
                    onClick={() => handleDeleteStep(step.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {steps.length === 0 && (
                <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No steps added yet. Click below to add your first block.
                </div>
              )}
            </div>

            {/* Add Step Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleAddStep('warmup')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> <span>Warmup</span>
              </button>
              <button
                onClick={() => handleAddStep('interval')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-950/60 hover:bg-blue-900/60 text-xs font-medium text-blue-300 rounded border border-blue-800/60 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> <span>Interval</span>
              </button>
              <button
                onClick={() => handleAddStep('rest')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> <span>Rest</span>
              </button>
              <button
                onClick={() => handleAddStep('cooldown')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> <span>Cooldown</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Preview & Folder Selection */}
        <div className="space-y-4">
          {/* Metadata Card */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Folder className="w-4 h-4" /> Folder Assignment
            </h3>
            <select
              value={selectedFolderId || ''}
              onChange={(e) => {
                const val = e.target.value ? e.target.value : null;
                setSelectedFolderId(val);
                setMode('BUILDING');
              }}
              className="w-full bg-slate-900 text-slate-200 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">(No Folder / Root)</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name || folder.title}
                </option>
              ))}
            </select>
          </div>

          {/* Formatted Target Output Preview */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Formatted Output Preview
              </h3>
            </div>
            <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto border border-slate-900 min-h-[160px]">
              {typeof formattedOutput === 'string'
                ? formattedOutput
                : JSON.stringify(formattedOutput, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Save / Save-As Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {isSaveAsMode ? 'Save Workout As New Copy' : 'Save Workout'}
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Workout Name
                </label>
                <input
                  type="text"
                  value={modalTitleInput}
                  onChange={(e) => setModalTitleInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter workout name..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Folder
                </label>
                <select
                  value={modalFolderInput || ''}
                  onChange={(e) => setModalFolderInput(e.target.value ? e.target.value : null)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">(No Folder / Root)</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name || folder.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveWorkout(modalTitleInput, modalFolderInput)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}