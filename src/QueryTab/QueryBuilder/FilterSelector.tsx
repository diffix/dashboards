import { CloseOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, List, Select, Typography } from 'antd';
import { find, findIndex } from 'lodash';
import React, { FunctionComponent } from 'react';
import { useT } from '../../shared-react';
import { ColumnType, TableColumn } from '../../types';
import { ColumnReference, Filter } from '../types';
import { CommonProps, removeAt } from './utils';

import './styles.css';

function defaultFilterValue(type: ColumnType) {
  switch (type) {
    case 'boolean':
      return true;
    case 'real':
    case 'integer':
      return 0;
    case 'text':
      return '';
    case 'timestamp':
      return new Date();
  }
}

type FilterValueEditorProps = CommonProps & {
  column: ColumnReference;
};

const FilterValueEditor: FunctionComponent<FilterValueEditorProps> = ({ column, query, updateQuery }) => {
  const t = useT('QueryBuilder::FilterValueEditor');

  const filter = find(query.filters, { column });

  if (!filter) {
    return null; // Should never happen.
  }

  function updateFilterValue(newValue: Filter['value']) {
    updateQuery((query) => {
      const filter = find(query.filters, { column });
      if (filter) {
        filter.value = newValue;
      } else {
        console.warn(`Filter for column '${column}' not found.`);
      }
    });
  }

  switch (filter.type) {
    case 'boolean':
      return (
        <div className="FilterValueEditor">
          <Select
            className="FilterValueEditor-input-boolean"
            size="small"
            value={filter.value ? 'true' : 'false'}
            onChange={(newValue) => updateFilterValue(newValue === 'true')}
          >
            <Select.Option value="true">{t('true')}</Select.Option>
            <Select.Option value="false">{t('false')}</Select.Option>
          </Select>
        </div>
      );
    case 'text':
      return (
        <div className="FilterValueEditor">
          <Input
            className="FilterValueEditor-input-text"
            size="small"
            value={(filter.value as string) ?? ''}
            onChange={(e) => updateFilterValue(e.target.value)}
          />
        </div>
      );
    case 'real':
    case 'integer':
      return (
        <div className="FilterValueEditor">
          <InputNumber
            className="FilterValueEditor-input-number"
            precision={filter.type === 'integer' ? 0 : undefined}
            size="small"
            value={(filter.value as number) ?? 0}
            onChange={(newValue) => updateFilterValue(newValue ?? 0)}
          />
        </div>
      );
    default:
      return null; // TODO: add timestamp support.
  }
};

export type FilterSelectorProps = CommonProps & {
  queryableColumns: TableColumn[];
};

export const FilterSelector: FunctionComponent<FilterSelectorProps> = ({ query, updateQuery, queryableColumns }) => {
  const t = useT('QueryBuilder::FilterSelector');

  const filterableColumns = queryableColumns.filter(
    (c) => c.type !== 'timestamp' && !find(query.filters, { column: c.name }),
  ); // TODO: add timestamp support.

  return (
    <div className="FilterSelector">
      <Typography.Title level={4}>{t('Filter by')}</Typography.Title>
      {query.filters.length > 0 && (
        <div className="query-builder-list">
          <List
            size="small"
            bordered
            dataSource={query.filters}
            rowKey="column"
            renderItem={(filter) => (
              <List.Item
                actions={[
                  <Button
                    key="remove"
                    size="small"
                    shape="circle"
                    type="text"
                    icon={<CloseOutlined />}
                    onClick={() =>
                      updateQuery((query) => {
                        const index = findIndex(query.filters, { column: filter.column });
                        removeAt(query.filters, index);
                      })
                    }
                  />,
                ]}
              >
                <div>{filter.column}&nbsp;=</div>
                <FilterValueEditor column={filter.column} query={query} updateQuery={updateQuery} />
              </List.Item>
            )}
          />
        </div>
      )}
      <Select
        className="FilterSelector-Select query-builder-select"
        placeholder={t('Filter by column')}
        showSearch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value={[] as any}
        options={filterableColumns.map((c) => ({ value: c.name, label: c.name }))}
        onChange={(name: string) =>
          updateQuery((query) => {
            const column = find(filterableColumns, { name });
            if (column) {
              query.filters.push({
                column: column.name,
                type: column.type,
                value: defaultFilterValue(column.type),
              });
            } else {
              console.warn(`Column '${name}' not found.`);
            }
          })
        }
      />
    </div>
  );
};
