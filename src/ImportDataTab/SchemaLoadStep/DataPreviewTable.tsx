import React, { FunctionComponent } from 'react';
import { Typography } from 'antd';
import { columnSorter } from '../../shared';
import { ResponsiveTable } from '../../shared-react';
import { TableSchema, Value } from '../../types';

const { Text } = Typography;

export type DataPreviewTableProps = {
  schema: TableSchema;
};

export const DataPreviewTable: FunctionComponent<DataPreviewTableProps> = ({ schema }) => {
  const columns = schema.columns.map((col, i) => ({
    title: () => (
      <>
        {col.name}{' '}
        <Text type="secondary" italic={true}>
          ({col.type})
        </Text>
      </>
    ),
    dataIndex: i.toString(),
    sorter: columnSorter(col.type, i),
    ellipsis: true,
  }));

  const rows = schema.rowsPreview.map((row, i) => ({
    key: i,
    ...(row as Record<number, Value>),
  }));

  return (
    <div className="DataPreviewTable">
      <ResponsiveTable columns={columns} dataSource={rows} />
    </div>
  );
};
