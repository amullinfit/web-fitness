//
// MONTHLYVIEWHELPERS.JSX
//
import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handleChange = (e) => setIsMobile(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobile;
}

export const safeStringLower = (val) => {
  if (!val) return "";
  if (typeof val === 'string') return val.toLowerCase();
  return String(val.id || val.type || val.name || val).toLowerCase();
};

export const getSportCategory = (workout) => {
  const type = safeStringLower(workout.type || workout.sport || '');
  if (type.includes('swim')) return 'Swim';
  if (type.includes('ride') || type.includes('bike') || type.includes('cycling')) return 'Bike';
  if (type.includes('run')) return 'Run';
  return 'Other';
};

export const getThresholdPaceForSport = (workout, sportSettings, contextPaces) => {
  return contextPaces?.threshold_pace || null;
};

export const getLocalDateString = (dateInput) => {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) return dateInput.split('T')[0];
    if (dateInput.length >= 10) return dateInput.slice(0, 10);
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const isWorkoutCompleted = (workout) => {
  if (workout.feedSource === 'HISTORICAL') {
    return true;
  }

  const hasPairedEvent = workout.paired_event_id !== null && workout.paired_event_id !== undefined;
  const hasCompliance = workout.compliance !== null && workout.compliance !== undefined;

  return hasPairedEvent || hasCompliance;
};

export const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const getFourWeeksDates = (startMonday) => {
  const dates = [];
  for (let i = 0; i < 28; i++) {
    const date = new Date(startMonday);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};

export const metersToMilesNum = (meters) => {
  if (!meters) return 0;
  return parseFloat((meters * 0.000621371).toFixed(2));
};