import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, message, Select, Typography } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';
import { importer, TFunc, useT } from '../shared';
import { rowIndexColumn } from '../shared/config';
import { File, TableSchema } from '../types';

import './AidSelectionStep.css';

const { Title } = Typography;
const { Option } = Select;

type AidSelectionProps = {
  schema: TableSchema;
  file: File;
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

export const AidSelectionStep: FunctionComponent<AidSelectionProps> = ({
  schema,
  file,
  invalidateTableList,
  removeFile,
}) => {
  const t = useT('AidSelectionStep');
  const [aidColumn, setAidColumn] = useState('');
  return (
    <>
      <div className="AidSelectionStep admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.AidSelection} status={aidColumn ? 'done' : 'active'} />
        <Title level={3}>{t('Select the protected entity identifier column')}</Title>
        <Alert
          className="AidSelectionStep-notice"
          message={
            <>
              <strong>{t('CAUTION:')}</strong>{' '}
              {t(
                'When no identifier column is present in the data, you must ensure that each individual row from the input file represents a unique entity.',
              )}
            </>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          closable
        />
        <Select
          className="AidSelectionStep-select"
          showSearch
          placeholder={t("Select a column or 'None'")}
          optionFilterProp="children"
          onChange={(column: string) => setAidColumn(column)}
          filterOption={true}
        >
          <Option key={-1} value={rowIndexColumn}>
            {t('[None]')}
          </Option>
          {schema.columns.map((column, index) => (
            <Option key={index} value={column.name}>
              {column.name}
            </Option>
          ))}
        </Select>
      </div>
      {aidColumn ? (
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
            {`Import into ${file.name} (destructive operation!)`}
          </Button>
        </div>
      ) : null}
    </>
  );
};
