import { DeleteOutlined } from '@ant-design/icons';
import { message, Table, Typography } from 'antd';
import React, { FunctionComponent, useEffect } from 'react';
import { importer, TFunc, useInvalidateTableList, useT, useTableList } from '../shared';

import './TableList.css';

const { Title } = Typography;

async function removeTable(tableName: string, invalidateTableList: () => void, t: TFunc) {
  message.loading({
    content: t('Removing table {{tableName}}...', { tableName }),
    key: tableName,
    duration: 0,
  });

  try {
    const task = importer.removeTable(tableName);
    await task.result;
    message.success({
      content: t('{{tableName}} removed!', { tableName }),
      key: tableName,
      duration: 10,
    });
    invalidateTableList();
    return true;
  } catch (e) {
    console.error(e);
    message.error({ content: t('Table removal failed!'), key: tableName, duration: 10 });
    return false;
  }
}

export const TableList: FunctionComponent = () => {
  const t = useT('AdminTab::TableList');
  const tableList = useTableList();
  const invalidateTableList = useInvalidateTableList();

  useEffect(() => {
    // Fetch on first mount.
    invalidateTableList();
  }, [invalidateTableList]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <div className="TableList name-column">
          {text}
          <DeleteOutlined onClick={() => removeTable(text, invalidateTableList, t)} />
        </div>
      ),
    },
    {
      title: 'AID columns',
      dataIndex: 'aidColumns',
      key: 'aidColumns',
      render: (aidColumns: string[]) => aidColumns.join(', '),
    },
  ];

  return (
    <div className="TableList">
      <Title level={3}>{t('Imported tables')}</Title>
      <Table columns={columns} dataSource={tableList} />
    </div>
  );
};
