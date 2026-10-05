import React, { useState, useEffect } from 'react';
import { saveWorkoutApi, convertStepsToIcuText } from '../utils/WorkoutBuilderHelpers';

// Zero-dependency Unicode / Emoji icon components (replaces lucide-react)
const Save = ({ className = "inline-block" }) => <span className={className}>💾</span>;
const Folder = ({ className = "inline-block" }) => <span className={className}>📁</span>;
const Plus = ({ className = "inline-block" }) => <span className={className}>➕</span>;
const Trash2 = ({ className = "inline-block" }) => <span className={className}>🗑️</span>;
const ChevronDown = ({ className = "inline-block" }) => <span className={className}>▼</span>;
const ChevronUp = ({ className = "inline-block" }) => <span className={className}>▲</span>;
const X = ({ className = "inline-block" }) => <span className={className}>✖</span>;
const Edit = ({ className = "inline-block" }) => <span className={className}>✏️</span>;
const Copy = ({ className = "inline-block" }) => <span className={className}>📋</span>;

// Helper functions for time and pace conversions
const formatSecondsToMMSS = (sec) => {
  if (!sec && sec !== 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const parsePaceToSec = (paceStr) => {
  if (!paceStr) return 0;
  const parts = paceStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return parseInt(paceStr, 10) || 0;
};

export default function WorkoutBuilder({ initialWorkout = null, folders = [], onSaveSuccess }) {
  const [workout, setWorkout] = useState({
    id: initialWorkout?.id || null,
    name: initialWorkout?.name || 'New Structured Workout',
    folder_id: initialWorkout?.folder_id || null,
    type: initialWorkout?.type || 'Run',
  });

  const [steps, setSteps] = useState(
    initialWorkout?.workout_doc?.steps || [
      { id: 'step-1', type: 'warmup', durationSec: 600, targetPaceSec: 540 },
      { id: 'step-2', type: 'run', durationSec: 1800, targetPaceSec: 480 },
      { id: 'step-3', type: 'cooldown', durationSec: 600, targetPaceSec: 570 },
    ]
  );

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState(workout.name);
  const [saveFolderId, setSaveFolderId] = useState(workout.folder_id || '');
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (initialWorkout) {
      setWorkout({
        id: initialWorkout.id || null,
        name: initialWorkout.name || 'New Structured Workout',
        folder_id: initialWorkout.folder_id || null,
        type: initialWorkout.type || 'Run',
      });
      setSaveTitle(initialWorkout.name || 'New Structured Workout');
      setSaveFolderId(initialWorkout.folder_id || '');
      if (initialWorkout.workout_doc?.steps) {
        setSteps(initialWorkout.workout_doc.steps);
      }
    }
  }, [initialWorkout]);

  // Step Operations
  const addStep = (type = 'run') => {
    const newStep = {
      id: `step-${Date.now()}`,
      type,
      durationSec: 300,
      targetPaceSec: 480,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id, field, value) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeStep = (id) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const moveStep = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const newSteps = [...steps];
    const [movedStep] = newSteps.splice(index, 1);
    newSteps.splice(targetIndex, 0, movedStep);
    setSteps(newSteps);
  };

  // Open Modal Handler
  const handleOpenSaveModal = (asNew = false) => {
    setSaveAsNew(asNew || !workout.id);
    setSaveTitle(workout.name);
    setSaveFolderId(workout.folder_id || '');
    setErrorMessage('');
    setSuccessMessage('');
    setIsSaveModalOpen(true);
  };

  // Confirm Save Handler
  const handleConfirmSave = async () => {
    setApiLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        id: saveAsNew ? null : workout.id,
        name: saveTitle,
        folderId: saveFolderId,
        type: workout.type,
        steps: steps,
        workout_doc: {
          name: saveTitle,
          steps: steps,
        },
      };

      const savedResult = await saveWorkoutApi(payload, saveAsNew);

      if (savedResult?.id) {
        setWorkout((prev) => ({
          ...prev,
          id: savedResult.id,
          name: saveTitle,
          folder_id: saveFolderId,
        }));
      }

      setSuccessMessage('Workout saved successfully!');
      if (onSaveSuccess) onSaveSuccess(savedResult);

      setTimeout(() => {
        setIsSaveModalOpen(false);
        setSuccessMessage('');
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save workout');
    } finally {
      setApiLoading(false);
    }
  };

  const totalSeconds = steps.reduce((acc, s) => acc + (s.durationSec || 0), 0);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-slate-900 text-slate-100 rounded-xl shadow-xl border border-slate-800">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Folder />
            {workout.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Total Duration: <span className="text-sky-400 font-semibold">{formatSecondsToMMSS(totalSeconds)}</span>
            {workout.id ? ` • ID: ${workout.id}` : ' • Unsaved Draft'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenSaveModal(false)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow"
          >
            <Save />
            Save
          </button>

          {workout.id && (
            <button
              onClick={() => handleOpenSaveModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium border border-slate-700 transition-colors"
            >
              <Copy />
              Save as New
            </button>
          )}
        </div>
      </div>

      {/* Step List */}
      <div className="my-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Workout Steps</h2>

        {steps.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No steps added yet. Click below to add your first step.
          </div>
        ) : (
          steps.map((step, idx) => (
            <div
              key={step.id || idx}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg hover:border-slate-600 transition-all"
            >
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-xs"
                  >
                    <ChevronUp />
                  </button>
                  <button
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-xs"
                  >
                    <ChevronDown />
                  </button>
                </div>

                <select
                  value={step.type}
                  onChange={(e) => updateStep(step.id, 'type', e.target.value)}
                  className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:border-sky-500"
                >
                  <option value="warmup">Warmup</option>
                  <option value="run">Run / Active</option>
                  <option value="recover">Recover</option>
                  <option value="cooldown">Cooldown</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs">
                <div className="flex items-center gap-1.5">
                  <label className="text-slate-400">Duration (m:s):</label>
                  <input
                    type="text"
                    value={formatSecondsToMMSS(step.durationSec)}
                    onChange={(e) => updateStep(step.id, 'durationSec', parsePaceToSec(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-center font-mono focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-slate-400">Target Pace (/mi):</label>
                  <input
                    type="text"
                    value={formatSecondsToMMSS(step.targetPaceSec)}
                    onChange={(e) => updateStep(step.id, 'targetPaceSec', parsePaceToSec(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-center font-mono focus:border-sky-500"
                  />
                </div>

                <button
                  onClick={() => removeStep(step.id)}
                  className="p-1.5 bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 rounded transition-colors ml-auto sm:ml-0"
                  title="Delete step"
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Step Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
        <span className="text-xs text-slate-400 font-medium mr-1">Add Step:</span>
        <button
          onClick={() => addStep('warmup')}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-xs font-medium border border-slate-700"
        >
          <Plus /> Warmup
        </button>
        <button
          onClick={() => addStep('run')}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-xs font-medium border border-slate-700"
        >
          <Plus /> Run
        </button>
        <button
          onClick={() => addStep('recover')}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-xs font-medium border border-slate-700"
        >
          <Plus /> Recover
        </button>
        <button
          onClick={() => addStep('cooldown')}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-medium border border-slate-700"
        >
          <Plus /> Cooldown
        </button>
      </div>

      {/* Intervals.icu DSL Preview */}
      <div className="mt-8 pt-4 border-t border-slate-800">
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 flex items-center justify-between font-medium">
            <span>View Intervals.icu DSL Text Output</span>
            <ChevronDown />
          </summary>
          <pre className="mt-3 p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg border border-slate-800 overflow-x-auto">
            {typeof convertStepsToIcuText === 'function' ? convertStepsToIcuText(steps) : 'DSL converter function unavailable'}
          </pre>
        </details>
      </div>

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsSaveModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1"
            >
              <X />
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Save />
              {saveAsNew ? 'Save as New Workout' : 'Save Workout'}
            </h3>

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-lg">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-lg">
                {successMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Workout Title
                </label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  placeholder="e.g., 5x 1km Intervals"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Folder / Category
                </label>
                <select
                  value={saveFolderId}
                  onChange={(e) => setSaveFolderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                >
                  <option value="">Root (No Folder)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                disabled={apiLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmSave}
                disabled={apiLoading}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {apiLoading ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}