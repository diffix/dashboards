import { Affix, Col, Row } from 'antd';
import React, { FunctionComponent, useRef } from 'react';
import { useImmer } from 'use-immer';
import { defaultQuery, QueryBuilder } from './QueryBuilder';
import { QueryPreview } from './QueryPreview';
import { Query } from './types';

import './QueryTab.css';

export type QueryTabProps = {
  initialTable: string | null;
  onOpenMetabaseTab: (initialPath?: string) => void;
};

export const QueryTab: FunctionComponent<QueryTabProps> = ({ initialTable, onOpenMetabaseTab }) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const [query, updateQuery] = useImmer<Query>(() => defaultQuery(initialTable));

  return (
    <div className="QueryTab" ref={tabRef}>
      <div className="QueryTab-content">
        <Row gutter={[32, 32]}>
          <Col xs={24} lg={12}>
            <QueryBuilder query={query} updateQuery={updateQuery} />
          </Col>
          <Col xs={24} lg={12}>
            <Affix target={() => tabRef.current}>
              <QueryPreview query={query} onOpenMetabaseTab={onOpenMetabaseTab} />
            </Affix>
          </Col>
        </Row>
      </div>
    </div>
  );
};
