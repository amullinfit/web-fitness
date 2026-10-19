import React, { useEffect, useMemo, useState } from 'react';
import WorkoutChart from '../components/WorkoutChart.jsx';
import { fetchWorkoutsApi } from '../utils/WorkoutBuilderHelpers.js';
import '../CSS/CalendarWorkoutActions.css';

const CALENDAR_API_URL = import.meta.env.VITE_API_WORKOUTS_URL || 'https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run';
const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const firstOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const previewWorkoutName = (name) => String(name || 'Workout').replace(/^IntervalCoach\s*-?\s*/i, '').trim() || 'Workout';
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarWorkoutActions({ open, action, date, workout, onClose, onConfirm, busy = false, initialTargetDate = '' }) {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [targetDate, setTargetDate] = useState('');
  const [folders, setFolders] = useState([]);
  const [library, setLibrary] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [workoutId, setWorkoutId] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const today = dateKey(new Date());

  useEffect(() => {
    if (!open) return;
    setTargetDate(action === 'add' ? (date || today) : (initialTargetDate || ''));
    setMonth(firstOfMonth(new Date((date || today) + 'T12:00:00')));
    setError('');
    const onKey = (event) => { if (event.key === 'Escape' && !busy) { event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, action, date, busy, onClose, today, initialTargetDate]);

  useEffect(() => {
    if (!open || action !== 'add') return;
    let active = true;
    setLoading(true);
    fetchWorkoutsApi().then((data) => {
      if (!active) return;
      setFolders(data.folders || []);
      setLibrary(data.workouts || []);
      const defaultFolder = (data.folders || []).find((folder) => String(folder.name || '').trim().toLowerCase() === 'workouts');
      setFolderId(String(defaultFolder?.id ?? data.folders?.[0]?.id ?? ''));
      setWorkoutId('');
    }).catch((e) => { if (active) setError(e.message || 'Unable to load workout library.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, action]);

  useEffect(() => {
    if (!open || action !== 'move') return;
    const controller = new AbortController();
    // Fetch the entire six-week grid, including adjacent-month days.
    const first = firstOfMonth(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
    const end = new Date(month.getFullYear(), month.getMonth(), 42 - offset);
    const url = new URL(CALENDAR_API_URL);
    url.searchParams.set('action', 'calendar_range');
    url.searchParams.set('oldest', dateKey(start));
    url.searchParams.set('newest', dateKey(end));
    setLoading(true);
    setError('');
    fetch(url, { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.events)) throw new Error(data.error || 'Calendar unavailable.');
      return data.events;
    }).then((data) => setEvents(data))
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, action, month]);

  const visibleWorkouts = useMemo(() => library.filter((item) => String(item.folderId ?? item.folder_id ?? '') === folderId), [library, folderId]);
  const dates = useMemo(() => {
    const first = firstOfMonth(month);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1 - offset));
  }, [month]);
  if (!open) return null;

  const validDate = targetDate >= today && (action !== 'move' || targetDate !== date);
  const selectedWorkout = library.find((item) => String(item.id ?? item._id) === workoutId);
  const canSubmit = action === 'remove' ? Boolean(workout) : action === 'add' ? Boolean(selectedWorkout && validDate) : Boolean(workout && validDate);
  const confirm = () => { if (canSubmit && !busy && !loading && !error) onConfirm({ action, date: action === 'remove' ? date : targetDate, originalDate: date, workout: action === 'add' ? selectedWorkout : workout }); };

  return <div className="cwa-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="cwa-dialog" role="dialog" aria-modal="true" aria-label={action + ' workout'}>
      <header className="cwa-header"><h3>{action === 'add' ? 'Add Workout' : action === 'move' ? 'Move Workout' : 'Remove Workout'}</h3><button type="button" onClick={onClose} disabled={busy} aria-label="Close">×</button></header>
      {action === 'add' && <>
        <label>Workout folder <select value={folderId} onChange={(e) => { setFolderId(e.target.value); setWorkoutId(''); }}>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Workout <select value={workoutId} onChange={(e) => setWorkoutId(e.target.value)}><option value="">Select a workout…</option>{visibleWorkouts.map((w) => <option key={w.id ?? w._id} value={w.id ?? w._id}>{w.name}</option>)}</select></label>
        <label>Schedule for <input type="date" min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
      </>}
      {action === 'move' && <>
        <p>Move <strong>{previewWorkoutName(workout?.name || 'this workout')}</strong> to a new date. Existing workouts are shown below; they will not be replaced.</p>
        <div className="cwa-month"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
        <div className="cwa-calendar">{weekdays.map((day) => <strong key={day}>{day}</strong>)}{dates.map((day) => { const key = dateKey(day); const existing = events.filter((event) => String(event.start_date_local || event.start_date || '').slice(0, 10) === key && (event.category === 'WORKOUT' || event.workout_doc)); return <button key={key} type="button" disabled={key < today || key === date || loading} className={targetDate === key ? 'selected' : ''} onClick={() => setTargetDate(key)}><span>{day.getDate()}</span>{existing.map((event, index) => <span className="cwa-mini-workout" key={event.id || index} title={previewWorkoutName(event.name)}><span className="cwa-workout-name">{previewWorkoutName(event.name)}</span>{event.workout_doc?.steps?.length > 0 && <WorkoutChart workout={event} chartHeight="17px" showWorkoutName={false} showThresholdPace={false} showYAxis={false} showYAxisLabels={false} showLegend={false} minimalXAxis={true} showHoverDetails={false} />}</span>)}</button>; })}</div>
        {targetDate && <p>New date: <strong>{targetDate}</strong>{events.some((event) => String(event.start_date_local || event.start_date || '').slice(0, 10) === targetDate && (event.category === 'WORKOUT' || event.workout_doc)) ? ' — existing workout(s) on this date' : ''}</p>}
      </>}
      {action === 'remove' && <p>Remove <strong>{workout?.name || 'this workout'}</strong> from {date}? The workout library template will not be deleted.</p>}
      {loading && <p>Loading…</p>}{error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" onClick={confirm} disabled={!canSubmit || busy || loading || Boolean(error)}>{busy ? 'Saving…' : action === 'remove' ? 'Remove Workout' : action === 'move' ? 'Move Workout' : 'Add Workout'}</button></footer>
    </section>
  </div>;
}
