//
// useWorkoutSteps.js
//
import { useState } from 'react';
import { createStep } from '../utils/WorkoutBuilderHelpers.js';

// Helper for deep property setting (e.g. "pace.value")
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = { ...obj };
  let pointer = current;

  for (const key of keys) {
    pointer[key] = { ...pointer[key] };
    pointer = pointer[key];
  }
  pointer[lastKey] = value;
  return current;
}

export function useWorkoutSteps(initialSteps = [], workoutMode = 'time') {
  const [steps, setSteps] = useState(initialSteps);
  const [draggedItem, setDraggedItem] = useState(null);

  const addStep = (type, parentRepeatId = null) => {
    const newStep = createStep(type, workoutMode);
    if (!parentRepeatId) {
      setSteps((prev) => [...prev, newStep]);
    } else {
      const addRecursive = (list) =>
        list.map((s) => {
          const isRepeat = s.type === 'repeat' || Boolean(s.reps) || Array.isArray(s.steps);
          if (s.id === parentRepeatId && isRepeat) {
            return { ...s, steps: [...(s.steps || []), newStep] };
          }
          if (isRepeat && s.steps) {
            return { ...s, steps: addRecursive(s.steps) };
          }
          return s;
        });
      setSteps((prev) => addRecursive(prev));
    }
  };

  const removeStep = (id) => {
    const filterRecursive = (list) =>
      list
        .filter((s) => s.id !== id)
        .map((s) => {
          if (s.steps && Array.isArray(s.steps)) {
            return { ...s, steps: filterRecursive(s.steps) };
          }
          return s;
        });
    setSteps((prev) => filterRecursive(prev));
  };

  const updateStepField = (id, field, value) => {
    const updateRecursive = (list) =>
      list.map((s) => {
        if (s.id === id) {
          if (field.includes('.')) {
            return setNestedProperty(s, field, value);
          }
          return { ...s, [field]: value };
        }
        if (s.steps && Array.isArray(s.steps)) {
          return { ...s, steps: updateRecursive(s.steps) };
        }
        return s;
      });
    setSteps((prev) => updateRecursive(prev));
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
        if (s.id === parentId && Array.isArray(s.steps)) {
          return { ...s, steps: s.steps.filter((child) => child.id !== stepId) };
        }
        if (Array.isArray(s.steps)) {
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
        if (s.id === parentId && Array.isArray(s.steps)) {
          const nextSteps = [...s.steps];
          nextSteps.splice(index, 0, item);
          return { ...s, steps: nextSteps };
        }
        if (Array.isArray(s.steps)) {
          return { ...s, steps: insertIntoTree(s.steps, parentId, index, item) };
        }
        return s;
      });
    };

    setSteps((prevSteps) => {
      const treeWithoutItem = removeFromTree(prevSteps, sourceParentId, itemToMove.id);
      return insertIntoTree(treeWithoutItem, targetParentId, targetIndex, itemToMove);
    });
    setDraggedItem(null);
  };

  return {
    steps,
    setSteps,
    addStep,
    removeStep,
    updateStepField,
    handleDragStart,
    handleDrop
  };
}