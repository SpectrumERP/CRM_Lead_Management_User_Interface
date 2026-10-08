import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '../../api/errors';
import type { LocationMasterApi, LocationMasterRow } from '../../api/locationMasters';

/**
 * Loads one State / City / Port master for a company. City lists can be long, so nothing loads
 * until `enabled` (the tab is opened); after that it stays loaded.
 */
export function useLocationMaster(api: LocationMasterApi, companyNo: number | null, enabled: boolean) {
  const [rows, setRows] = useState<LocationMasterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [wanted, setWanted] = useState(enabled);
  const requestId = useRef(0);

  useEffect(() => {
    if (enabled) setWanted(true);
  }, [enabled]);

  const reload = useCallback(async () => {
    if (!companyNo) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await api.search(companyNo);
      if (id !== requestId.current) return;
      setRows(next);
      setLoaded(true);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(toApiError(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [api, companyNo]);

  useEffect(() => {
    setRows([]);
    setLoaded(false);
    setError(null);
    if (wanted) void reload();
  }, [reload, wanted]);

  return { rows, loading, loaded, error, reload, companyNo };
}

export type LocationMasterState = ReturnType<typeof useLocationMaster>;
