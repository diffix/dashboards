import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, message, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';
import { importer, TFunc, useT } from '../shared';
import { File, TableSchema } from '../types';

import './ImportStep.css';

const { Title } = Typography;

type ImportProps = {
  file: File;
  schema: TableSchema;
  aidColumn: string;
  invalidateTableList: () => void;
  removeFile: () => void;
};

async function importCSV(file: File, schema: TableSchema, aidColumn: string, t: TFunc) {
  const fileName = file.name;
  message.loading({
    content: t('Importing {{fileName}}...', { fileName }),
    key: file.path,
    duration: 0,
  });

  try {
    const task = importer.importCSV(file, schema.columns, aidColumn);
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
  file,
  schema,
  aidColumn,
  invalidateTableList,
  removeFile,
}) => {
  const t = useT('ImportStep');
  const fileName = file.name;

  return (
    <>
      <div className="ImportStep admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.Import} />
        <Title level={3}>{t('Import')}</Title>
        <Alert
          className="ImportStep-notice"
          message={
            <>
              <strong>{t('CAUTION:')}</strong> {t('TBD.')}
            </>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          closable
        />
        <div>
          <Button
            onClick={async () => {
              const success = await importCSV(file, schema, aidColumn, t);
              if (success) {
                invalidateTableList();
                removeFile();
              }
            }}
          >
            {t('Import into {{fileName}} (destructive operation!)', { fileName })}
          </Button>
        </div>
      </div>
    </>
  );
};
