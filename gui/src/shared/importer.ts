import { createContext, useContext } from 'react';
import { ColumnType, File, Importer, LoadResponse, TableSchema, Task } from '../types';
import { runTask } from './utils';

class DiffixImporter implements Importer {
  private static booleanRE = /^(?:true|false|0|1)$/i;
  private static integerRE = /^-?\d{1,20}$/;
  private static realRE = /^-?\d{1,20}(?:\.\d{1,20})?$/;

  private detectColumnTypes(columnsCount: number, rows: string[][]): ColumnType[] {
    const typesInfo = Array(columnsCount)
      .fill(null)
      .map(() => ({ isEmpty: true, isBoolean: true, isInteger: true, isReal: true }));

    for (const row of rows) {
      for (let index = 0; index < row.length; index++) {
        const value = row[index];
        if (value) {
          // Not null and not empty.
          const typeInfo = typesInfo[index];
          typeInfo.isEmpty = false;
          typeInfo.isBoolean &&= DiffixImporter.booleanRE.test(value);
          typeInfo.isInteger &&= DiffixImporter.integerRE.test(value);
          typeInfo.isReal &&= DiffixImporter.realRE.test(value);
        }
      }
    }

    return typesInfo.map((info) => {
      if (info.isEmpty) return 'text';
      if (info.isBoolean) return 'boolean';
      if (info.isInteger) return 'integer';
      if (info.isReal) return 'real';
      return 'text';
    });
  }

  loadSchema(file: File): Task<TableSchema> {
    return runTask(async (signal) => {
      const request = { type: 'Load', inputPath: file.path, rows: 10000 };
      const result = (await window.callService(request, signal)) as LoadResponse;

      // Drop row index column from schema.
      const columns = result.columns.slice(1);
      const rowsPreview = result.rows.map((row) => row.slice(1)).slice(0, 1000);

      const types = this.detectColumnTypes(columns.length, rowsPreview as string[][]);
      for (let index = 0; index < columns.length; index++) columns[index].type = types[index];

      return { file, columns, rowsPreview };
    });
  }
}

export const importer = new DiffixImporter();

export const ImporterContext = createContext<Importer>(importer);

export function useImporter(): Importer {
  return useContext(ImporterContext);
}
