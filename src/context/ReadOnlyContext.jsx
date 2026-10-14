import { createContext, useContext, useEffect, useState } from 'react';

// Fail closed: editing is enabled only after the server verifies the owner.
const ReadOnlyContext = createContext(true);

export function ReadOnlyProvider({ children }) {
  const [ownerAuthorized, setOwnerAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [urlReadOnly] = useState(() =>
    typeof window === 'undefined' ||
    new URLSearchParams(window.location.search).get('readonly') === 'true'
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Authentication status unavailable');
        return response.json();
      })
      .then((session) => setOwnerAuthorized(session?.authorized === true))
      .catch(() => setOwnerAuthorized(false))
      .finally(() => setAuthChecked(true));
    return () => controller.abort();
  }, []);

  const readOnly = urlReadOnly || !authChecked || !ownerAuthorized;

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
