import { useCallback, useEffect, useState } from 'react';
import { inProgressState, useImporter } from '../shared';
import { ComputedData, ImportedTable } from '../types';

export function useTableList(): [ComputedData<ImportedTable[]>, () => void] {
  const importer = useImporter();
  const [result, setResult] = useState<ComputedData<ImportedTable[]>>(inProgressState);
  const invalidateTableList = useCallback(() => setResult(inProgressState), []);
  const inProgress = result.state === 'in_progress';

  useEffect(() => {
    if (!inProgress) return;

    importer
      .loadTables()
      .result.then((queryResult) => setResult({ state: 'completed', value: queryResult }))
      .catch((error) => setResult({ state: 'failed', error: error.toString() }));
  }, [importer, inProgress]);

  return [result, invalidateTableList];
}
