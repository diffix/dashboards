import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Divider, Select, Switch, Typography } from 'antd';
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
  aidColumns: string[];
};

export const AidSelectionStep: FunctionComponent<AidSelectionProps> = ({ schema, children }) => {
  const t = useT('AidSelectionStep');
  const [aidColumn, setAidColumn] = useState('');
  const [publicTable, setPublicTable] = useState(false);

  return (
    <>
      <div className="AidSelectionStep admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.AidSelection} status={aidColumn ? 'done' : 'active'} />
        <Title level={3}>{t('Select the protected entity identifier column')}</Title>
        <div className="AidSelectionStep-container">
          <Switch
            className="AidSelectionStep-switch"
            title="Make table public"
            checked={publicTable}
            onChange={(selected) => {
              setPublicTable(selected);
            }}
            checkedChildren={t('Public')}
            unCheckedChildren={t('Personal')}
          />
          {publicTable ? null : (
            <Select
              className="AidSelectionStep-select"
              showSearch
              placeholder={t("Select a column or 'None'")}
              optionFilterProp="children"
              onChange={(column: string) => setAidColumn(column)}
              value={aidColumn ? aidColumn : undefined}
              filterOption={true}
              disabled={publicTable}
            >
              <Option key={-1} value={rowIndexColumn}>
                {t('[Auto-generated row index column]')}
              </Option>
              {schema.columns.map((column, index) => (
                <Option key={index} value={column.name}>
                  {column.name}
                </Option>
              ))}
            </Select>
          )}
          {aidColumn == rowIndexColumn && !publicTable ? (
            <Alert
              className="AidSelectionStep-notice"
              message={
                <>
                  <strong>{t('CAUTION:')}</strong>{' '}
                  {t(
                    'When using the auto-generated index as identifier, you must ensure that each individual row from the input file represents a unique entity.',
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
        {(aidColumn || publicTable) && (
          <>
            <Divider />
            {children({ aidColumns: publicTable ? [] : [aidColumn] })}
          </>
        )}
      </div>
    </>
  );
};
