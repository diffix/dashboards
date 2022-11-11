import { Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { Trans } from 'react-i18next';
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
      <Title level={4}>{t('Select File')}</Title>
      <Paragraph t={t}>
        <strong>Diffix Dashboards</strong> auto-detects the CSV delimiter, as well as the field type (text, numeric and
        timestamp).
        <br />
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
      <Title level={4}>{t('Protected Entity')}</Title>
      <Paragraph t={t}>
        <strong>WARNING:</strong> If this configuration is not done correctly, the data will not be properly anonymized.
      </Paragraph>
      <Paragraph t={t}>
        If the data has one row per person (or other <em>protected entity</em>), then no entity identifier column need
        be selected. Otherwise, select a column containing a unique ID per protected entity.
      </Paragraph>
      <Paragraph t={t}>
        If the data is not associated with any protected entities, it can be imported into a public table. Such data
        will not be anonymized.
      </Paragraph>
    </div>
  );
}

function ImportHelp() {
  const t = useT('ImportHelp');
  return (
    <div>
      <Title level={4}>{t('Table Name')}</Title>
      <Paragraph t={t}>Select a name for the imported table.</Paragraph>
      <Paragraph t={t}>
        <strong>Diffix Dashboards</strong> will propose a name based on the CSV file name, adjusting it to match the
        requirements of the underlying database. You may override the proposed name.
      </Paragraph>
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
