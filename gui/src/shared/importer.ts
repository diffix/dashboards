import { ColumnType, File, ImportedTable, Importer, TableColumn, TableSchema, Task } from '../types';
import { runTask } from './utils';

class DiffixImporter implements Importer {
  private static booleanRE = /^(?:true|false|0|1)$/i;
  private static integerRE = /^-?\d{1,20}$/;
  private static realRE = /^-?\d{1,20}(?:\.\d{1,20})?$/;
  // Source: https://stackoverflow.com/a/3143231, extended with a subset of PostgreSQL-admissible formats.
  // This is widely advised against, but there doesn't seem to be any viable approximation of the PostgreSQL
  // format in the packages I've explored.
  private static timestampRE =
    /(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )?([+-][0-2]\d:[0-5]\d|Z)?)/;

  private detectColumnTypes(columnsCount: number, rows: string[][]): ColumnType[] {
    const typesInfo = Array(columnsCount)
      .fill(null)
      .map(() => ({ isEmpty: true, isBoolean: true, isInteger: true, isReal: true, isTimestamp: true }));

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
          typeInfo.isTimestamp &&= DiffixImporter.timestampRE.test(value);
        }
      }
    }

    return typesInfo.map((info) => {
      if (info.isEmpty) return 'text';
      if (info.isBoolean) return 'boolean';
      if (info.isInteger) return 'integer';
      if (info.isReal) return 'real';
      if (info.isTimestamp) return 'timestamp';
      return 'text';
    });
  }

  loadTables(): Task<ImportedTable[]> {
    return runTask(async (signal) => {
      return window.loadTables(signal);
    });
  }

  removeTable(tableName: string): Task<void> {
    return runTask(async (signal) => {
      return window.removeTable(tableName, signal);
    });
  }

  loadSchema(file: File): Task<TableSchema> {
    return runTask(async (signal) => {
      const result = await window.readCSV(file.path, signal);

      const types = this.detectColumnTypes(result.headers.length, result.rows);
      const columns = types.map((type, index) => {
        return { name: result.headers[index], type };
      });

      return { file, columns, rowsPreview: result.rows };
    });
  }

  importCSV(file: File, tableName: string, columns: TableColumn[], aidColumns: string[]): Task<void> {
    return runTask(async (signal) => {
      await window.importCSV(file.path, tableName, columns, aidColumns, signal);
    });
  }
}

export const importer = new DiffixImporter();
