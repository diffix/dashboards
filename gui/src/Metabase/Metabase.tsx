import React, { FunctionComponent, useEffect, useRef } from 'react';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';

import './Metabase.css';

export type MetabaseProps = {
  refresh: boolean;
  afterRefresh: () => void;
};

export const Metabase: FunctionComponent<MetabaseProps> = ({ refresh, afterRefresh }) => {
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

    const webview = div.querySelector('webview');

    webview!.addEventListener('dom-ready', () => {
      if (refresh) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (webview as any).reload();
        afterRefresh();
      }
    });
  }, [refresh]);

  return <div className="Metabase" ref={wrapperRef}></div>;
};
