import React, { useState, useEffect } from 'react';
import { formatMMSS, parseMMSS } from '../utils/WorkoutBuilderHelpers.js';

export default function MMSSInput({ valueSec, onChange }) {
  const [text, setText] = useState(formatMMSS(valueSec));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setText(formatMMSS(valueSec));
  }, [valueSec, isFocused]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    const parsedSec = parseMMSS(val);
    if (parsedSec >= 0) onChange(parsedSec);
  };

  return (
    <input
      type="text"
      value={text}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        const parsedSec = parseMMSS(text);
        setText(formatMMSS(parsedSec));
        onChange(parsedSec);
      }}
      className="time-pace-input"
    />
  );
}