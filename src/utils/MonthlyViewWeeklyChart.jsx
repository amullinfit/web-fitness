//
// MONTHLYVIEWWEEKLYCHART.JSX
//
import React, { useState, useMemo } from 'react';
import { 
  metersToMilesNum, 
  getLocalDateString, 
  getSportCategory 
} from './MonthlyViewHelpers';

/**
 * Determine daily color based on intensity zone breakdown.
 * Red: Z5+ | Blue: Z4 | Yellow: Z3 | Grey: Z1/Z2 (Default)
 * Border: Dark Black if total miles > 8.0
 */
export const getDayZoneStyle = (workoutsList) => {
  if (!workoutsList || workoutsList.length === 0) {
    return { color: '#E5E7EB', borderColor: 'transparent', miles: 0, zoneLabel: 'Rest / None' };
  }

  let totalMeters = 0;
  let z5Time = 0;
  let z4Time = 0;
  let z3Time = 0;

  workoutsList.forEach((w) => {
    totalMeters += w.distance || w.icu_distance || 0;

    if (w.icu_zone_times && Array.isArray(w.icu_zone_times)) {
      z3Time += w.icu_zone_times[2] || 0;
      z4Time += w.icu_zone_times[3] || 0;
      z5Time += (w.icu_zone_times[4] || 0) + (w.icu_zone_times[5] || 0);
    } else if (w.workout_doc?.steps) {
      w.workout_doc.steps.forEach((step) => {
        const intensity = step.intensity || step.pace?.start || 0;
        const duration = step.duration || 0;
        if (intensity >= 105) z5Time += duration;
        else if (intensity >= 95) z4Time += duration;
        else if (intensity >= 85) z3Time += duration;
      });
    }
  });

  const miles = metersToMilesNum(totalMeters);

  let color = '#9CA3AF'; // Grey (Easy / Z1-Z2)
  let zoneLabel = 'Z1 / Z2 (Easy)';

  if (z5Time > 60) {
    color = '#EF4444'; // Red (Z5+)
    zoneLabel = 'Z5+ (Sprint / Max)';
  } else if (z4Time > 120) {
    color = '#3B82F6'; // Blue (Z4)
    zoneLabel = 'Z4 (Threshold)';
  } else if (z3Time > 180) {
    color = '#EAB308'; // Yellow (Z3)
    zoneLabel = 'Z3 (Tempo)';
  }

  // Dark black border if > 8 miles
  const borderColor = miles > 8.0 ? '#000000' : 'transparent';

  return { color, borderColor, miles, zoneLabel };
};

/**
 * SVG Bar Chart with Enclosing Weekly Frame, Hover Tooltips, and Click Interactivity
 */
export const WeeklyFrameChart = ({ weekDates, workoutsByDate, sportType, onDayClick }) => {
  const [hoveredDayIndex, setHoveredDayIndex] = useState(null);

  const todayStr = getLocalDateString(new Date());

  const daysData = useMemo(() => {
    return weekDates.map((dateObj, idx) => {
      const dateStr = getLocalDateString(dateObj);
      const isToday = dateStr === todayStr;
      const allWorkouts = workoutsByDate[dateStr] || [];
      const sportWorkouts = allWorkouts.filter((w) => getSportCategory(w) === sportType);

      const style = getDayZoneStyle(sportWorkouts);
      const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'narrow' });
      const fullDateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      return {
        dayIndex: idx,
        dateObj,
        dateStr,
        isToday,
        dayName,
        fullDateStr,
        miles: style.miles,
        color: style.color,
        borderColor: style.borderColor,
        zoneLabel: style.zoneLabel,
        sportWorkouts
      };
    });
  }, [weekDates, workoutsByDate, sportType, todayStr]);

  const totalWeeklyMiles = useMemo(() => {
    return daysData.reduce((sum, d) => sum + d.miles, 0).toFixed(1);
  }, [daysData]);

  const maxMiles = useMemo(() => {
    const max = Math.max(...daysData.map((d) => d.miles), 1);
    return Math.ceil(max);
  }, [daysData]);

  const chartHeight = 70;
  const barWidth = 14;
  const gap = 18;
  const startX = 16;
  const totalWidth = startX + 7 * (barWidth + gap);

  return (
    <div className="monthly-chart-frame-box">
      <div className="monthly-chart-frame-header">
        <span className={`monthly-chart-sport-badge badge-${sportType.toLowerCase()}`}>
          {sportType}
        </span>
        <span className="monthly-chart-weekly-total">{totalWeeklyMiles} mi total</span>
      </div>

      <div className="monthly-chart-svg-wrapper">
        <svg viewBox={`0 0 ${totalWidth} ${chartHeight + 30}`} className="monthly-chart-svg">
          {/* Enclosing Outer Frame (Weekly Border) */}
          <rect
            x={startX - 6}
            y={2}
            width={7 * (barWidth + gap) - gap + 12}
            height={chartHeight + 4}
            rx={6}
            className="monthly-weekly-enclosing-frame"
          />

          {/* Daily Bars */}
          {daysData.map((d, i) => {
            const barH = d.miles > 0 ? Math.max((d.miles / maxMiles) * chartHeight, 4) : 0;
            const x = startX + i * (barWidth + gap);
            const y = chartHeight - barH + 2;
            const isHovered = hoveredDayIndex === i;
            const hasWorkouts = d.sportWorkouts.length > 0;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredDayIndex(i)}
                onMouseLeave={() => setHoveredDayIndex(null)}
                onClick={() => {
                  if (hasWorkouts && onDayClick) {
                    onDayClick(d.sportWorkouts, d.dateStr, sportType);
                  }
                }}
                className={`monthly-chart-bar-group ${hasWorkouts ? 'monthly-clickable-bar' : ''}`}
                style={{ cursor: hasWorkouts ? 'pointer' : 'default' }}
              >
                {/* Hit target background line */}
                <rect
                  x={x - 2}
                  y={2}
                  width={barWidth + 4}
                  height={chartHeight + 25}
                  fill="transparent"
                />

                {barH > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={2}
                    fill={d.color}
                    stroke={d.borderColor}
                    strokeWidth={d.borderColor !== 'transparent' ? 2 : 0}
                    className={`monthly-chart-bar ${isHovered ? 'bar-hovered' : ''}`}
                  />
                )}

                {/* Day Letter Label with optional Today highlight box */}
                {/*                    fill={d.isToday ? '#ffffff' : undefined} */}
                <g className={d.isToday ? 'weekly-today' : ''}>
                  {d.isToday && (
                    <rect
                      x={x + barWidth / 2 - 9}
                      y={chartHeight + 8}
                      width={18}
                      height={18}
                      rx={4}
                      ry={4}
                    />
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 21}
                    textAnchor="middle"

                    className={`monthly-chart-day-text ${isHovered ? 'text-hovered' : ''} ${d.isToday ? 'is-today-text' : ''}`}
                  >
                    {d.dayName}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredDayIndex !== null && (
          <div
            className="monthly-chart-tooltip"
            style={{
              left: `${((hoveredDayIndex + 0.5) / 7) * 100}%`
            }}
          >
            <div className="tooltip-date">{daysData[hoveredDayIndex].fullDateStr}</div>
            <div className="tooltip-miles">
              <strong>{daysData[hoveredDayIndex].miles.toFixed(1)}</strong> mi
            </div>
            {daysData[hoveredDayIndex].miles > 0 ? (
              <>
                <div className="tooltip-zone">{daysData[hoveredDayIndex].zoneLabel}</div>
                {daysData[hoveredDayIndex].miles > 8.0 && (
                  <div className="tooltip-long-run">★ Long Run (&gt;8 mi)</div>
                )}
                <div className="tooltip-click-hint" style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>
                  Click to view workout details
                </div>
              </>
            ) : (
              <div className="tooltip-zone tooltip-rest">No activity</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};