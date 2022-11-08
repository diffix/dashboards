import { PlusOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { useT } from '../shared';
import { ServiceName } from '../types';
import { ServiceStatusCard } from './ServiceStatusCard';
import { TableList } from './TableList';

import './AdminTab.css';
import logo from './logo.png';

const { Title } = Typography;

export type AdminTabProps = {
  onOpenMetabaseTab: () => void;
  onOpenmportDataTab: () => void;
};

export const AdminTab: FunctionComponent<AdminTabProps> = ({ onOpenmportDataTab }) => {
  const t = useT('AdminTab');

  const [postgresqlStatus, setPostgresqlStatus] = useState(() => window.getServicesStatus(ServiceName.PostgreSQL));
  const [metabaseStatus, setMetabaseStatus] = useState(() => window.getServicesStatus(ServiceName.Metabase));

  window.onServiceStatusUpdate = (name, status) => {
    switch (name) {
      case ServiceName.PostgreSQL:
        setPostgresqlStatus(status);
        break;
      case ServiceName.Metabase:
        setMetabaseStatus(status);
        break;
    }
  };

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
            <Button onClick={onOpenmportDataTab} type="ghost" size="large" icon={<PlusOutlined />}>
              {t('Import Table')}
            </Button>
          </div>
          <TableList />
        </div>
      </div>
    </div>
  );
};
