import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { Layout } from '../shared-react';
import { AidSelectionStep } from './AidSelectionStep';
import { FileLoadStep } from './FileLoadStep';
import { ImportDataHelp } from './import-data-help';
import { ImportDataNav, ImportDataNavProvider } from './import-data-nav';
import { ImportStep } from './ImportStep';
import { SchemaLoadStep } from './SchemaLoadStep';

import './ImportDataTab.css';

export type ImportDataTabProps = {
  isActive: boolean;
  onImportCompleted: () => void;
};

export const ImportDataTab: FunctionComponent<ImportDataTabProps> = ({ isActive, onImportCompleted }) => {
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
            {({ file, parseOptions }) => (
              <SchemaLoadStep file={file} parseOptions={parseOptions}>
                {({ schema }) => (
                  <AidSelectionStep schema={schema}>
                    {({ aidColumns }) => (
                      <ImportStep
                        schema={schema}
                        file={file}
                        parseOptions={parseOptions}
                        aidColumns={aidColumns}
                        onImportCompleted={onImportCompleted}
                      />
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
