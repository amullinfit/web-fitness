import React, { useEffect } from 'react';

export default function WorkoutChart({ steps, containerId }) {
  useEffect(() => {
    if (!steps || !Array.isArray(steps) || !window.Highcharts) return;

    const categories = [];
    const seriesData = [];

    steps.forEach((step, idx) => {
      // Guard clause: ensure step exists
      if (!step) return;

      const label = step.name || `Step ${idx + 1}`;
      categories.push(label);
      
      // Safely check power, hr, or target values with optional chaining
      const targetVal = 
        step.power?.value ?? 
        step.hr?.value ?? 
        step.value ?? 
        step.target ?? 
        0;

      seriesData.push(targetVal);
    });

    // Verify container element exists in DOM before building chart
    const container = document.getElementById(containerId);
    if (!container) return;

    window.Highcharts.chart(containerId, {
      chart: {
        type: 'column',
        height: 180,
        backgroundColor: 'transparent',
      },
      title: { text: null },
      xAxis: {
        categories: categories,
        labels: { style: { fontSize: '10px' } },
      },
      yAxis: {
        title: { text: null },
        labels: { enabled: true },
      },
      legend: { enabled: false },
      credits: { enabled: false },
      series: [{
        name: 'Target Intensity',
        data: seriesData,
        color: '#007bff',
      }],
    });
  }, [steps, containerId]);

  return <div id={containerId} style={{ width: '100%', height: '180px' }} />;
}