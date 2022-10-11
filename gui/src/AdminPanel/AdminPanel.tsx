import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { Services } from '../Services';
import { TableListStep } from '../TableListStep';
import { AidSelectionStep } from '../AidSelectionStep';
import { FileLoadStep } from '../FileLoadStep';
import { ImportStep } from '../ImportStep';
import { SchemaLoadStep } from '../SchemaLoadStep';
import { Layout } from '../shared';
import { ServiceStatus } from '../types';
import { AdminPanelHelp } from './admin-panel-help';
import { AdminPanelNav, AdminPanelNavProvider } from './admin-panel-nav';

import './AdminPanel.css';

export type AdminPanelProps = {
  isActive: boolean;
  postgresql: ServiceStatus;
  metabase: ServiceStatus;
};

export const AdminPanel: FunctionComponent<AdminPanelProps> = ({ isActive, postgresql, metabase }) => {
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
            <TableListStep>
              {({ tableList, invalidateTableList }) => (
                <FileLoadStep>
                  {({ file, removeFile }) => (
                    <SchemaLoadStep file={file}>
                      {({ schema }) => (
                        <AidSelectionStep schema={schema}>
                          {({ aidColumns }) => (
                            <ImportStep
                              tableList={tableList}
                              schema={schema}
                              file={file}
                              aidColumns={aidColumns}
                              invalidateTableList={invalidateTableList}
                              removeFile={removeFile}
                            />
                          )}
                        </AidSelectionStep>
                      )}
                    </SchemaLoadStep>
                  )}
                </FileLoadStep>
              )}
            </TableListStep>
          </Services>
        </Layout.Content>
      </Layout>
    </AdminPanelNavProvider>
  );
};
