import { PlusOutlined } from '@ant-design/icons';
import { Button, message, Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { useT } from '../shared-react';
import { TOAST_DURATION } from '../shared/constants';
import { useMetabaseStatus, usePostgresqlStatus } from '../state';
import { ServiceStatus } from '../types';
import { ServiceStatusCard } from './ServiceStatusCard';
import { TableList } from './TableList';

import './AdminTab.css';
import logo from './logo.png';

const { Title } = Typography;

export type AdminTabProps = {
  showMetabaseHint: boolean;
  onOpenMetabaseTab: (initialPath?: string) => void;
  onOpenImportDataTab: () => void;
};

export const AdminTab: FunctionComponent<AdminTabProps> = ({
  showMetabaseHint,
  onOpenMetabaseTab,
  onOpenImportDataTab,
}) => {
  const t = useT('AdminTab');
  const postgresqlStatus = usePostgresqlStatus();
  const metabaseStatus = useMetabaseStatus();

  function openImportDataTab() {
    if (postgresqlStatus !== ServiceStatus.Running) {
      message.warning({
        content: t('PostgreSQL database is not yet ready'),
        duration: TOAST_DURATION,
      });
      return;
    }

    onOpenImportDataTab();
  }

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
            <Button onClick={openImportDataTab} type="primary" size="large" icon={<PlusOutlined />}>
              {t('Import Table')}
            </Button>
          </div>
          <TableList onOpenMetabaseTab={onOpenMetabaseTab} showMetabaseHint={showMetabaseHint} />
        </div>
      </div>
    </div>
  );
};
