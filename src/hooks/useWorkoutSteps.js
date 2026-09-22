//
// useWorkoutSteps.js
//
import { useState } from 'react';
import { createStep } from '../utils/WorkoutBuilderHelpers.js';

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
                    if (s.id === parentRepeatId && s.type === 'repeat') {
                        return { ...s, steps: [...(s.steps || []), newStep] };
                    }
                    if (s.type === 'repeat') {
                        return { ...s, steps: addRecursive(s.steps || []) };
                    }
                    return s;
                });
            setSteps((prev) => addRecursive(prev));
        }
    };

    const removeStep = (id) => {
        const filterRecursive = (list) =>
            list.filter((s) => s.id !== id).map((s) => (s.type === 'repeat' ? { ...s, steps: filterRecursive(s.steps || []) } : s));
        setSteps((prev) => filterRecursive(prev));
    };

    const updateStepField = (id, field, value) => {
        const updateRecursive = (list) =>
            list.map((s) => {
                if (s.id === id) return { ...s, [field]: value };
                if (s.type === 'repeat') return { ...s, steps: updateRecursive(s.steps || []) };
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