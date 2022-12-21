import { Col, Row } from 'antd';
import React, { FunctionComponent } from 'react';
import { useImmer } from 'use-immer';
import { defaultQuery, QueryBuilder } from './QueryBuilder';
import { QueryPreview } from './QueryPreview';
import { Query } from './types';

import './QueryTab.css';

export type QueryTabProps = {
  initialTable: string | null;
};

export const QueryTab: FunctionComponent<QueryTabProps> = ({ initialTable }) => {
  const [query, updateQuery] = useImmer<Query>(() => defaultQuery(initialTable));

  return (
    <div className="QueryTab">
      <div className="QueryTab-content">
        <Row gutter={[32, 32]}>
          <Col xs={24} lg={12}>
            <QueryBuilder query={query} updateQuery={updateQuery} />
          </Col>
          <Col xs={24} lg={12}>
            <QueryPreview query={query} />
          </Col>
        </Row>
      </div>
    </div>
  );
};
