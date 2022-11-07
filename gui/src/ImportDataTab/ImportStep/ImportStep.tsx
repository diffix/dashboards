import { Button, Form, Input, Typography } from 'antd';
import { snakeCase } from 'lodash';
import path from 'path';
import React, { FunctionComponent, useState } from 'react';
import { postgresReservedKeywords } from '../../constants';
import { useT, useUnmountListener } from '../../shared';
import { useTableActions, useTableListCached } from '../../state';
import { File, TableSchema } from '../../types';
import { ImportDataNavAnchor, ImportDataNavStep } from '../import-data-nav';

import './ImportStep.css';

const { Title } = Typography;

type ImportProps = {
  file: File;
  schema: TableSchema;
  aidColumns: string[];
  removeFile: () => void;
};

// Produces a table name which will not require surrounding in double-quotes in PostgreSQL.
function fixTableName(name: string) {
  const snakeCaseName = snakeCase(name);
  return postgresReservedKeywords.includes(snakeCaseName) ? '_' + snakeCaseName : snakeCaseName;
}

// Checks whether a table name will not require surrounding in double-quotes in PostgreSQL.
function tableNameFixed(name: string) {
  return name == fixTableName(name);
}

export const ImportStep: FunctionComponent<ImportProps> = ({ file, schema, aidColumns, removeFile }) => {
  const t = useT('ImportDataTab::ImportStep');
  const tableList = useTableListCached();
  const { importCSV } = useTableActions();

  const fileName = file.name;
  const [tableName, setTableName] = useState(fixTableName(path.parse(fileName).name));
  const tableExists = tableList.map((table) => table.name).includes(tableName);

  const [isImporting, setIsImporting] = useState(false);
  const unmountListener = useUnmountListener();

  return (
    <>
      <div className="ImportStep import-data-step">
        <ImportDataNavAnchor step={ImportDataNavStep.Import} />
        <Title level={3}>{t('Import')}</Title>
        <Form layout="inline" initialValues={{ tableName }} onValuesChange={({ tableName }) => setTableName(tableName)}>
          <Form.Item
            label={t('Table name')}
            hasFeedback
            validateStatus={tableExists || !tableNameFixed(tableName) ? 'warning' : ''}
            help={
              tableExists
                ? t('{{tableName}} already exists, will be overwritten', { tableName })
                : !tableNameFixed(tableName)
                ? t('{{tableName}} will require double-quotes in SQL, try {{fixedTableName}} instead', {
                    tableName,
                    fixedTableName: fixTableName(tableName),
                  })
                : null
            }
            name="tableName"
            rules={[{ required: true }]}
          >
            <Input placeholder={tableName} />
          </Form.Item>
        </Form>
        <Button
          onClick={async () => {
            setIsImporting(true);
            const task = importCSV(file, tableName, schema, aidColumns);
            unmountListener.onUnmount = task.cancel;
            task.result
              .then((success) => {
                if (success) {
                  removeFile();
                }
              })
              .finally(() => {
                if (!unmountListener.hasUnmounted) {
                  setIsImporting(false);
                }
              });
          }}
          disabled={isImporting || !tableName}
        >
          {t('Import')}
        </Button>
      </div>
    </>
  );
};
