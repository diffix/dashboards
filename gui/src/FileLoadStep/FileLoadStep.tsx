import { FileDoneOutlined, FileOutlined } from '@ant-design/icons';
import { Divider, Typography, Upload } from 'antd';
import React, { FunctionComponent, useCallback, useState } from 'react';
import { AdminPanelNavAnchor, AdminPanelNavStep } from '../AdminPanel';
import { useT } from '../shared';
import { File } from '../types';

const { Dragger } = Upload;
const { Title } = Typography;

export type FileLoadStepProps = {
  children: (data: FileLoadStepData) => React.ReactNode;
};

export type FileLoadStepData = {
  file: File;
  removeFile: () => void;
};

export const FileLoadStep: FunctionComponent<FileLoadStepProps> = ({ children }) => {
  const t = useT('FileLoadStep');
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
      <div className="FileLoadStep admin-panel-step">
        <AdminPanelNavAnchor step={AdminPanelNavStep.CsvImport} status={file ? 'done' : 'active'} />
        <Title level={3}>{t('Import table')}</Title>
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
          <p className="ant-upload-text">{t('From CSV file')}</p>
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
