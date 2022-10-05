import { ConfigProvider, Tabs } from 'antd';
import deDE from 'antd/es/locale/de_DE';
import enUS from 'antd/es/locale/en_US';
import { find, findIndex } from 'lodash';
import React, { FunctionComponent } from 'react';
import ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import { useImmer } from 'use-immer';
import { Docs, DocsFunctionsContext, PageId } from '../Docs';
import { AdminPanel } from '../AdminPanel';
import { importer, ImporterContext, getT, TFunc, useStaticValue, useT } from '../shared';
import { useCheckUpdates } from './use-check-updates';
import { ServiceName, ServiceStatus } from '../types';

import './App.css';

const { TabPane } = Tabs;

type CommonTabData = {
  id: string;
  title: string;
};

type AdminPanelTab = CommonTabData & {
  type: 'adminPanel';
};

type DocsTab = CommonTabData & {
  type: 'docs';
  page: PageId;
  section: string | null;
  scrollInvalidator: number; // Triggers a scroll when changed
};

type TabInfo = AdminPanelTab | DocsTab;

type AppState = {
  tabs: TabInfo[];
  activeTab: string;
  postgresql: ServiceStatus;
  metabase: ServiceStatus;
};

let nextTabId = 1;

function openAdminPanelTab(t: TFunc): TabInfo {
  return { id: (nextTabId++).toString(), title: t('Admin Panel'), type: 'adminPanel' };
}

function newDocsTab(page: PageId, section: string | null, t: TFunc): TabInfo {
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
    window.setMainWindowTitle(tab.title + ' - ' + t('BI Diffix'));
  } else {
    window.setMainWindowTitle(t('BI Diffix'));
  }
}

export const App: FunctionComponent = () => {
  const t = useT('App');
  const [state, updateState] = useImmer(() => {
    const initialTab = openAdminPanelTab(t);
    return {
      tabs: [initialTab],
      activeTab: initialTab.id,
      postgresql: ServiceStatus.Starting,
      metabase: ServiceStatus.Starting,
    };
  });

  useCheckUpdates();

  function onEdit(targetKey: unknown, action: 'add' | 'remove'): void {
    switch (action) {
      case 'add':
        // TODO: open query tab
        /*updateState((state) => {
          const addedAdminPanel = newAdminPanelTab(t);
          state.tabs.push(addedAdminPanel);
          state.activeTab = addedAdminPanel.id;
          setWindowTitle(state);
        });*/
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

  const docsFunctions = useStaticValue(() => ({
    openDocs(page: PageId, section: string | null = null) {
      updateState((state) => {
        const existingTab = state.tabs.find((t) => t.type === 'docs') as DocsTab | undefined;
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

  window.updateServiceStatus = (name, status) =>
    updateState((state) => {
      switch (name) {
        case ServiceName.PostgreSQL:
          state.postgresql = status;
          break;

        case ServiceName.Metabase:
          state.metabase = status;
          break;
      }
    });

  const { tabs, activeTab, postgresql, metabase } = state;

  return (
    <ConfigProvider locale={window.i18n.language === 'de' ? deDE : enUS}>
      <ImporterContext.Provider value={importer}>
        <DocsFunctionsContext.Provider value={docsFunctions}>
          <div className="App">
            <Tabs type="editable-card" activeKey={activeTab} onChange={setActiveTab} onEdit={onEdit}>
              {tabs.map((tab) => (
                <TabPane tab={tab.title} key={tab.id} closable={tab.type !== 'adminPanel'}>
                  {tab.type === 'adminPanel' ? (
                    <AdminPanel
                      isActive={activeTab === tab.id}
                      onTitleChange={(title) => setTitle(tab.id, title)}
                      postgresql={postgresql}
                      metabase={metabase}
                    />
                  ) : (
                    <Docs
                      onTitleChange={(title) => setTitle(tab.id, title)}
                      page={tab.page}
                      onPageChange={(page) =>
                        updateState((state) => {
                          const docsTab = find(state.tabs, { id: tab.id }) as DocsTab;
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
      </ImporterContext.Provider>
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
