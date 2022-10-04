import { Typography } from 'antd';
import React, { FunctionComponent } from 'react';
import { Trans } from 'react-i18next';
import { DocsLink } from '../Docs';
import { TFunc, useT as useBaseT } from '../shared';
import { AdminPanelNavStep, useNavState } from './admin-panel-nav';

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

function TableListHelp() {
  const t = useT('TableListHelp');
  return (
    <div>
      <Title level={4}>{t('Table list')}</Title>
      <Paragraph t={t}>
        Inspect and manage the imported tables.{' '}
        <DocsLink page="anonymization" section="load-table-from-csv">
          Click here for details.
        </DocsLink>
      </Paragraph>
    </div>
  );
}

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

const AdminPanelStepHelp = React.memo<{ step: AdminPanelNavStep }>(({ step }) => {
  switch (step) {
    case AdminPanelNavStep.TableList:
      return <TableListHelp />;
    case AdminPanelNavStep.CsvImport:
      return <CsvImportHelp />;
    case AdminPanelNavStep.DataPreview:
      return <DataPreviewHelp />;
    case AdminPanelNavStep.AidSelection:
      return <AidSelectionHelp />;
    default:
      return null;
  }
});

export const AdminPanelHelp: React.FunctionComponent = () => {
  const { focusedStep } = useNavState();
  return <AdminPanelStepHelp step={focusedStep} />;
};
