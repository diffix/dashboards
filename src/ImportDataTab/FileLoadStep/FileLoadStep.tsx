import { FileDoneOutlined, FileOutlined } from '@ant-design/icons';
import { Divider, Radio, RadioChangeEvent, Typography, Upload } from 'antd';
import React, { FunctionComponent, useCallback, useMemo, useState } from 'react';
import { useT } from '../../shared-react';
import { File, NumberFormat, ParseOptions } from '../../types';
import { ImportDataNavAnchor, ImportDataNavStep } from '../import-data-nav';

const { Dragger } = Upload;
const { Text, Title } = Typography;

export type FileLoadStepProps = {
  children: (data: FileLoadStepData) => React.ReactNode;
};

export type FileLoadStepData = {
  file: File;
  parseOptions: ParseOptions;
  removeFile: () => void;
};

export const FileLoadStep: FunctionComponent<FileLoadStepProps> = ({ children }) => {
  const t = useT('ImportDataTab::FileLoadStep');
  const [file, setFile] = useState<File | null>(null);
  const [numberFormat, setNumberFormat] = useState(
    window.i18n.language === 'en' ? NumberFormat.English : NumberFormat.German,
  );
  const [lastCompletedImport, setLastCompletedImport] = useState('');
  const removeFile = useCallback(() => {
    file && setLastCompletedImport(file.name);
    setFile(null);
  }, [file]);

  const parseOptions = useMemo(() => ({ numberFormat }), [numberFormat]);

  const dragPromptText = lastCompletedImport
    ? t('{{lastCompletedImport}} imported successfully. Click or drag another file to this area', {
        lastCompletedImport,
      })
    : t('Click or drag a file to this area');

  return (
    <>
      <div className="FileLoadStep import-data-step">
        <ImportDataNavAnchor step={ImportDataNavStep.CsvImport} status={file ? 'done' : 'active'} />
        <Title level={3}>{t('{{stepNumber}}. Select a CSV file', { stepNumber: 1 })}</Title>
        <Dragger
          accept=".csv,.tsv,.txt"
          fileList={[]}
          beforeUpload={(file) => {
            // Uploader is mid state update. We push the op to next frame to avoid react warning.
            setTimeout(() => {
              setFile(file);
            }, 0);
            return false;
          }}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">{lastCompletedImport ? <FileDoneOutlined /> : <FileOutlined />}</p>
          {file ? <p className="ant-upload-text">{file.name}</p> : undefined}
          <p className="ant-upload-hint">{dragPromptText}</p>
        </Dragger>
        <br />
        <div>
          <Text>{t('Number format:')}</Text>{' '}
          <Radio.Group
            size="small"
            value={numberFormat}
            onChange={(e: RadioChangeEvent) => {
              setNumberFormat(e.target.value);
            }}
          >
            <Radio.Button value={NumberFormat.English}>{t('English')}</Radio.Button>
            <Radio.Button value={NumberFormat.German}>{t('German')}</Radio.Button>
          </Radio.Group>
        </div>
      </div>
      {/* Render next step */}
      {file && (
        <>
          <Divider />
          {children({ file, parseOptions, removeFile })}
        </>
      )}
    </>
  );
};
