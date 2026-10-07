import { createContext, useContext, useMemo } from 'react';

const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ children }) {
  const readOnly = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('readonly') === 'true';
  }, []);

  return (
    <ReadOnlyContext.Provider value={readOnly}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}

export default ReadOnlyContext;
