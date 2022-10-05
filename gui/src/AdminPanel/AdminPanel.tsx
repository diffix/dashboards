import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { TableListStep } from '../TableListStep';
import { AidSelectionStep } from '../AidSelectionStep';
import { FileLoadStep } from '../FileLoadStep';
import { SchemaLoadStep } from '../SchemaLoadStep';
import { Layout } from '../shared';
import { AdminPanelHelp } from './admin-panel-help';
import { AdminPanelNav, AdminPanelNavProvider } from './admin-panel-nav';

import './AdminPanel.css';

export type AdminPanelProps = {
  isActive: boolean;
};

export const AdminPanel: FunctionComponent<AdminPanelProps> = ({ isActive }) => {
  return (
    <AdminPanelNavProvider isActive={isActive}>
      <Layout className="AdminPanel">
        <Layout.Sidebar className="AdminPanel-sidebar">
          <AdminPanelNav />
          <Divider style={{ margin: '16px 0' }} />
          <AdminPanelHelp />
        </Layout.Sidebar>
        <Layout.Content className="AdminPanel-content">
          <TableListStep>
            {({ invalidateTableList }) => (
              <FileLoadStep>
                {({ file, removeFile }) => (
                  <SchemaLoadStep file={file}>
                    {({ schema }) => (
                      <AidSelectionStep
                        schema={schema}
                        file={file}
                        invalidateTableList={invalidateTableList}
                        removeFile={removeFile}
                      />
                    )}
                  </SchemaLoadStep>
                )}
              </FileLoadStep>
            )}
          </TableListStep>
        </Layout.Content>
      </Layout>
    </AdminPanelNavProvider>
  );
};
