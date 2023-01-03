import { Button, Space, Typography } from 'antd';
import { find } from 'lodash';
import React, { FunctionComponent } from 'react';
import { escape } from 'sqlstring';
import { postgresQuote } from '../shared';
import { useT } from '../shared-react';
import { useTableListCached } from '../state';
import { ImportedTable } from '../types';
import { Aggregate, BucketColumn, Filter, Query } from './types';

import './QueryPreview.css';

function makeBinSQL(columnName: string, binSize: number) {
  return `diffix.floor_by(${columnName}, ${binSize}) AS ${columnName}`;
}

function makeSubstringSQL(columnName: string, substringStart: number, substringLength: number) {
  return `substring(${columnName}, ${substringStart}, ${substringLength}) AS ${columnName}`;
}

function bucketToSQL(column: BucketColumn) {
  const columnName = postgresQuote(column.name);

  switch (column.type) {
    case 'integer':
    case 'real':
      return column.generalization.active && column.generalization.binSize !== null
        ? makeBinSQL(columnName, column.generalization.binSize)
        : columnName;
    case 'text':
      return column.generalization.active && column.generalization.substringLength !== null
        ? makeSubstringSQL(columnName, column.generalization.substringStart ?? 1, column.generalization.substringLength)
        : columnName;
    default:
      return columnName;
  }
}

function aggregateToSQL(agg: Aggregate, table: ImportedTable) {
  switch (agg.type) {
    case 'count-rows':
      return `count(*)`;
    case 'count-column':
      return `count(${postgresQuote(agg.column)}) AS ${postgresQuote('count_' + agg.column)}`;
    case 'count-distinct-column':
      return `count(DISTINCT ${postgresQuote(agg.column)}) AS ${postgresQuote('distinct_' + agg.column)}`;
    case 'count-entities':
      if (table.aidColumns.length > 0) {
        return `count(DISTINCT ${postgresQuote(table.aidColumns[0])}) AS ${postgresQuote('num_entities')}`;
      } else {
        return `count(*)`; // GUI should not allow this; fall back to count*) just in case.
      }
    case 'sum':
      return `sum(${postgresQuote(agg.column)}) AS ${postgresQuote('sum_' + agg.column)}`;
    case 'avg':
      return `avg(${postgresQuote(agg.column)}) AS ${postgresQuote('avg_' + agg.column)}`;
    default:
      throw new Error('Unknown aggregate.');
  }
}

function filterToSQL(filter: Filter) {
  return `${postgresQuote(filter.column)} = ${escape(filter.value)}`;
}

function queryToSQL(query: Query, table: ImportedTable | null) {
  if (!query.table || !table) {
    return '';
  }

  const sql: string[] = [];
  const INDENT = '  ';

  // SELECT
  sql.push('SELECT');
  const select: string[] = [];

  for (const bucket of query.columns) {
    select.push(bucketToSQL(bucket));
  }

  for (const agg of query.aggregates) {
    select.push(aggregateToSQL(agg, table));
  }

  select.forEach((clause, i) => {
    sql.push(`${INDENT}${clause}${i < select.length - 1 ? ',' : ''}`);
  });

  // FROM
  sql.push(`FROM ${postgresQuote(query.table)}`);

  // WHERE
  query.filters.forEach((filter, i) => {
    if (i === 0) {
      sql.push(`WHERE ${filterToSQL(filter)}`);
    } else {
      sql.push(`  AND ${filterToSQL(filter)}`);
    }
  });

  // GROUP BY
  if (query.columns.length > 0) {
    sql.push(`GROUP BY ${query.columns.map((_, i) => i + 1).join(', ')}`);
  }

  return sql.join('\n');
}

export type QueryPreviewProps = {
  query: Query;
};

export const QueryPreview: FunctionComponent<QueryPreviewProps> = ({ query }) => {
  const t = useT('QueryPreview');
  const tables = useTableListCached();
  const table: ImportedTable | null = (query.table && find(tables, { name: query.table })) || null;

  return (
    <div className="QueryPreview">
      <Typography.Title level={4}>{t('Query Preview')}</Typography.Title>
      <pre className="QueryPreview-output">{queryToSQL(query, table)}</pre>
      <Space>
        {/* TODO: Handle actions. */}
        <Button type="primary">Copy to Clipboard</Button>
        <Button type="primary">Open in Metabase</Button>
      </Space>
    </div>
  );
};
