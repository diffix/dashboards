import { DeleteOutlined } from '@ant-design/icons';
import { Button, Table } from 'antd';
import React, { FunctionComponent } from 'react';
import { ROW_INDEX_COLUMN } from '../constants';
import { TFunc, useT } from '../shared';
import { useCachedLoadable, useIsLoading, useTableActions, useTableListLoadable } from '../state';
import { ImportedTable } from '../types';

const { Column } = Table;

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

  return (
    <div className="TableList">
      <Table dataSource={tableList} loading={tableListIsLoading} rowKey="name">
        <Column title={t('Name')} dataIndex="name" />
        <Column
          title={t('Protected entities')}
          dataIndex="aidColumns"
          render={(aidColumns: string[]) => renderAidColumns(aidColumns, t)}
        />
        <Column
          key="actions"
          align="right"
          render={(_: unknown, table: ImportedTable) => (
            <Button type="text" shape="circle" onClick={() => removeTable(table.name)}>
              <DeleteOutlined />
            </Button>
          )}
        />
      </Table>
    </div>
  );
};