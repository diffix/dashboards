import { Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { Trans } from 'react-i18next';
import { DocsLink } from '../DocsTab';
import { TFunc, useT as useBaseT } from '../shared';
import { ImportDataNavStep, useNavState } from './import-data-nav';

const { Paragraph: ParagraphBase, Title } = Typography;

function useT(component: string): TFunc {
  return useBaseT('ImportDataTab::Sidebar::' + component);
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
        <strong>Diffix Dashboards</strong> auto-detects the CSV delimiter, as well as the field type (text and numeric).
        <br />
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
      <Paragraph t={t}>Use the data preview to confirm that the data was loaded correctly.</Paragraph>
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

function ImportHelp() {
  const t = useT('ImportHelp');
  return (
    <div>
      <Title level={4}>{t('Import')}</Title>
      <Paragraph t={t}>Finalize import into the database. TODO: link docs</Paragraph>
    </div>
  );
}

const ImportDataStepHelp = React.memo<{ step: ImportDataNavStep }>(({ step }) => {
  switch (step) {
    case ImportDataNavStep.CsvImport:
      return <CsvImportHelp />;
    case ImportDataNavStep.DataPreview:
      return <DataPreviewHelp />;
    case ImportDataNavStep.AidSelection:
      return <AidSelectionHelp />;
    case ImportDataNavStep.Import:
      return <ImportHelp />;
    default:
      return null;
  }
});

export const ImportDataHelp: React.FunctionComponent = () => {
  const { focusedStep } = useNavState();
  return <ImportDataStepHelp step={focusedStep} />;
};
