import { Button, Form, Input, message, Typography } from 'antd';
import { snakeCase } from 'lodash';
import path from 'path';
import React, { FunctionComponent, useState } from 'react';
import { postgresReservedKeywords } from '../../constants';
import { importer, TFunc, useInvalidateTableList, useT, useTableList } from '../../shared';
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

async function importCSV(file: File, tableName: string, schema: TableSchema, aidColumns: string[], t: TFunc) {
  const fileName = file.name;
  message.loading({
    content: t('Importing {{fileName}}...', { fileName }),
    key: file.path,
    duration: 0,
  });

  try {
    const task = importer.importCSV(file, tableName, schema.columns, aidColumns);
    await task.result;
    message.success({
      content: t('{{fileName}} imported successfully!', { fileName }),
      key: file.path,
      duration: 10,
    });
    return true;
  } catch (e) {
    console.error(e);
    const reason = String(e).substring(0, 1000);
    message.error({ content: t('Data import failed: {{reason}}', { reason }), key: file.path, duration: 10 });
    return false;
  }
}

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
  const tableList = useTableList();
  const invalidateTableList = useInvalidateTableList();

  const fileName = file.name;
  const [tableName, setTableName] = useState(fixTableName(path.parse(fileName).name));
  const tableExists = tableList.map((table) => table.name).includes(tableName);

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
            const success = await importCSV(file, tableName, schema, aidColumns, t);
            if (success) {
              invalidateTableList();
              removeFile();
            }
          }}
          disabled={tableName ? false : true}
        >
          {t('Import')}
        </Button>
      </div>
    </>
  );
};
