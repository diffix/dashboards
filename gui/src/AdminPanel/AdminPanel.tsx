import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { Services } from '../Services';
import { AidSelectionStep } from '../AidSelectionStep';
import { FileLoadStep } from '../FileLoadStep';
import { SchemaLoadStep } from '../SchemaLoadStep';
import { useT, Layout } from '../shared';
import { ServiceStatus } from '../types';
import { AdminPanelHelp } from './admin-panel-help';
import { AdminPanelNav, AdminPanelNavProvider } from './admin-panel-nav';

import './AdminPanel.css';

export type AdminPanelProps = {
  isActive: boolean;
  onTitleChange: (title: string) => void;
  postgresql: ServiceStatus;
  metabase: ServiceStatus;
};

export const AdminPanel: FunctionComponent<AdminPanelProps> = ({ isActive, onTitleChange, postgresql, metabase }) => {
  const t = useT('AdminPanel');
  return (
    <AdminPanelNavProvider isActive={isActive}>
      <Layout className="AdminPanel">
        <Layout.Sidebar className="AdminPanel-sidebar">
          <AdminPanelNav />
          <Divider style={{ margin: '16px 0' }} />
          <AdminPanelHelp />
        </Layout.Sidebar>
        <Layout.Content className="AdminPanel-content">
          <Services postgresql={postgresql} metabase={metabase}>
            <FileLoadStep onLoad={(file) => onTitleChange(t('Importing') + ' ' + file.name)}>
              {({ file }) => (
                <SchemaLoadStep file={file}>
                  {({ schema }) => <AidSelectionStep schema={schema} file={file} />}
                </SchemaLoadStep>
              )}
            </FileLoadStep>
          </Services>
        </Layout.Content>
      </Layout>
    </AdminPanelNavProvider>
  );
};
