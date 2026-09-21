import React from 'react';
import { modalOverlayStyle, modalContentStyle } from './modalStyles';

export default function Modal_Workout_Zoom({
  isOpen,
  onClose,
  workoutTitle,
  steps,
  workoutMode,
  dynamicPresets,
  RenderWorkoutChart,
}) {
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalContentStyle, width: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>{workoutTitle} - Profile View</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <RenderWorkoutChart steps={steps} height={280} workoutMode={workoutMode} presets={dynamicPresets} />
      </div>
    </div>
  );
}