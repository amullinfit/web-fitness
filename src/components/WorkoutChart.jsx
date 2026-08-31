import React, { useEffect, useRef } from 'react';

export default function WorkoutChart({ steps, containerId }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!steps || !Array.isArray(steps) || !window.Highcharts) return;

    // Helper to recursively flatten steps (handles repetition loops/groups)
    const flattenSteps = (stepList) => {
      let result = [];
      stepList.forEach((s) => {
        if (!s) return;
        if (Array.isArray(s.steps)) {
          // Flatten nested step groups / repetitions
          const repeatCount = s.repetition || 1;
          for (let i = 0; i < repeatCount; i++) {
            result = result.concat(flattenSteps(s.steps));
          }
        } else {
          result.push(s);
        }
      });
      return result;
    };

    const flatSteps = flattenSteps(steps);
    if (flatSteps.length === 0) return;

    const categories = [];
    const seriesData = [];

    flatSteps.forEach((step, idx) => {
      const label = step.name || (step.type ? step.type : `Step ${idx + 1}`);
      categories.push(label);

      // Extract target intensity from various possible Intervals.icu fields
      let targetVal = 0;
      if (step.power) targetVal = typeof step.power === 'object' ? (step.power.value || step.power.start || 0) : step.power;
      else if (step.hr) targetVal = typeof step.hr === 'object' ? (step.hr.value || step.hr.start || 0) : step.hr;
      else if (step.target) targetVal = typeof step.target === 'object' ? (step.target.value || 0) : step.target;
      else if (step.value) targetVal = step.value;

      seriesData.push(Math.round(targetVal));
    });

    // Ensure DOM container exists
    if (!chartRef.current) return;

    // Render Highcharts Column Chart
    window.Highcharts.chart(chartRef.current, {
      chart: {
        type: 'column',
        height: 160,
        backgroundColor: 'transparent',
        spacing: [5, 5, 5, 5]
      },
      title: { text: null },
      xAxis: {
        categories: categories,
        labels: { style: { fontSize: '9px' } }
      },
      yAxis: {
        title: { text: null },
        labels: { style: { fontSize: '9px' } }
      },
      legend: { enabled: false },
      credits: { enabled: false },
      tooltip: {
        formatter: function() {
          return `<b>${this.x}</b>: ${this.y}% Target`;
        }
      },
      series: [{
        name: 'Target Intensity',
        data: seriesData,
        color: '#007bff'
      }]
    });
  }, [steps]);

  return <div ref={chartRef} id={containerId} style={{ width: '100%', height: '160px', marginTop: '10px' }} />;
}