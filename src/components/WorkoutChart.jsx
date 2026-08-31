import React, { useEffect, useRef } from 'react';

export default function WorkoutChart({ steps, containerId }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!steps || !window.Highcharts) return;

    let currentTime = 0;
    const seriesData = [];

    const getPatternUrl = (powerValue) => {
      if (powerValue <= 60) return "https://usetrmnl.com/images/grayscale/gray-6.png";
      if (powerValue <= 80) return "https://usetrmnl.com/images/grayscale/gray-5.png";
      if (powerValue <= 90) return "https://usetrmnl.com/images/grayscale/gray-4.png";
      if (powerValue <= 105) return "https://usetrmnl.com/images/grayscale/gray-3.png";
      if (powerValue <= 120) return "https://usetrmnl.com/images/grayscale/gray-2.png";
      if (powerValue <= 150) return "https://usetrmnl.com/images/grayscale/gray-1.png";
      return "https://usetrmnl.com/images/grayscale/black.png";
    };

    const processSteps = (stepList) => {
      stepList.forEach((step) => {
        if (step.freeride) {
          const nextTime = currentTime + step.duration;
          seriesData.push({
            data: [[currentTime / 60, 1], [nextTime / 60, 1]],
            color: "#000000",
            fillColor: { pattern: { image: getPatternUrl(1), width: 16, height: 16, aspectRatio: 1 } },
            lineWidth: 2
          });
          currentTime = nextTime;
        } else if (step.ramp) {
          const segments = 10;
          for (let i = 0; i < segments; i++) {
            const segStart = currentTime + (i * step.duration / segments);
            const segEnd = currentTime + ((i + 1) * step.duration / segments);
            const segPower = step.power.start + (step.power.end - step.power.start) * (i / segments);
            seriesData.push({
              data: [[segStart / 60, segPower], [segEnd / 60, segPower]],
              color: "#000000",
              fillColor: { pattern: { image: getPatternUrl(segPower), width: 16, height: 16, aspectRatio: 1 } },
              lineWidth: 2
            });
          }
          currentTime += step.duration;
        } else if (step.reps) {
          for (let r = 0; r < step.reps; r++) processSteps(step.steps);
        } else {
          const nextTime = currentTime + step.duration;
          const pVal = step.power ? step.power.value : 0;
          seriesData.push({
            data: [[currentTime / 60, pVal], [nextTime / 60, pVal]],
            color: "#000000",
            fillColor: { pattern: { image: getPatternUrl(pVal), width: 16, height: 16, aspectRatio: 1 } },
            lineWidth: 2
          });
          currentTime = nextTime;
        }
      });
    };

    processSteps(steps);

    window.Highcharts.chart(chartRef.current, {
      chart: { type: 'area', height: 220, animation: false },
      title: { text: null },
      xAxis: { title: null, lineColor: "#333" },
      yAxis: { title: null, min: 0, gridLineDashStyle: 'Dot' },
      plotOptions: { area: { step: 'left', marker: { enabled: false } } },
      legend: { enabled: false },
      series: seriesData
    });
  }, [steps]);

  return <div ref={chartRef} style={{ width: '100%', maxWidth: '680px', margin: '0 auto' }} />;
}