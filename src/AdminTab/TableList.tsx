import { DeleteOutlined, ConsoleSqlOutlined, EllipsisOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Tooltip, Table, Dropdown, Menu, Popconfirm } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { ROW_INDEX_COLUMN } from '../constants';
import { TFunc, useT } from '../shared';
import { useCachedLoadable, useIsLoading, useTableActions, useTableListLoadable } from '../state';
import { ImportedTable } from '../types';

const { Column } = Table;

function renderAidColumns(aidColumns: string[], t: TFunc) {
  if (aidColumns.length === 0) {
    return t('None');
  } else if (aidColumns.length === 1 && aidColumns[0] === ROW_INDEX_COLUMN) {
    return t('Per Row');
  } else if (aidColumns.length === 1) {
    return t('Column: {{column}}', { column: aidColumns[0] });
  } else {
    return t('Columns: {{columns}}', { columns: aidColumns.join(', ') });
  }
}

type TableDropdownProps = {
  table: ImportedTable;
  onOpenMetabaseTab: (initialPath?: string) => void;
  showMetabaseHint: boolean;
};

const TableDropdown: FunctionComponent<TableDropdownProps> = ({ table, onOpenMetabaseTab, showMetabaseHint }) => {
  const t = useT('AdminTab::TableList::TableDropdown');

  const [metabaseHintHovered, setMetabaseHintHovered] = useState(false);
  const { removeTable } = useTableActions();

  const menu = (
    <Menu>
      <Menu.Item
        icon={<ConsoleSqlOutlined />}
        key={`${table.name}-new-sql`}
        onClick={() => onOpenMetabaseTab(`question/notebook#${table.initialQueryPayloads?.sqlPayload}`)}
      >
        {t('New SQL query')}
      </Menu.Item>
      <Popconfirm
        title={t('Remove table `{{name}}`?', { name: table.name })}
        icon={<QuestionCircleOutlined />}
        onConfirm={() => removeTable(table.name)}
        okText={t('Remove')}
        cancelText={t('Cancel')}
      >
        <Menu.Item icon={<DeleteOutlined />} key={`${table.name}-remove`}>
          {t('Remove')}
        </Menu.Item>
      </Popconfirm>
    </Menu>
  );

  return (
    <Tooltip
      placement="left"
      visible={showMetabaseHint && !metabaseHintHovered}
      title={t('Click here to analyze in Metabase')}
      onVisibleChange={(visible) => visible || setMetabaseHintHovered(true)}
    >
      <Dropdown overlay={menu} trigger={['click']}>
        <Button type={showMetabaseHint && !metabaseHintHovered ? 'primary' : 'text'} shape="circle" size="large">
          <EllipsisOutlined />
        </Button>
      </Dropdown>
    </Tooltip>
  );
};

export type TableListProps = {
  onOpenMetabaseTab: (initialPath?: string) => void;
  showMetabaseHint: boolean;
};

export const TableList: FunctionComponent<TableListProps> = ({ onOpenMetabaseTab, showMetabaseHint }) => {
  const t = useT('AdminTab::TableList');
  const tableListLodable = useTableListLoadable();
  const tableList = useCachedLoadable(tableListLodable, []);
  const tableListIsLoading = useIsLoading(tableListLodable);

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
          render={(_: unknown, table: ImportedTable, index: number) => (
            <TableDropdown
              table={table}
              onOpenMetabaseTab={onOpenMetabaseTab}
              showMetabaseHint={showMetabaseHint && index === 0}
            />
          )}
        />
      </Table>
    </div>
  );
};
