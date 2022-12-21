import { find } from 'lodash';
import React, { FunctionComponent, useMemo } from 'react';
import { useTableListCached } from '../../state';
import { ImportedTable } from '../../types';
import { AggregateSelector } from './AggregateSelector';
import { ColumnSelector } from './ColumnSelector';
import { FilterSelector } from './FilterSelector';
import { TableSelector } from './TableSelector';
import { CommonProps } from './utils';

import './styles.css';

function findTable(name: string | null, tables: ImportedTable[]): ImportedTable | null {
  return (name && find(tables, { name })) || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_ARRAY: any[] = [];

export type QueryBuilderProps = CommonProps;

export const QueryBuilder: FunctionComponent<QueryBuilderProps> = ({ query, updateQuery }) => {
  const tables = useTableListCached();
  const table = findTable(query.table, tables);

  const aidColumns = table?.aidColumns ?? EMPTY_ARRAY;
  const tableColumns = table?.columns ?? EMPTY_ARRAY;
  const queryableColumns = useMemo(
    () => tableColumns.filter((c) => !aidColumns.includes(c.name)),
    [tableColumns, aidColumns],
  );

  return (
    <div className="QueryBuilder">
      <TableSelector tables={tables} query={query} updateQuery={updateQuery} />
      <ColumnSelector queryableColumns={queryableColumns} query={query} updateQuery={updateQuery} />
      <AggregateSelector
        queryableColumns={queryableColumns}
        aidColumns={aidColumns}
        query={query}
        updateQuery={updateQuery}
      />
      <FilterSelector queryableColumns={queryableColumns} query={query} updateQuery={updateQuery} />
    </div>
  );
};
