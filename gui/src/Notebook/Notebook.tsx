import { Divider } from 'antd';
import React, { FunctionComponent } from 'react';
import { AidSelectionStep } from '../AidSelectionStep';
import { FileLoadStep } from '../FileLoadStep';
import { SchemaLoadStep } from '../SchemaLoadStep';
import { useT, Layout } from '../shared';
import { NotebookHelp } from './notebook-help';
import { NotebookNav, NotebookNavProvider } from './notebook-nav';

import './Notebook.css';

export type NotebookProps = {
  isActive: boolean;
  onTitleChange: (title: string) => void;
};

export const Notebook: FunctionComponent<NotebookProps> = ({ isActive, onTitleChange }) => {
  const t = useT('Notebook');
  return (
    <NotebookNavProvider isActive={isActive}>
      <Layout className="Notebook">
        <Layout.Sidebar className="Notebook-sidebar">
          <NotebookNav />
          <Divider style={{ margin: '16px 0' }} />
          <NotebookHelp />
        </Layout.Sidebar>
        <Layout.Content className="Notebook-content">
          <FileLoadStep onLoad={(file) => onTitleChange(t('Importing') + ' ' + file.name)}>
            {({ file }) => (
              <SchemaLoadStep file={file}>
                {({ schema }) => <AidSelectionStep schema={schema} file={file} />}
              </SchemaLoadStep>
            )}
          </FileLoadStep>
        </Layout.Content>
      </Layout>
    </NotebookNavProvider>
  );
};
