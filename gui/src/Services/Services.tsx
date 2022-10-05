import { Divider, Typography, Space } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import React, { FunctionComponent } from 'react';
import { ServiceStatus } from '../types';
import { useT } from '../shared';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';

import './Services.css';

const { Title } = Typography;

export type ServicesProps = {
  postgresql: ServiceStatus;
  metabase: ServiceStatus;
  children: React.ReactNode;
};

function statusToIcon(status: ServiceStatus) {
  switch (status) {
    case ServiceStatus.Starting:
      return <SyncOutlined spin className="Services-starting" />;
    case ServiceStatus.Running:
      return <CheckCircleOutlined className="Services-running" />;
    case ServiceStatus.Stopped:
      return <CloseCircleOutlined className="Services-stopped" />;
  }
}

export const Services: FunctionComponent<ServicesProps> = ({ postgresql, metabase, children }) => {
  const t = useT('AdminPanel');
  return (
    <>
      <div className="Services admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.Services} status="done" />
        <Title level={3}>{t('Services')}</Title>
        <Space size="large">
          <Space>
            {statusToIcon(postgresql)}
            <Title level={4}>PostgreSQL</Title>
          </Space>
          {postgresql !== ServiceStatus.Starting && (
            <>
              <Space>
                {statusToIcon(metabase)}
                <Title level={4}>Metabase</Title>
              </Space>
            </>
          )}
        </Space>
      </div>
      {/* Render next step */}
      {metabase !== ServiceStatus.Starting && (
        <>
          <Divider />
          {children}
        </>
      )}
    </>
  );
};
