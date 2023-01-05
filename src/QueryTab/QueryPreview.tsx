import { Button, Checkbox, message, Typography } from 'antd';
import { find, groupBy } from 'lodash';
import React, { FunctionComponent, useState } from 'react';
import { escape } from 'sqlstring';
import { makeSqlPayload, postgresQuote } from '../shared';
import { useT } from '../shared-react';
import { TOAST_DURATION } from '../shared/constants';
import { useTableListCached } from '../state';
import { ImportedTable } from '../types';
import { Aggregate, BucketColumn, Filter, Query } from './types';

import './QueryPreview.css';

type SelectExpression = { expr: string; alias: string; explicitAlias: boolean };

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

function bucketToSQL(column: BucketColumn): SelectExpression {
  const { generalization } = column;
  const escapedName = postgresQuote(column.name);

  const columnReference = { expr: escapedName, alias: column.name, explicitAlias: false };

  switch (column.type) {
    case 'integer':
    case 'real':
      return generalization.active && generalization.binSize !== null
        ? {
            expr: `diffix.floor_by(${escapedName}, ${generalization.binSize})`,
            alias: column.name,
            explicitAlias: true,
          }
        : columnReference;
    case 'text':
      return generalization.active && generalization.substringLength !== null
        ? {
            expr: `substring(${escapedName}, ${generalization.substringStart ?? 1}, ${generalization.substringLength})`,
            alias: column.name,
            explicitAlias: true,
          }
        : columnReference;
    case 'timestamp':
      if (generalization.active && generalization.timestampBinning.startsWith('extract:')) {
        const field = extractMapping[generalization.timestampBinning.substring('extract:'.length)];
        return {
          expr: `extract(${field} from ${escapedName})`,
          alias: `${column.name}_${field}`,
          explicitAlias: true,
        };
      }

      if (generalization.active && generalization.timestampBinning.startsWith('date_trunc:')) {
        const field = generalization.timestampBinning.substring('date_trunc:'.length);
        return {
          expr: `date_trunc('${field}', ${escapedName})`,
          alias: column.name,
          explicitAlias: true,
        };
      }

      return columnReference;
    default:
      return columnReference;
  }
}

function aggregateToSQL(agg: Aggregate, table: ImportedTable): SelectExpression {
  switch (agg.type) {
    case 'count-rows':
      return { expr: `count(*)`, alias: 'count', explicitAlias: false };
    case 'count-column':
      return { expr: `count(${postgresQuote(agg.column)})`, alias: `count_${agg.column}`, explicitAlias: true };
    case 'count-distinct-column':
      return {
        expr: `count(DISTINCT ${postgresQuote(agg.column)})}`,
        alias: `distinct_${agg.column}`,
        explicitAlias: true,
      };
    case 'count-entities':
      if (table.aidColumns.length > 0) {
        return {
          expr: `count(DISTINCT ${postgresQuote(table.aidColumns[0])}`,
          alias: 'num_entities',
          explicitAlias: true,
        };
      } else {
        // GUI should not allow this; fall back to count(*) just in case.
        return { expr: `count(*)`, alias: 'count', explicitAlias: false };
      }
    case 'sum':
      return { expr: `sum(${postgresQuote(agg.column)})`, alias: `sum_${agg.column}`, explicitAlias: true };
    case 'avg':
      return { expr: `avg(${postgresQuote(agg.column)})`, alias: `avg_${agg.column}`, explicitAlias: true };
    default:
      throw new Error('Unknown aggregate.');
  }
}

function filterToSQL(filter: Filter) {
  return `${postgresQuote(filter.column)} = ${escape(filter.value)}`;
}

function queryToSQL(query: Query, table: ImportedTable | null, wrapInSubquery: boolean) {
  if (!query.table || !table) {
    return '';
  }

  const sql: string[] = [];
  const INDENT = '  ';

  // SELECT
  sql.push('SELECT');

  const select: SelectExpression[] = [];
  for (const bucket of query.columns) {
    select.push(bucketToSQL(bucket));
  }
  for (const agg of query.aggregates) {
    select.push(aggregateToSQL(agg, table));
  }

  // Resolve ambiguous names.
  const selectByAlias = groupBy(select, 'alias');
  Object.values(selectByAlias).forEach((selectExprs) => {
    if (selectExprs.length > 1) {
      selectExprs.forEach((selectExpr, i) => {
        selectExpr.alias += (i + 1).toString();
        selectExpr.explicitAlias = true;
      });
    }
  });

  select.forEach(({ expr, alias, explicitAlias }, i) => {
    const aliasStr = explicitAlias ? ` AS ${postgresQuote(alias)}` : '';
    sql.push(`${INDENT}${expr}${aliasStr}${i < select.length - 1 ? ',' : ''}`);
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

  if (wrapInSubquery) {
    return [
      'SELECT',
      ...select.map(({ alias }, i) => `${INDENT}${postgresQuote(alias)}${i < select.length - 1 ? ',' : ''}`),
      'FROM (',
      ...sql.map((line) => INDENT + line),
      ') x',
    ].join('\n');
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
  const [wrapInSubquery, setWrapInSubquery] = useState(false);
  const querySQL = queryToSQL(query, table, wrapInSubquery);

  return (
    <div className="QueryPreview">
      <Typography.Title level={4}>{t('Query Preview')}</Typography.Title>
      <div className="QueryPreview-output">
        <pre className="QueryPreview-output-content">{querySQL}</pre>
      </div>
      <div className="QueryPreview-actions">
        <Checkbox checked={wrapInSubquery} onChange={(e) => setWrapInSubquery(e.target.checked)}>
          {t('Wrap in subquery')}
        </Checkbox>
        <div className="QueryPreview-actions-space" />
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
      </div>
    </div>
  );
};
