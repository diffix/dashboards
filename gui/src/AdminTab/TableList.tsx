import { DeleteOutlined } from '@ant-design/icons';
import { Table, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { ROW_INDEX_COLUMN } from '../constants';
import { TFunc, useT } from '../shared';
import { useCachedLoadable, useIsLoading, useTableActions, useTableListLoadable } from '../state';

import './TableList.css';

const { Title } = Typography;

function renderAidColumns(aidColumns: string[], t: TFunc) {
  if (aidColumns.length == 0) {
    return t('None');
  } else if (aidColumns.length == 1 && aidColumns[0] == ROW_INDEX_COLUMN) {
    return t('Per Row');
  } else if (aidColumns.length == 1) {
    return t('Column: {{column}}', { column: aidColumns[0] });
  } else {
    return t('Columns: {{columns}}', { columns: aidColumns.join(', ') });
  }
}

export const TableList: FunctionComponent = () => {
  const t = useT('AdminTab::TableList');
  const tableListLodable = useTableListLoadable();
  const tableList = useCachedLoadable(tableListLodable, []);
  const tableListIsLoading = useIsLoading(tableListLodable);
  const { removeTable } = useTableActions();

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <div className="TableList name-column">
          {text}
          <DeleteOutlined onClick={() => removeTable(text)} />
        </div>
      ),
    },
    {
      title: 'Protected entities',
      dataIndex: 'aidColumns',
      key: 'aidColumns',
      render: (aidColumns: string[]) => renderAidColumns(aidColumns, t),
    },
  ];

  return (
    <div className="TableList">
      <Title level={3}>{t('Imported tables')}</Title>
      <Table columns={columns} dataSource={tableList} loading={tableListIsLoading} />
    </div>
  );
};
