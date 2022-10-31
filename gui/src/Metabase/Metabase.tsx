import React, { FunctionComponent, useEffect, useRef } from 'react';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';

import './Metabase.css';

export const Metabase: FunctionComponent = () => {
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

    function handleRefresh() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webview as any).reload();
    }

    function subscribe() {
      window.metabaseEvents.on('refresh', handleRefresh);
    }

    function unsubscribe() {
      window.metabaseEvents.off('refresh', handleRefresh);
    }

    webview!.addEventListener('dom-ready', () => {
      // Make sure to listen only once because `dom-ready` can be raised multiple times.
      unsubscribe();
      subscribe();
      // Uncomment for dev tools. Opens in a new window and can get annoying fast...
      // (webview as any).openDevTools();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <div className="Metabase" ref={wrapperRef}></div>;
};
