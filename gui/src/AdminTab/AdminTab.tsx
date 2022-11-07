import { PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { useT } from '../shared';
import { ServiceName } from '../types';
import { ServiceStatusCard } from './ServiceStatusCard';
import { TableList } from './TableList';

import './AdminTab.css';

export type AdminTabProps = {
  onOpenMetabaseTab: () => void;
  onOpenmportDataTab: () => void;
};

export const AdminTab: FunctionComponent<AdminTabProps> = ({ onOpenMetabaseTab, onOpenmportDataTab }) => {
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
          <Button onClick={onOpenMetabaseTab} type="primary" size="large">
            {t('New Metabase Tab')}
          </Button>
          <div className="AdminTab-services">
            <ServiceStatusCard status={postgresqlStatus}>PostgreSQL</ServiceStatusCard>
            <ServiceStatusCard status={metabaseStatus}>Metabase</ServiceStatusCard>
          </div>
        </div>
        <div className="AdminTab-tables">
          <TableList />
          <Button onClick={onOpenmportDataTab} size="large" icon={<PlusOutlined />}>
            {t('Import Table')}
          </Button>
        </div>
      </div>
    </div>
  );
};
