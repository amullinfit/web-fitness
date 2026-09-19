import React, { createContext, useContext, useState, useEffect } from 'react';

const PacesContext = createContext({
  pacesData: null,
  loading: true,
  error: null,
});

export function PacesProvider({ children }) {
  const [pacesData, setPacesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const VAL_MY_PACES_URL = '/api/val-my-paces';

  useEffect(() => {
    async function fetchPaces() {
      try {
        setLoading(true);
        const response = await fetch(VAL_MY_PACES_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPacesData(data);
      } catch (err) {
        setError(err.message || 'Error fetching paces data');
      } finally {
        setLoading(false);
      }
    }

    fetchPaces();
  }, []);

  return (
    <PacesContext.Provider value={{ pacesData, loading, error }}>
      {children}
    </PacesContext.Provider>
  );
}

// Custom Hook to consume the context easily in any component
export function usePaces() {
  return useContext(PacesContext);
}