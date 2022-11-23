/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { FunctionComponent, useEffect, useRef } from 'react';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';

import './MetabaseTab.css';

/*
 * Metabase uses styled components, which means class names are obscure hashes.
 * These may (and will) change without notice, so we must manually inspect
 * the rendered DOM whenever we want to update the shipped Metabase version.
 */
const CUSTOM_CSS = `
  /* User menu actions */
  .css-1hoi0fz.ep9pi9w0 > ol > li > a[data-metabase-event="Navbar;Profile Dropdown;Enter Admin"],
  .css-1hoi0fz.ep9pi9w0 > ol > li > a[data-metabase-event="Navbar;Profile Dropdown;About v0.44.6"],
  .css-1hoi0fz.ep9pi9w0 > ol > li > div[data-metabase-event="Navbar;Profile Dropdown;Logout"] {
    display: none;
  }

  /* New Question button */
  .css-1hoi0fz.ep9pi9w0 > ol > li > a[data-metabase-event="NavBar;New Question Click;"] {
    display: none;
  }

  /* Sidebar Data section */
  aside > nav > .css-1agdudp.exp4uno11 > div > :nth-child(3) {
    display: none;
  }
`;

export type MetabaseTabProps = {
  refreshNonce: number;
  startUrlPath: string;
};

export const MetabaseTab: FunctionComponent<MetabaseTabProps> = ({ refreshNonce, startUrlPath }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef(() => {});

  useEffect(() => {
    const div = wrapperRef.current!;

    const webviewProps = {
      partition: METABASE_SESSION_NAME,
      src: `http://localhost:${METABASE_PORT}/${startUrlPath}`,
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

    webview!.addEventListener('dom-ready', () => {
      (webview as any).insertCSS(CUSTOM_CSS);
    });
  }, [startUrlPath]);

  useEffect(() => {
    if (refreshNonce > 0) {
      refreshRef.current();
    }
  }, [refreshNonce]);

  return <div className="MetabaseTab" ref={wrapperRef}></div>;
};
