import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '../../api/errors';
import type { MasterApi, MasterRow } from '../../api/masters';

/** Loads one Spectrum master list for a company; `companyNo` null means "not using the API". */
export function useApiMaster(api: MasterApi, companyNo: number | null) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!companyNo) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await api.search(companyNo);
      if (id !== requestId.current) return;
      setRows(next);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(toApiError(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [api, companyNo]);

  useEffect(() => {
    setRows([]);
    setError(null);
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}

export type ApiMasterState = ReturnType<typeof useApiMaster>;
