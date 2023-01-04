import { Select, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { useT } from '../../shared-react';
import { ImportedTable } from '../../types';
import { CommonProps, defaultQuery } from './utils';

import './styles.css';

export type TableSelectorProps = CommonProps & {
  tables: ImportedTable[];
};

export const TableSelector: FunctionComponent<TableSelectorProps> = ({ tables, query, updateQuery }) => {
  const t = useT('QueryBuilder::TableSelector');

  return (
    <div className="TableSelector">
      <Typography.Title level={4}>{t('From table')}</Typography.Title>
      <Select
        className="TableSelector-Select query-builder-select"
        popupClassName="query-builder-select-dropdown"
        placeholder={t('Select a table')}
        showSearch
        value={query.table ?? undefined}
        options={tables.map((t) => ({ value: t.name, label: t.name }))}
        onChange={(newTable) => updateQuery(defaultQuery(newTable))}
        getPopupContainer={(triggerNode) => triggerNode.parentElement}
      />
    </div>
  );
};
