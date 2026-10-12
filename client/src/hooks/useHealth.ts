import { useEffect, useState } from 'react';
import { getHealth } from '../api/health';

type HealthState = 'loading' | 'online' | 'offline';

export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>('loading');

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => setState('online'))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') setState('offline');
      });
    return () => controller.abort();
  }, []);

  return state;
}
