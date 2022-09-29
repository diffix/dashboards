import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { AidSelectionStep } from '../AidSelectionStep';
import { FileLoadStep } from '../FileLoadStep';
import { SchemaLoadStep } from '../SchemaLoadStep';
import { useT, Layout } from '../shared';
import { AdminPanelHelp } from './admin-panel-help';
import { AdminPanelNav, AdminPanelNavProvider } from './admin-panel-nav';

import './AdminPanel.css';

export type AdminPanelProps = {
  isActive: boolean;
  onTitleChange: (title: string) => void;
};

export const AdminPanel: FunctionComponent<AdminPanelProps> = ({ isActive, onTitleChange }) => {
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
          <FileLoadStep onLoad={(file) => onTitleChange(t('Importing') + ' ' + file.name)}>
            {({ file }) => (
              <SchemaLoadStep file={file}>
                {({ schema }) => <AidSelectionStep schema={schema} file={file} />}
              </SchemaLoadStep>
            )}
          </FileLoadStep>
        </Layout.Content>
      </Layout>
    </AdminPanelNavProvider>
  );
};
