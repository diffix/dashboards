import {
  BarChartOutlined,
  ConsoleSqlOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Menu, message, Popconfirm, Table, Tooltip } from 'antd';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { TFunc, useT } from '../shared-react';
import { ROW_INDEX_COLUMN } from '../shared/constants';
import {
  getUniqueKey,
  useCachedLoadable,
  useIsLoading,
  useMetabaseStatus,
  usePostgresqlStatus,
  useTableActions,
  useTableListLoadable,
} from '../state';
import { ImportedTable, ServiceStatus } from '../types';

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
  const [examplesInProgress, setExamplesInProgress] = useState(false);
  const { getTableExamples, removeTable } = useTableActions();

  const messageKey = useRef(getUniqueKey());

  useEffect(() => {
    const handleClickAnywhere = () => {
      if (!examplesInProgress) message.destroy(messageKey.current);
    };
    document.addEventListener('mousedown', handleClickAnywhere);
    return () => document.removeEventListener('mousedown', handleClickAnywhere);
  }, [examplesInProgress]);

  const menu = (
    <Menu>
      <Menu.Item
        icon={<ConsoleSqlOutlined />}
        key={`${table.name}-new-sql`}
        onClick={() => onOpenMetabaseTab(`question/notebook#${table.initialQueryPayloads?.sqlPayload || ''}`)}
      >
        {t('New SQL query')}
      </Menu.Item>
      <Menu.Item
        icon={<BarChartOutlined />}
        key={`${table.name}-examples`}
        disabled={examplesInProgress}
        onClick={async () => {
          const messageTimeout = setTimeout(
            () =>
              message.loading({
                content: t('Examples for {{tableName}} under construction...', { tableName: table.name }),
                key: messageKey.current,
                duration: 0,
              }),
            1000,
          );

          setExamplesInProgress(true);
          try {
            const startTime = performance.now();
            const examplesCollectionId = await getTableExamples(table).result;
            const elapsed = performance.now() - startTime;

            if (elapsed < 3000) {
              clearTimeout(messageTimeout);
              message.destroy(messageKey.current);
              onOpenMetabaseTab(`collection/${examplesCollectionId}`);
            } else {
              message.success({
                content: (
                  <Button
                    type="link"
                    onClick={() => {
                      onOpenMetabaseTab(`collection/${examplesCollectionId}`);
                      message.destroy(messageKey.current);
                    }}
                  >
                    {t('Examples for {{tableName}} ready. Click to view', { tableName: table.name })}
                  </Button>
                ),
                key: messageKey.current,
                // We rely on `message.destroy` called on `handleClickAnywhere`.
                duration: 0,
              });
            }
          } catch (err) {
            message.error({
              content: t('Examples for {{tableName}} failed', { tableName: table.name }),
              key: messageKey.current,
              // We rely on `message.destroy` called on `handleClickAnywhere`.
              duration: 0,
            });
            console.warn('Error when building examples', table.name, err);
          } finally {
            setExamplesInProgress(false);
          }
        }}
      >
        {t('Example SQL queries')}
      </Menu.Item>
      <Popconfirm
        title={t('Remove table `{{name}}`?', { name: table.name })}
        icon={<QuestionCircleOutlined />}
        onConfirm={() => removeTable(table.name)}
        okText={t('Remove')}
        cancelText={t('Cancel')}
      >
        <Menu.Item icon={<DeleteOutlined />} key={`${table.name}-remove`} disabled={examplesInProgress}>
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

  // TODO: Checking metabase status to show the table list spinner is temporary.
  // We should be showing the list even if metabase is down, just not allow to use the
  // buttons relying on metabase.
  const postgresqlStatus = usePostgresqlStatus();
  const metabaseStatus = useMetabaseStatus();

  return (
    <div className="TableList">
      <Table
        dataSource={tableList}
        loading={
          tableListIsLoading || postgresqlStatus === ServiceStatus.Starting || metabaseStatus === ServiceStatus.Starting
        }
        rowKey="name"
      >
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
