import { Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { Trans } from 'react-i18next';
import { DocsLink } from '../Docs';
import { TFunc, useT as useBaseT } from '../shared';
import { NotebookNavStep, useNavState } from './notebook-nav';

const { Paragraph: ParagraphBase, Title } = Typography;

function useT(component: string): TFunc {
  return useBaseT('Sidebar::' + component);
}

export const Paragraph: FunctionComponent<{ t: TFunc }> = ({ t, children }) => {
  return (
    <ParagraphBase>
      <Trans t={t}>{children}</Trans>
    </ParagraphBase>
  );
};

function CsvImportHelp() {
  const t = useT('CsvImportHelp');
  return (
    <div>
      <Title level={4}>{t('CSV Import')}</Title>
      <Paragraph t={t}>
        <strong>BI Diffix</strong> auto-detects the CSV delimiter, as well as the field type (text and numeric).{' '}
        <DocsLink page="anonymization" section="load-table-from-csv">
          Click here for details.
        </DocsLink>
      </Paragraph>
    </div>
  );
}

function DataPreviewHelp() {
  const t = useT('DataPreviewHelp');
  return (
    <div>
      <Title level={4}>{t('Data Preview')}</Title>
      <Paragraph t={t}>Use the data preview to confirm that the data was imported correctly.</Paragraph>
    </div>
  );
}

function AidSelectionHelp() {
  const t = useT('AidSelectionHelp');
  return (
    <div>
      <Title level={4}>{t('ID Selection')}</Title>
      <Paragraph t={t}>
        <strong>WARNING:</strong> If this configuration is not done correctly, the data will not be properly anonymized.
      </Paragraph>
      <Paragraph t={t}>
        If the data has one row per person (or other <em>protected entity</em>), then no entity identifier column need
        be selected. Otherwise, select a column containing a unique ID per protected entity. TODO: link docs
      </Paragraph>
    </div>
  );
}

const NotebookStepHelp = React.memo<{ step: NotebookNavStep }>(({ step }) => {
  switch (step) {
    case NotebookNavStep.CsvImport:
      return <CsvImportHelp />;
    case NotebookNavStep.DataPreview:
      return <DataPreviewHelp />;
    case NotebookNavStep.AidSelection:
      return <AidSelectionHelp />;
    default:
      return null;
  }
});

export const NotebookHelp: React.FunctionComponent = () => {
  const { focusedStep } = useNavState();
  return <NotebookStepHelp step={focusedStep} />;
};
