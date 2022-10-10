import { Button, Form, Input, message, Typography } from 'antd';
import path from 'path';
import React, { FunctionComponent, useState } from 'react';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';
import { importer, TFunc, useT } from '../shared';
import { File, ImportedTable, TableSchema } from '../types';

import './ImportStep.css';

const { Title } = Typography;

type ImportProps = {
  tableList: ImportedTable[];
  file: File;
  schema: TableSchema;
  aidColumn: string;
  invalidateTableList: () => void;
  removeFile: () => void;
};

async function importCSV(file: File, tableName: string, schema: TableSchema, aidColumn: string, t: TFunc) {
  const fileName = file.name;
  message.loading({
    content: t('Importing {{fileName}}...', { fileName }),
    key: file.path,
    duration: 0,
  });

  try {
    const task = importer.importCSV(file, tableName, schema.columns, aidColumn);
    await task.result;
    message.success({
      content: t('{{fileName}} imported successfully!', { fileName }),
      key: file.path,
      duration: 10,
    });
    return true;
  } catch (e) {
    console.error(e);
    message.error({ content: t('Data import failed!'), key: file.path, duration: 10 });
    return false;
  }
}

export const ImportStep: FunctionComponent<ImportProps> = ({
  tableList,
  file,
  schema,
  aidColumn,
  invalidateTableList,
  removeFile,
}) => {
  const t = useT('ImportStep');
  const fileName = file.name;
  const [tableName, setTableName] = useState(path.parse(fileName).name);
  const tableExists = tableList.map((table) => table.name).includes(tableName) ? true : false;

  return (
    <>
      <div className="ImportStep admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.Import} />
        <Title level={3}>{t('Import')}</Title>
        <Form layout="inline" initialValues={{ tableName }} onValuesChange={({ tableName }) => setTableName(tableName)}>
          <Form.Item
            label={t('Table name')}
            hasFeedback
            validateStatus={tableExists ? 'warning' : ''}
            help={tableExists ? `${tableName} already exists, will be overwritten` : null}
            name="tableName"
            rules={[{ required: true }]}
          >
            <Input placeholder={tableName} />
          </Form.Item>
        </Form>
        <Button
          onClick={async () => {
            const success = await importCSV(file, tableName, schema, aidColumn, t);
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
