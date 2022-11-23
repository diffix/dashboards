import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Divider, Radio, RadioChangeEvent, Select, Typography } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { ROW_INDEX_COLUMN } from '../../constants';
import { useT } from '../../shared';
import { TableSchema } from '../../types';
import { ImportDataNavAnchor, ImportDataNavStep } from '../import-data-nav';

import './AidSelectionStep.css';

const { Title } = Typography;
const { Option } = Select;

type AidSelectionProps = {
  schema: TableSchema;
  children: (data: AidSelectionStepData) => React.ReactNode;
};

export type AidSelectionStepData = {
  aidColumns: string[];
};

export const AidSelectionStep: FunctionComponent<AidSelectionProps> = ({ schema, children }) => {
  const t = useT('ImportDataTab::AidSelectionStep');
  const [aidColumn, setAidColumn] = useState('');
  const [protectedEntity, setProtectedEntity] = useState<'onePerRow' | 'multipleRows' | 'none'>('multipleRows');
  const publicTable = protectedEntity === 'none';
  const perRow = protectedEntity === 'onePerRow';
  const perAIDColumns = protectedEntity === 'multipleRows';

  return (
    <>
      <div className="AidSelectionStep import-data-step">
        <ImportDataNavAnchor step={ImportDataNavStep.AidSelection} status={aidColumn ? 'done' : 'active'} />
        <Title level={3}>{t('{{stepNumber}}. Select the protected entity', { stepNumber: 3 })}</Title>
        <div className="AidSelectionStep-container">
          <Radio.Group
            className="AidSelectionStep-radio-group"
            value={protectedEntity}
            onChange={(e: RadioChangeEvent) => {
              setProtectedEntity(e.target.value);
            }}
          >
            <Radio.Button value="onePerRow">{t('One row per protected entity')}</Radio.Button>
            <Radio.Button value="multipleRows">{t('Multiple rows per protected entity')}</Radio.Button>
            <Radio.Button value="none">{t('None (data is not personal)')}</Radio.Button>
          </Radio.Group>
          {perAIDColumns ? (
            <Select
              className="AidSelectionStep-select"
              showSearch
              placeholder={t('Select the protected entity ID column')}
              optionFilterProp="children"
              onChange={(column: string) => setAidColumn(column)}
              value={aidColumn ? aidColumn : undefined}
              filterOption={true}
              disabled={publicTable}
            >
              {schema.columns.map((column, index) => (
                <Option key={index} value={column.name}>
                  {column.name}
                </Option>
              ))}
            </Select>
          ) : null}
          {perRow ? (
            <Alert
              className="AidSelectionStep-notice"
              message={
                <>
                  <strong>{t('CAUTION:')}</strong>{' '}
                  {t(
                    'You must ensure that each individual row from the input file represents a unique protected entity.',
                  )}
                </>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
            />
          ) : null}
          {publicTable ? (
            <Alert
              className="AidSelectionStep-notice"
              message={
                <>
                  <strong>{t('NOTICE:')}</strong>{' '}
                  {t('File will be imported into a public table. Data contained within will not be anonymized.')}
                </>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
            />
          ) : null}
        </div>
      </div>
      <div className="AidSelectionStep-reserved-space">
        {/* Render next step */}
        {(perRow || publicTable || aidColumn) && (
          <>
            <Divider />
            {children({ aidColumns: publicTable ? [] : perRow ? [ROW_INDEX_COLUMN] : [aidColumn] })}
          </>
        )}
      </div>
    </>
  );
};
