// ✅ FIXED (PacesContext.jsx)
import React, { createContext, useContext, useState, useEffect } from 'react';

const VAL_MY_PACES_URL = '/api/val-my-paces';

const PacesContext = createContext(null);

export function PacesProvider({ children }) {
  const [paces, setPaces] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from your endpoint
    fetch(VAL_MY_PACES_URL)
      .then((res) => res.json())
      .then((data) => {
        setPaces(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load pace data:", err);
        setLoading(false);
      });
  }, []);

  return (
    <PacesContext.Provider value={{ paces, setPaces, loading }}>
      {children}
    </PacesContext.Provider>
  );
}

export const usePaces = () => useContext(PacesContext);