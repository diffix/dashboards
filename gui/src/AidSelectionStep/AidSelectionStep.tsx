import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Divider, Select, Typography } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';
import { useT } from '../shared';
import { rowIndexColumn } from '../shared/config';
import { TableSchema } from '../types';

import './AidSelectionStep.css';

const { Title } = Typography;
const { Option } = Select;

type AidSelectionProps = {
  schema: TableSchema;
  children: (data: AidSelectionStepData) => React.ReactNode;
};

export type AidSelectionStepData = {
  aidColumn: string;
};

export const AidSelectionStep: FunctionComponent<AidSelectionProps> = ({ schema, children }) => {
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
      <div className="AidSelectionStep-reserved-space">
        {/* Render next step */}
        {aidColumn && (
          <>
            <Divider />
            {children({ aidColumn })}
          </>
        )}
      </div>
    </>
  );
};
