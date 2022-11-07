import React, { FunctionComponent, useEffect, useRef } from 'react';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';

import './MetabaseTab.css';

export type MetabaseTabProps = {
  refreshNonce: number;
};

export const MetabaseTab: FunctionComponent<MetabaseTabProps> = ({ refreshNonce }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef(() => {});

  useEffect(() => {
    const div = wrapperRef.current!;

    const webviewProps = {
      partition: METABASE_SESSION_NAME,
      src: `http://localhost:${METABASE_PORT}`,
      // preload: 'file://' + window.METABASE_PRELOAD_WEBPACK_ENTRY,
      webpreferences: 'contextIsolation=false',
    };

    div.innerHTML = `<webview ${Object.entries(webviewProps)
      .map(([key, value]) => `${key}=${JSON.stringify(value.toString())}`)
      .join(' ')} />`;

    const webview = div.querySelector('webview');

    webview!.addEventListener('did-attach', () => {
      refreshRef.current = () => (webview as any).reload();
    });
  }, []);

  useEffect(() => {
    if (refreshNonce > 0) {
      refreshRef.current();
    }
  }, [refreshNonce]);

  return <div className="MetabaseTab" ref={wrapperRef}></div>;
};
