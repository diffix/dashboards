import { Divider, Result, Space, Spin, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { PREVIEW_ROWS_COUNT } from '../../constants';
import { useT } from '../../shared';
import { useSchema } from '../../state';
import { File, TableSchema, ParseOptions } from '../../types';
import { ImportDataNavAnchor, ImportDataNavStep } from '../import-data-nav';
import { DataPreviewTable } from './DataPreviewTable';

const { Text, Title } = Typography;

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

  switch (schema.state) {
    case 'hasData':
      return (
        <>
          <div className="SchemaLoadStep import-data-step completed">
            <ImportDataNavAnchor step={ImportDataNavStep.DataPreview} status="done" />
            <Title level={3}>{t('Successfully loaded {{fileName}}', { fileName: schema.data.file.name })}</Title>
            <div className="mb-1">
              <Text>{t('Here is what the data looks like:')}</Text>
              {schema.data.rowsPreview.length === PREVIEW_ROWS_COUNT && (
                <Text type="secondary">
                  {' '}
                  {t('(only the first {{count}} rows are shown)', { count: PREVIEW_ROWS_COUNT })}
                </Text>
              )}
            </div>
            <DataPreviewTable schema={schema.data} />
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
