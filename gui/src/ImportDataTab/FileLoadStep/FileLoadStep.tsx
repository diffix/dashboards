import { FileDoneOutlined, FileOutlined } from '@ant-design/icons';
import { Divider, Upload } from 'antd';
import React, { FunctionComponent, useCallback, useState } from 'react';
import { useT } from '../../shared';
import { File } from '../../types';
import { ImportDataNavAnchor, ImportDataNavStep } from '../import-data-nav';

const { Dragger } = Upload;

export type FileLoadStepProps = {
  children: (data: FileLoadStepData) => React.ReactNode;
};

export type FileLoadStepData = {
  file: File;
  removeFile: () => void;
};

export const FileLoadStep: FunctionComponent<FileLoadStepProps> = ({ children }) => {
  const t = useT('ImportDataTab::FileLoadStep');
  const [file, setFile] = useState<File | null>(null);
  const [lastCompletedImport, setLastCompletedImport] = useState('');
  const removeFile = useCallback(() => {
    file && setLastCompletedImport(file.name);
    setFile(null);
  }, [file]);

  const dragPromptText = lastCompletedImport
    ? t('{{lastCompletedImport}} imported successfully. Click or drag another file to this area', {
        lastCompletedImport,
      })
    : t('Click or drag a file to this area');

  return (
    <>
      <div className="FileLoadStep import-data-step">
        <ImportDataNavAnchor step={ImportDataNavStep.CsvImport} status={file ? 'done' : 'active'} />
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
          <p className="ant-upload-text">{t('Select CSV file')}</p>
          <p className="ant-upload-hint">{dragPromptText}</p>
        </Dragger>
      </div>
      {/* Render next step */}
      {file && (
        <>
          <Divider />
          {children({ file, removeFile })}
        </>
      )}
    </>
  );
};
