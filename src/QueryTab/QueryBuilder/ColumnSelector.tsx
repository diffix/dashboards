import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, List, Select, Typography } from 'antd';
import { find, findIndex } from 'lodash';
import React, { FunctionComponent } from 'react';
import { useT } from '../../shared-react';
import { TableColumn } from '../../types';
import { BucketColumn, GeneralizationState } from '../types';
import { GeneralizationControls } from './GeneralizationControls';
import { CommonProps, removeAt, swap } from './utils';

import './styles.css';

const initialGeneralization: GeneralizationState = {
  active: false,
  binSize: null,
  substringStart: null,
  substringLength: null,
};

function makeBucketColumn(c: TableColumn): BucketColumn {
  return {
    ...c,
    generalization: initialGeneralization,
  };
}

function canGeneralize(c: BucketColumn) {
  switch (c.type) {
    case 'integer':
    case 'real':
    case 'text':
      return true;
    default:
      return false;
  }
}

export type ColumnSelectorProps = CommonProps & {
  queryableColumns: TableColumn[];
};

export const ColumnSelector: FunctionComponent<ColumnSelectorProps> = ({ query, updateQuery, queryableColumns }) => {
  const t = useT('QueryBuilder::ColumnSelector');

  const bucketableColumns = queryableColumns.filter(
    (c) =>
      !query.columns.some((selectedColumn) => selectedColumn.name === c.name) &&
      !query.aggregates.some((agg) => 'column' in agg && agg.column === c.name),
  );

  return (
    <div className="ColumnSelector">
      <Typography.Title level={4}>{t('Select columns')}</Typography.Title>

      {query.columns.length > 0 && (
        <div className="query-builder-list">
          <List
            size="small"
            bordered
            dataSource={query.columns}
            rowKey="name"
            renderItem={(column) => (
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
                        const index = findIndex(query.columns, { name: column.name });
                        if (index > 0) {
                          swap(query.columns, index, index - 1);
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
                        const index = findIndex(query.columns, { name: column.name });
                        if (index >= 0 && index < query.columns.length - 1) {
                          swap(query.columns, index, index + 1);
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
                        const index = findIndex(query.columns, { name: column.name });
                        removeAt(query.columns, index);
                      })
                    }
                  />,
                ]}
              >
                <div>
                  {canGeneralize(column) ? (
                    <Button
                      className="ColumnSelector-column-name"
                      size="small"
                      type="text"
                      onClick={() =>
                        updateQuery((query) => {
                          const columnDraft = find(query.columns, { name: column.name });
                          if (columnDraft) {
                            columnDraft.generalization.active = !columnDraft.generalization.active;
                          } else {
                            console.warn(`Column '${column.name}' not found.`);
                          }
                        })
                      }
                    >
                      {column.name}
                      {column.generalization.active ? <UpOutlined /> : <DownOutlined />}
                    </Button>
                  ) : (
                    column.name
                  )}
                  {column.generalization.active && (
                    <GeneralizationControls query={query} updateQuery={updateQuery} columnName={column.name} />
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      <div>
        <Select
          className="query-builder-select"
          placeholder={t('Add a column')}
          showSearch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value={[] as any}
          options={bucketableColumns.map((c) => ({ value: c.name, label: c.name }))}
          onChange={(name: string) =>
            updateQuery((query) => {
              const column = find(bucketableColumns, { name });
              if (column) {
                query.columns.push(makeBucketColumn(column));
              } else {
                console.warn(`Column '${name}' not found.`);
              }
            })
          }
          getPopupContainer={(triggerNode) => triggerNode.parentElement}
        />
      </div>
    </div>
  );
};
