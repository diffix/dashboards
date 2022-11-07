import { ReloadOutlined } from '@ant-design/icons';
import { ConfigProvider, message, Tabs, Tooltip } from 'antd';
import deDE from 'antd/es/locale/de_DE';
import enUS from 'antd/es/locale/en_US';
import { find, findIndex } from 'lodash';
import React, { FunctionComponent, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import { useImmer } from 'use-immer';
import { AdminTab } from '../AdminTab';
import { DocsFunctionsContext, DocsTab, PageId } from '../DocsTab';
import { ImportDataTab } from '../ImportDataTab';
import { MetabaseTab } from '../MetabaseTab';
import { getT, TFunc, useStaticValue, useT } from '../shared';
import { useCheckUpdates } from './use-check-updates';

import './App.css';

const { TabPane } = Tabs;

type CommonTabData = {
  id: string;
  title: string;
};

type AdminTabData = CommonTabData & {
  type: 'admin';
};

type ImportDataTabData = CommonTabData & {
  type: 'import';
};

type MetabaseTabData = CommonTabData & {
  type: 'metabase';
  stale: boolean;
  refreshNonce: number;
};

type DocsTabData = CommonTabData & {
  type: 'docs';
  page: PageId;
  section: string | null;
  scrollInvalidator: number; // Triggers a scroll when changed
};

type TabData = AdminTabData | ImportDataTabData | MetabaseTabData | DocsTabData;

type AppState = {
  tabs: TabData[];
  activeTab: string;
};

let nextTabId = 1;

function newAdminTab(t: TFunc): TabData {
  return { id: (nextTabId++).toString(), title: t('Admin Panel'), type: 'admin' };
}

function newImportDataTab(t: TFunc): TabData {
  return {
    id: (nextTabId++).toString(),
    title: t('Import Data'),
    type: 'import',
  };
}

function newMetabaseTab(t: TFunc): TabData {
  return {
    id: (nextTabId++).toString(),
    title: t('Metabase'),
    type: 'metabase',
    stale: false,
    refreshNonce: 0,
  };
}

function newDocsTab(page: PageId, section: string | null, t: TFunc): TabData {
  return {
    id: (nextTabId++).toString(),
    title: t('Documentation'),
    type: 'docs',
    page,
    section,
    scrollInvalidator: 0,
  };
}

function setWindowTitle(state: AppState) {
  const t = getT('App');
  const tab = find(state.tabs, { id: state.activeTab });
  if (tab) {
    window.setMainWindowTitle(tab.title + ' - ' + t('Diffix Dashboards'));
  } else {
    window.setMainWindowTitle(t('Diffix Dashboards'));
  }
}

export const App: FunctionComponent = () => {
  const t = useT('App');
  const [state, updateState] = useImmer(() => {
    const initialTabs = [newAdminTab(t)];
    return {
      tabs: initialTabs,
      activeTab: initialTabs[0].id,
    };
  });

  useCheckUpdates();

  function onEdit(targetKey: unknown, action: 'add' | 'remove'): void {
    switch (action) {
      case 'add':
        updateState((state) => {
          const metabaseTab = newMetabaseTab(t);
          state.tabs.push(metabaseTab);
          state.activeTab = metabaseTab.id;
          setWindowTitle(state);
        });
        return;

      case 'remove':
        updateState((state) => {
          const { tabs } = state;
          const id = targetKey as string;
          const index = findIndex(tabs, { id });
          if (index < 0) return;

          tabs.splice(index, 1);
          if (id === state.activeTab && tabs.length !== 0) {
            state.activeTab = tabs[Math.min(index, tabs.length - 1)].id;
          }
          setWindowTitle(state);
        });
        return;
    }
  }

  function openMetabaseTab() {
    updateState((state) => {
      const metabaseTab = newMetabaseTab(t);
      state.tabs.push(metabaseTab);
      state.activeTab = metabaseTab.id;
      setWindowTitle(state);
    });
  }

  function openImportDataTab() {
    updateState((state) => {
      const importDataTab = newImportDataTab(t);
      state.tabs.push(importDataTab);
      state.activeTab = importDataTab.id;
      setWindowTitle(state);
    });
  }

  function setActiveTab(id: string) {
    updateState((state) => {
      state.activeTab = id;
      setWindowTitle(state);
    });
  }

  function setTitle(id: string, title: string) {
    updateState((state) => {
      const tab = find(state.tabs, { id });
      if (tab) {
        tab.title = title;
      }
      setWindowTitle(state);
    });
  }

  function refreshTab(id: string) {
    updateState((state) => {
      const tab = find(state.tabs, { id }) as MetabaseTabData;
      tab.stale = false;
      tab.refreshNonce++;
    });
  }

  const docsFunctions = useStaticValue(() => ({
    openDocs(page: PageId, section: string | null = null) {
      updateState((state) => {
        const existingTab = state.tabs.find((t) => t.type === 'docs') as DocsTabData | undefined;
        if (existingTab) {
          existingTab.page = page;
          existingTab.section = section;
          existingTab.scrollInvalidator++;
          state.activeTab = existingTab.id;
        } else {
          const newTab = newDocsTab(page, section, t);
          state.tabs.push(newTab);
          state.activeTab = newTab.id;
        }
        setWindowTitle(state);
      });
    },
  }));

  window.onOpenDocs = (page) => docsFunctions.openDocs(page);
  window.showMessage = (content) => message.success(content, 10);

  const { tabs, activeTab } = state;

  useEffect(() => {
    function makeMetabaseTabsStale() {
      updateState((state) => {
        state.tabs.forEach((tab) => {
          if (tab.type == 'metabase') tab.stale = true;
        });
      });
    }

    function subscribe() {
      window.metabaseEvents.on('refresh', makeMetabaseTabsStale);
    }

    function unsubscribe() {
      window.metabaseEvents.off('refresh', makeMetabaseTabsStale);
    }

    subscribe();

    return () => {
      unsubscribe();
    };
  }, [updateState]);

  return (
    <ConfigProvider locale={window.i18n.language === 'de' ? deDE : enUS}>
      <DocsFunctionsContext.Provider value={docsFunctions}>
        <div className="App">
          <Tabs type="editable-card" activeKey={activeTab} onChange={setActiveTab} onEdit={onEdit}>
            {tabs.map((tab) => (
              <TabPane
                tab={
                  tab.type === 'metabase' && tab.stale ? (
                    <span>
                      {tab.title}
                      <Tooltip
                        title={t('Refresh to reveal newly imported tables (currently running queries will abort)')}
                      >
                        <ReloadOutlined className="App-tab-pane-icon" onClick={() => refreshTab(tab.id)} />
                      </Tooltip>
                    </span>
                  ) : (
                    tab.title
                  )
                }
                key={tab.id}
                closable={tab.type !== 'admin'}
              >
                {tab.type === 'admin' ? (
                  <AdminTab onOpenMetabaseTab={openMetabaseTab} onOpenmportDataTab={openImportDataTab} />
                ) : tab.type === 'import' ? (
                  <ImportDataTab isActive={tab.id === activeTab} />
                ) : tab.type === 'metabase' ? (
                  <MetabaseTab refreshNonce={tab.refreshNonce} />
                ) : (
                  <DocsTab
                    onTitleChange={(title) => setTitle(tab.id, title)}
                    page={tab.page}
                    onPageChange={(page) =>
                      updateState((state) => {
                        const docsTab = find(state.tabs, { id: tab.id }) as DocsTabData;
                        docsTab.page = page;
                        docsTab.section = null;
                        docsTab.scrollInvalidator++;
                      })
                    }
                    section={tab.section}
                    scrollInvalidator={tab.scrollInvalidator}
                  />
                )}
              </TabPane>
            ))}
          </Tabs>
        </div>
      </DocsFunctionsContext.Provider>
    </ConfigProvider>
  );
};

export function render(): void {
  ReactDOM.render(
    <I18nextProvider i18n={window.i18n}>
      <App />
    </I18nextProvider>,
    document.getElementById('root'),
  );
}
