import { Button, message, Space, Typography } from 'antd';
import { find } from 'lodash';
import React, { FunctionComponent } from 'react';
import { escape } from 'sqlstring';
import { makeSqlPayload, postgresQuote } from '../shared';
import { useT } from '../shared-react';
import { TOAST_DURATION } from '../shared/constants';
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

const extractMapping: Record<string, string> = {
  year: 'year',
  minute: 'minute',
  hour: 'hour',
  dayOfWeek: 'dow',
  dayOfMonth: 'day',
  dayOfYear: 'doy',
  weekOfYear: 'week',
  monthOfYear: 'month',
  quarterOfYear: 'quarter',
};

function bucketToSQL(column: BucketColumn) {
  const columnName = postgresQuote(column.name);
  const { generalization } = column;

  switch (column.type) {
    case 'integer':
    case 'real':
      return generalization.active && generalization.binSize !== null
        ? makeBinSQL(columnName, generalization.binSize)
        : columnName;
    case 'text':
      return generalization.active && generalization.substringLength !== null
        ? makeSubstringSQL(columnName, generalization.substringStart ?? 1, generalization.substringLength)
        : columnName;
    case 'timestamp':
      if (generalization.active && generalization.timestampBinning.startsWith('extract:')) {
        const field = extractMapping[generalization.timestampBinning.substring('extract:'.length)];
        return `extract(${field} from ${columnName}) AS ${postgresQuote(column.name + '_' + field)}`;
      }

      if (generalization.active && generalization.timestampBinning.startsWith('date_trunc:')) {
        const field = generalization.timestampBinning.substring('date_trunc:'.length);
        return `date_trunc('${field}', ${columnName}) AS ${columnName}`;
      }

      return columnName;
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
        return `count(*)`; // GUI should not allow this; fall back to count(*) just in case.
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

function makeNotebookPath(databaseId: number, sql: string) {
  const sqlPayload = makeSqlPayload(databaseId, sql);
  return `/question/notebook#${window.base64Encode(JSON.stringify(sqlPayload))}`;
}

export type QueryPreviewProps = {
  query: Query;
  onOpenMetabaseTab: (initialPath?: string) => void;
};

export const QueryPreview: FunctionComponent<QueryPreviewProps> = ({ query, onOpenMetabaseTab }) => {
  const t = useT('QueryTab::QueryPreview');
  const tables = useTableListCached();
  const table: ImportedTable | null = (query.table && find(tables, { name: query.table })) || null;
  const querySQL = queryToSQL(query, table);

  return (
    <div className="QueryPreview">
      <Typography.Title level={4}>{t('Query Preview')}</Typography.Title>
      <div className="QueryPreview-output">
        <pre className="QueryPreview-output-content">{querySQL}</pre>
      </div>
      <Space>
        <Button type="primary" disabled={!querySQL} onClick={() => window.copyToClipboard(querySQL)}>
          {t('Copy to Clipboard')}
        </Button>
        <Button
          type="primary"
          disabled={!querySQL}
          onClick={async () => {
            try {
              const anonDbId = await window.getAnonymizedAccessDbId();
              onOpenMetabaseTab(makeNotebookPath(anonDbId, querySQL));
            } catch (e) {
              console.error(e);
              message.error({
                content: t('Failed to open Metabase.'),
                duration: TOAST_DURATION,
              });
            }
          }}
        >
          {t('Open in Metabase')}
        </Button>
      </Space>
    </div>
  );
};
