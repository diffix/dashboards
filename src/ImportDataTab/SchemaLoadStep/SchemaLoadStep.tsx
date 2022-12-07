import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Divider, Result, Space, Spin, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { PREVIEW_ROWS_COUNT } from '../../shared/constants';
import { useT } from '../../shared-react';
import { useSchema } from '../../state';
import { File, ParseOptions, TableSchema } from '../../types';
import { ImportDataNavAnchor, ImportDataNavStep } from '../import-data-nav';
import { DataPreviewTable } from './DataPreviewTable';

const { Text, Title } = Typography;

const FILE_SIZE_THRESHOLD_MB = 300;

export type SchemaLoadStepProps = {
  file: File;
  parseOptions: ParseOptions;
  children: (data: SchemaLoadStepData) => React.ReactNode;
};

export type SchemaLoadStepData = {
  schema: TableSchema;
};

export const SchemaLoadStep: FunctionComponent<SchemaLoadStepProps> = ({ children, file, parseOptions }) => {
  const t = useT('ImportDataTab::SchemaLoadStep');
  const schema = useSchema(file, parseOptions);
  const fileLarge = file.size > FILE_SIZE_THRESHOLD_MB * 1000000;

  switch (schema.state) {
    case 'hasData':
      return (
        <>
          <div className="SchemaLoadStep import-data-step completed">
            <ImportDataNavAnchor step={ImportDataNavStep.DataPreview} status="done" />
            <Title level={3}>{t('{{stepNumber}}. Data Preview', { stepNumber: 2 })}</Title>
            <div className="mb-1">
              <Text>{t('Here is what {{fileName}} looks like:', { fileName: schema.data.file.name })}</Text>
              {schema.data.rowsPreview.length === PREVIEW_ROWS_COUNT && (
                <Text type="secondary">
                  {' '}
                  {t('(only the first {{count}} rows are shown)', { count: PREVIEW_ROWS_COUNT })}
                </Text>
              )}
            </div>
            <DataPreviewTable schema={schema.data} />
            {fileLarge ? (
              <Alert
                className="SchemaLoadStep-notice"
                message={
                  <>
                    <strong>{t('CAUTION:')}</strong>{' '}
                    {t(
                      'Diffix Dashboards is alpha software. We have not tested for datasets this large (> {{thresholdMB}} MB), and so it is possible that certain features may become unresponsive or not work correctly.',
                      { thresholdMB: FILE_SIZE_THRESHOLD_MB },
                    )}
                  </>
                }
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
              />
            ) : undefined}
          </div>
          {/* Render next step */}
          <Divider />
          {children({ schema: schema.data })}
        </>
      );

    case 'hasError':
      return (
        <div className="SchemaLoadStep import-data-step failed">
          <ImportDataNavAnchor step={ImportDataNavStep.DataPreview} status="failed" />
          <Result
            status="error"
            title={t('Schema discovery failed')}
            subTitle={t('Something went wrong while loading the schema.')}
          />
        </div>
      );

    case 'loading':
      return (
        <div className="SchemaLoadStep import-data-step text-center">
          <ImportDataNavAnchor step={ImportDataNavStep.DataPreview} status="loading" />
          <Space direction="vertical">
            <Spin size="large" />
            <Text type="secondary">{t('Loading schema')}</Text>
          </Space>
        </div>
      );
  }
};
