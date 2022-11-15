import { PlusOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { useT } from '../shared';
import { useMetabaseStatus, usePostgresqlStatus } from '../state';
import { ServiceStatusCard } from './ServiceStatusCard';
import { TableList } from './TableList';

import './AdminTab.css';
import logo from './logo.png';

const { Title } = Typography;

export type AdminTabProps = {
  onOpenMetabaseTab: () => void;
  onOpenImportDataTab: () => void;
};

export const AdminTab: FunctionComponent<AdminTabProps> = ({ onOpenMetabaseTab, onOpenImportDataTab }) => {
  const t = useT('AdminTab');
  const postgresqlStatus = usePostgresqlStatus();
  const metabaseStatus = useMetabaseStatus();

  return (
    <div className="AdminTab">
      <div className="AdminTab-content">
        <div className="AdminTab-header">
          <div className="AdminTab-logo">
            <img src={logo} height="40" />
            {t('Diffix Dashboards')}
          </div>
          <div className="AdminTab-services">
            <ServiceStatusCard status={postgresqlStatus}>PostgreSQL</ServiceStatusCard>
            <ServiceStatusCard status={metabaseStatus}>Metabase</ServiceStatusCard>
          </div>
        </div>
        <div className="AdminTab-tables">
          <div className="AdminTab-tables-header">
            <Title level={3}>{t('Imported Tables')}</Title>
            <Button onClick={onOpenImportDataTab} type="ghost" size="large" icon={<PlusOutlined />}>
              {t('Import Table')}
            </Button>
          </div>
          <TableList onOpenMetabaseTab={onOpenMetabaseTab} />
        </div>
      </div>
    </div>
  );
};
