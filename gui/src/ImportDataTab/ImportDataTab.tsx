import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { Layout } from '../shared';
import { AidSelectionStep } from './AidSelectionStep';
import { FileLoadStep } from './FileLoadStep';
import { ImportDataHelp } from './import-data-help';
import { ImportDataNav, ImportDataNavProvider } from './import-data-nav';
import { ImportStep } from './ImportStep';
import { SchemaLoadStep } from './SchemaLoadStep';

import './ImportDataTab.css';

export type ImportDataTabProps = {
  isActive: boolean;
};

export const ImportDataTab: FunctionComponent<ImportDataTabProps> = ({ isActive }) => {
  return (
    <ImportDataNavProvider isActive={isActive}>
      <Layout className="ImportDataTab">
        <Layout.Sidebar className="ImportDataTab-sidebar">
          <ImportDataNav />
          <Divider style={{ margin: '16px 0' }} />
          <ImportDataHelp />
        </Layout.Sidebar>
        <Layout.Content className="ImportDataTab-content">
          <FileLoadStep>
            {({ file, removeFile }) => (
              <SchemaLoadStep file={file}>
                {({ schema }) => (
                  <AidSelectionStep schema={schema}>
                    {({ aidColumns }) => (
                      <ImportStep schema={schema} file={file} aidColumns={aidColumns} removeFile={removeFile} />
                    )}
                  </AidSelectionStep>
                )}
              </SchemaLoadStep>
            )}
          </FileLoadStep>
        </Layout.Content>
      </Layout>
    </ImportDataNavProvider>
  );
};
