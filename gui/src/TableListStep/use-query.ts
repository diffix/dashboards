import { useCallback, useEffect, useState } from 'react';
import { inProgressState, useImporter } from '../shared';
import { ComputedData, ImportedTable } from '../types';

export function useQuery(): [ComputedData<ImportedTable[]>, () => void] {
  const importer = useImporter();
  const [result, setResult] = useState<ComputedData<ImportedTable[]>>(inProgressState);
  const invalidateTableList = useCallback(() => setResult(inProgressState), []);
  const notInProgress = result.state !== 'in_progress';

  useEffect(() => {
    if (notInProgress) return;
    let canceled = false;

    const task = importer.loadTables();

    task.result
      .then((queryResult) => {
        if (!canceled) {
          setResult({ state: 'completed', value: queryResult });
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
  }, [importer, notInProgress]);

  return [result, invalidateTableList];
}
