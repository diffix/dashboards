import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import React, { FunctionComponent } from 'react';
import { ServiceStatus } from '../types';

import './ServiceStatusCard.css';

function statusToIcon(status: ServiceStatus) {
  switch (status) {
    case ServiceStatus.Starting:
      return <SyncOutlined spin className="ServiceStatusCard-icon ServiceStatusCard-icon-starting" />;
    case ServiceStatus.Running:
      return <CheckCircleOutlined className="ServiceStatusCard-icon ServiceStatusCard-icon-running" />;
    case ServiceStatus.Stopped:
      return <CloseCircleOutlined className="ServiceStatusCard-icon ServiceStatusCard-icon-stopped" />;
  }
}

export type ServiceStatusCardProps = {
  status: ServiceStatus;
};

export const ServiceStatusCard: FunctionComponent<ServiceStatusCardProps> = ({ status, children }) => {
  return (
    <div className="ServiceStatusCard">
      {statusToIcon(status)}
      {children}
    </div>
  );
};
