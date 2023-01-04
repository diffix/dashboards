import { BarChartOutlined, ConsoleSqlOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Button, message, Popconfirm, Space, Table, Tooltip } from 'antd';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { TFunc, useStaticValue, useT } from '../shared-react';
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

type TableActionsProps = {
  table: ImportedTable;
  onOpenMetabaseTab: (initialPath?: string) => void;
  showMetabaseHint: boolean;
};

const TableActions: FunctionComponent<TableActionsProps> = ({ table, onOpenMetabaseTab, showMetabaseHint }) => {
  const t = useT('AdminTab::TableList::TableActions');

  const [examplesInProgress, setExamplesInProgress] = useState(false);
  const { getTableExamples, removeTable } = useTableActions();

  const messageKey = useStaticValue(() => getUniqueKey());

  useEffect(() => {
    const handleClickAnywhere = () => {
      if (!examplesInProgress) message.destroy(messageKey);
    };
    document.addEventListener('mousedown', handleClickAnywhere);
    return () => document.removeEventListener('mousedown', handleClickAnywhere);
  }, [examplesInProgress, messageKey]);

  const [metabaseHintHovered, setMetabaseHintHovered] = useState(false);
  // Manage visibility manually because a programmatic tab change leaves a dangling tooltip.
  const [examplesTooltipVisible, setExamplesTooltipOpen] = useState(false);

  return (
    <Tooltip
      placement="left"
      open={showMetabaseHint && !metabaseHintHovered}
      title={t('Click here to analyze in Metabase')}
      onOpenChange={(open) => open || setMetabaseHintHovered(true)}
    >
      <Space>
        <Tooltip title={t('New SQL query')}>
          <Button
            type="text"
            shape="circle"
            icon={<ConsoleSqlOutlined />}
            onClick={() => onOpenMetabaseTab(`/question/notebook#${table.initialQueryPayloads?.sqlPayload || ''}`)}
          />
        </Tooltip>

        <Tooltip title={t('Example SQL queries')} open={examplesTooltipVisible} onOpenChange={setExamplesTooltipOpen}>
          <Button
            type="text"
            shape="circle"
            icon={<BarChartOutlined />}
            disabled={examplesInProgress}
            onClick={async () => {
              const messageTimeout = setTimeout(
                () =>
                  message.loading({
                    content: t('Examples for {{tableName}} under construction...', { tableName: table.name }),
                    key: messageKey,
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
                  message.destroy(messageKey);
                  setExamplesTooltipOpen(false);
                  onOpenMetabaseTab(`/collection/${examplesCollectionId}`);
                } else {
                  message.success({
                    content: (
                      <Button
                        type="link"
                        onClick={() => {
                          setExamplesTooltipOpen(false);
                          onOpenMetabaseTab(`/collection/${examplesCollectionId}`);
                          message.destroy(messageKey);
                        }}
                      >
                        {t('Examples for {{tableName}} ready. Click to view', { tableName: table.name })}
                      </Button>
                    ),
                    key: messageKey,
                    // We rely on `message.destroy` called on `handleClickAnywhere`.
                    duration: 0,
                  });
                }
              } catch (err) {
                message.error({
                  content: t('Examples for {{tableName}} failed', { tableName: table.name }),
                  key: messageKey,
                  // We rely on `message.destroy` called on `handleClickAnywhere`.
                  duration: 0,
                });
                console.warn('Error when building examples', table.name, err);
              } finally {
                setExamplesInProgress(false);
              }
            }}
          />
        </Tooltip>

        <Tooltip title={t('Remove table')}>
          <Popconfirm
            placement="bottomRight"
            title={t('Remove table `{{name}}`?', { name: table.name })}
            icon={<QuestionCircleOutlined />}
            onConfirm={() => removeTable(table.name)}
            okText={t('Remove')}
            cancelText={t('Cancel')}
          >
            <Button type="text" shape="circle" icon={<DeleteOutlined />} disabled={examplesInProgress} />
          </Popconfirm>
        </Tooltip>
      </Space>
    </Tooltip>
  );
};

export type TableListProps = {
  onOpenMetabaseTab: (initialPath?: string) => void;
  showMetabaseHint: boolean;
};

export const TableList: FunctionComponent<TableListProps> = ({ onOpenMetabaseTab, showMetabaseHint }) => {
  const t = useT('AdminTab::TableList');
  const tableListLoadable = useTableListLoadable();
  const tableList = useCachedLoadable(tableListLoadable, []);
  const tableListIsLoading = useIsLoading(tableListLoadable);

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
            <TableActions
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
