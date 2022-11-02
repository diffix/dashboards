import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { Space, Typography } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { useT } from '../shared';
import { ServiceName, ServiceStatus } from '../types';
import { TableList } from './TableList';

import './AdminTab.css';

const { Title } = Typography;

function statusToIcon(status: ServiceStatus) {
  switch (status) {
    case ServiceStatus.Starting:
      return <SyncOutlined spin className="AdminTab-service AdminTab-service-starting" />;
    case ServiceStatus.Running:
      return <CheckCircleOutlined className="AdminTab-service AdminTab-service-running" />;
    case ServiceStatus.Stopped:
      return <CloseCircleOutlined className="AdminTab-service AdminTab-service-stopped" />;
  }
}

export const AdminTab: FunctionComponent = () => {
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
      <Title level={3}>{t('Services')}</Title>
      <Space size="large">
        <Space>
          {statusToIcon(postgresqlStatus)}
          <Title level={4}>PostgreSQL</Title>
        </Space>
        <Space>
          {statusToIcon(metabaseStatus)}
          <Title level={4}>Metabase</Title>
        </Space>
      </Space>
      <TableList />
    </div>
  );
};
