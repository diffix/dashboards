import { useEffect, useState } from 'react';
import { inProgressState, useImporter } from '../shared';
import { ComputedData, ImportedTable } from '../types';

export function useQuery(
  tableListLoaded: boolean,
  setTableListLoaded: (v: boolean) => void,
): ComputedData<ImportedTable[]> {
  const importer = useImporter();
  const [result, setResult] = useState<ComputedData<ImportedTable[]>>(inProgressState);

  useEffect(() => {
    if (tableListLoaded) return;
    setResult(inProgressState);

    let canceled = false;

    const task = importer.loadTables();

    task.result
      .then((queryResult) => {
        if (!canceled) {
          setResult({ state: 'completed', value: queryResult });
          setTableListLoaded(true);
        }
      })
      .catch((error) => {
        if (!canceled) {
          setResult({ state: 'failed', error: error.toString() });
        }
      });

    return () => {
      canceled = true;
      task.cancel();
    };
  }, [importer, tableListLoaded, setTableListLoaded]);

  return result;
}
