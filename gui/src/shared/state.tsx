import React, { createContext, FunctionComponent, useContext, useEffect, useState } from 'react';
import { ImportedTable, Importer } from '../types';
import { useStaticValue } from './hooks';
import { importer } from './importer';

export type InvalidateTableList = () => void;

export const ImporterContext = createContext<Importer>(importer);

export const TableListContext = createContext<ImportedTable[]>([]);

export const InvalidateTableListContext = createContext<InvalidateTableList>(() => {});

export const TableListProvider: FunctionComponent = ({ children }) => {
  const importer = useImporter();
  const [tableList, setTableList] = useState<ImportedTable[]>([]);
  const [invalidatorToken, setInvalidatorToken] = useState(0);

  useEffect(() => {
    let canceled = false;
    const task = importer.loadTables();
    task.result
      .then((tableList) => {
        if (!canceled) {
          setTableList(tableList);
        }
      })
      .catch((err) => console.error(err));
    return () => {
      canceled = true;
      task.cancel();
    };
  }, [importer, invalidatorToken]);

  const invalidateTableList = useStaticValue(() => () => {
    setInvalidatorToken((x) => x + 1);
  });

  return (
    <TableListContext.Provider value={tableList}>
      <InvalidateTableListContext.Provider value={invalidateTableList}>{children}</InvalidateTableListContext.Provider>
    </TableListContext.Provider>
  );
};

export function useImporter(): Importer {
  return useContext(ImporterContext);
}

export function useTableList(): ImportedTable[] {
  return useContext(TableListContext);
}

export function useInvalidateTableList(): InvalidateTableList {
  return useContext(InvalidateTableListContext);
}
