import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, List, Select, Typography } from 'antd';
import { find, findIndex } from 'lodash';
import React, { FunctionComponent } from 'react';
import { TFunc, useT } from '../../shared-react';
import { TableColumn } from '../../types';
import { AggregateType } from '../types';
import { CommonProps, getAggKey, removeAt, swap } from './utils';

import './styles.css';

function aggLabel(aggType: AggregateType, t: TFunc) {
  switch (aggType) {
    case 'count-rows':
      return t('Count of rows');
    case 'count-entities':
      return t('Count of entities');
    case 'count-column':
      return t('Count of column');
    case 'count-distinct-column':
      return t('Count of distinct');
    case 'sum':
      return t('Sum of');
    case 'avg':
      return t('Average of');
    default:
      throw new Error('Invalid aggregate type.');
  }
}

type AggColumnSelectorProps = CommonProps & {
  aggKey: number;
  validColumns: TableColumn[];
};

const AggColumnSelector: FunctionComponent<AggColumnSelectorProps> = ({
  aggKey: key,
  validColumns,
  query,
  updateQuery,
}) => {
  const t = useT('QueryTab::QueryBuilder::AggColumnSelector');

  const agg = find(query.aggregates, { key });

  if (!agg || !('column' in agg)) {
    return null;
  }

  return (
    <div className="AggColumnSelector">
      <Select
        className="AggColumnSelector-select"
        size="small"
        placeholder={t('Select a column')}
        showSearch
        value={agg.column}
        options={validColumns.map((c) => ({ value: c.name, label: c.name }))}
        onChange={(column: string) =>
          updateQuery((query) => {
            const agg = find(query.aggregates, { key });
            if (agg) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (agg as any).column = column;
            } else {
              console.warn(`Aggregate '${key}' not found.`);
            }
          })
        }
        getPopupContainer={(triggerNode) => triggerNode.parentElement}
      />
    </div>
  );
};

export type AggregateSelectorProps = CommonProps & {
  aidColumns: string[];
  queryableColumns: TableColumn[];
};

export const AggregateSelector: FunctionComponent<AggregateSelectorProps> = ({
  queryableColumns,
  aidColumns,
  query,
  updateQuery,
}) => {
  const t = useT('QueryTab::QueryBuilder::AggregateSelector');

  const aggregableColumns = queryableColumns.filter(
    (c) => !query.columns.some((selectedColumn) => selectedColumn.name === c.name),
  );

  const numericAggregableColumns = aggregableColumns.filter((c) => c.type === 'integer' || c.type === 'real');

  return (
    <div className="AggregateSelector">
      <Typography.Title level={4}>{t('Summarize')}</Typography.Title>

      {query.aggregates.length > 0 && (
        <div className="query-builder-list">
          <List
            size="small"
            bordered
            dataSource={query.aggregates}
            rowKey="key"
            renderItem={(agg) => (
              <List.Item
                actions={[
                  <Button
                    key="move-up"
                    size="small"
                    shape="circle"
                    type="text"
                    icon={<ArrowUpOutlined />}
                    onClick={() =>
                      updateQuery((query) => {
                        const index = findIndex(query.aggregates, { key: agg.key });
                        if (index > 0) {
                          swap(query.aggregates, index, index - 1);
                        }
                      })
                    }
                  />,
                  <Button
                    key="move-down"
                    size="small"
                    shape="circle"
                    type="text"
                    icon={<ArrowDownOutlined />}
                    onClick={() =>
                      updateQuery((query) => {
                        const index = findIndex(query.aggregates, { key: agg.key });
                        if (index < query.aggregates.length - 1) {
                          swap(query.aggregates, index, index + 1);
                        }
                      })
                    }
                  />,
                  <Button
                    key="remove"
                    size="small"
                    shape="circle"
                    type="text"
                    icon={<CloseOutlined />}
                    onClick={() =>
                      updateQuery((query) => {
                        const index = findIndex(query.aggregates, { key: agg.key });
                        removeAt(query.aggregates, index);
                      })
                    }
                  />,
                ]}
              >
                <div>{aggLabel(agg.type, t)}</div>
                <AggColumnSelector
                  aggKey={agg.key}
                  validColumns={agg.type === 'avg' || agg.type === 'sum' ? numericAggregableColumns : aggregableColumns}
                  query={query}
                  updateQuery={updateQuery}
                />
              </List.Item>
            )}
          />
        </div>
      )}

      <div>
        <Select
          className="AggregateSelector-Select query-builder-select"
          popupClassName="query-builder-select-dropdown"
          placeholder={t('Add an aggregate')}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value={[] as any}
          options={[
            { value: 'count-rows', label: t('Count of rows') },
            ...(aidColumns.length > 0 ? [{ value: 'count-entities', label: t('Count of entities') }] : []),
            ...(aggregableColumns.length > 0
              ? [
                  { value: 'count-column', label: t('Count of column') },
                  { value: 'count-distinct-column', label: t('Count of distinct') },
                ]
              : []),
            ...(numericAggregableColumns.length > 0
              ? [
                  { value: 'sum', label: t('Sum of') },
                  { value: 'avg', label: t('Average of') },
                ]
              : []),
          ]}
          onChange={(type: AggregateType) =>
            updateQuery((query) => {
              switch (type) {
                case 'count-rows':
                case 'count-entities':
                  query.aggregates.push({ key: getAggKey(), type });
                  break;
                case 'count-column':
                case 'count-distinct-column':
                  query.aggregates.push({ key: getAggKey(), type, column: aggregableColumns[0].name });
                  break;
                case 'sum':
                case 'avg':
                  query.aggregates.push({ key: getAggKey(), type, column: numericAggregableColumns[0].name });
                  break;
              }
            })
          }
          getPopupContainer={(triggerNode) => triggerNode.parentElement}
        />
      </div>
    </div>
  );
};
