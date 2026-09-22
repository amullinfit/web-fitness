//
// useWorkoutSteps.js
//
import { useState } from 'react';
import { createStep } from '../utils/WorkoutBuilderHelpers.js';

export function useWorkoutSteps(baseWorkout, setBaseWorkout, workoutMode = 'time') {
  const [draggedItem, setDraggedItem] = useState(null);

  // Helper to check if a step is a repeater container
  const isRepeatBlock = (s) => s.type === 'repeat' || Boolean(s.reps) || Array.isArray(s.steps);

  // Helper to safely target and update baseWorkout.workout_doc.steps
  const updateStepsTree = (transformFn) => {
    setBaseWorkout((prev) => {
      if (!prev?.workout_doc?.steps) return prev;
      return {
        ...prev,
        workout_doc: {
          ...prev.workout_doc,
          steps: transformFn(prev.workout_doc.steps)
        }
      };
    });
  };

  const addStep = (type, parentRepeatId = null) => {
    const newStep = createStep(type, workoutMode);
    
    updateStepsTree((steps) => {
      if (!parentRepeatId) {
        return [...steps, newStep];
      }
      
      const addRecursive = (list) =>
        list.map((s) => {
          if (s.id === parentRepeatId && isRepeatBlock(s)) {
            return { ...s, steps: [...(s.steps || []), newStep] };
          }
          if (isRepeatBlock(s)) {
            return { ...s, steps: addRecursive(s.steps || []) };
          }
          return s;
        });

      return addRecursive(steps);
    });
  };

  const removeStep = (id) => {
    updateStepsTree((steps) => {
      const filterRecursive = (list) =>
        list
          .filter((s) => s.id !== id)
          .map((s) => (isRepeatBlock(s) ? { ...s, steps: filterRecursive(s.steps || []) } : s));

      return filterRecursive(steps);
    });
  };

  const updateStepField = (id, field, value) => {
    updateStepsTree((steps) => {
      const updateRecursive = (list) =>
        list.map((s) => {
          if (s.id === id) return { ...s, [field]: value };
          if (isRepeatBlock(s)) return { ...s, steps: updateRecursive(s.steps || []) };
          return s;
        });

      return updateRecursive(steps);
    });
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
        if (s.id === parentId && isRepeatBlock(s)) {
          return { ...s, steps: (s.steps || []).filter((child) => child.id !== stepId) };
        }
        if (isRepeatBlock(s)) {
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
        if (s.id === parentId && isRepeatBlock(s)) {
          const nextSteps = [...(s.steps || [])];
          nextSteps.splice(index, 0, item);
          return { ...s, steps: nextSteps };
        }
        if (isRepeatBlock(s)) {
          return { ...s, steps: insertIntoTree(s.steps || [], parentId, index, item) };
        }
        return s;
      });
    };

    updateStepsTree((prevSteps) => {
      const treeWithoutItem = removeFromTree(prevSteps, sourceParentId, itemToMove.id);
      return insertIntoTree(treeWithoutItem, targetParentId, targetIndex, itemToMove);
    });

    setDraggedItem(null);
  };

  return {
    steps: baseWorkout?.workout_doc?.steps || [],
    addStep,
    removeStep,
    updateStepField,
    handleDragStart,
    handleDrop
  };
}