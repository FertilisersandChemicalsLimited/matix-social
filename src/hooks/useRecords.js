import { useCallback, useEffect, useState } from 'react';
import { listRecords, updateRecord, createRecord, deleteRecord } from '../services/airtable.js';

export function useRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRecords();
      setRecords(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const patch = useCallback(async (id, fields) => {
    const updated = await updateRecord(id, fields);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const create = useCallback(async (fields) => {
    const created = await createRecord(fields);
    setRecords((prev) => [created, ...prev]);
    return created;
  }, []);

  const remove = useCallback(async (id) => {
    await deleteRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { records, loading, error, refresh, patch, create, remove };
}
