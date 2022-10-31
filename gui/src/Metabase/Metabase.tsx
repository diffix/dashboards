import React, { FunctionComponent, useEffect, useRef } from 'react';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';

import './Metabase.css';

export type MetabaseProps = {
  refreshNonce: number;
};

export const Metabase: FunctionComponent<MetabaseProps> = ({ refreshNonce }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const div = wrapperRef.current!;

    const webviewProps = {
      partition: METABASE_SESSION_NAME,
      src: `http://localhost:${METABASE_PORT}`,
      preload: 'file://' + window.METABASE_PRELOAD_WEBPACK_ENTRY,
      webpreferences: 'contextIsolation=false',
    };

    div.innerHTML = `<webview ${Object.entries(webviewProps)
      .map(([key, value]) => `${key}=${JSON.stringify(value.toString())}`)
      .join(' ')} />`;
  }, [refreshNonce]);

  return <div className="Metabase" ref={wrapperRef}></div>;
};
