import { Divider, message, Result, Table } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import React, { FunctionComponent, useCallback, useState } from 'react';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';
import { importer, TFunc, useCachedData, useT } from '../shared';

import { useQuery } from './use-query';

import './TableListStep.css';
import { ImportedTable } from '../types';

type CommonProps = {
  result: ImportedTable[];
  loading: boolean;
  invalidateTableList: () => void;
  t: TFunc;
};

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

function TableList({ result, loading, invalidateTableList, t }: CommonProps) {
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
    <>
      <div className="TableList admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.TableList} status={loading ? 'loading' : 'done'} />
        <Table
          key={loading ? 1 : 0 /* Resets internal state */}
          loading={loading}
          columns={columns}
          dataSource={result}
        />
      </div>
    </>
  );
}

const emptyQueryResult: ImportedTable[] = [];

export type TableListStepProps = {
  children: (data: TableListStepData) => React.ReactNode;
};

export type TableListStepData = {
  invalidateTableList: () => void;
};

export const TableListStep: FunctionComponent<TableListStepProps> = ({ children }) => {
  const t = useT('TableListStep');
  const [tableListLoaded, setTableListLoaded] = useState(false);
  const invalidateTableList = useCallback(() => setTableListLoaded(false), []);
  const computedResult = useQuery(tableListLoaded, setTableListLoaded);
  const cachedResult = useCachedData(computedResult, emptyQueryResult);

  switch (computedResult.state) {
    case 'in_progress':
    case 'completed': {
      const loading = computedResult.state !== 'completed';
      return (
        <>
          <TableList result={cachedResult} loading={loading} invalidateTableList={invalidateTableList} t={t} />
          {/* Render next step */}
          {
            <>
              <Divider />
              {children({ invalidateTableList })}
            </>
          }
        </>
      );
    }

    case 'failed':
      return (
        <div className="TableListStep admin-panel-step failed">
          <AdminPanelNavAnchor step={AdminPanelNavStep.TableList} status="failed" />
          <Result status="error" title={t('Loading of the table list failed')} subTitle={t('Something went wrong.')} />
        </div>
      );
  }
};
