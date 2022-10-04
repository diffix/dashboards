import { LoadingOutlined } from '@ant-design/icons';
import { Steps } from 'antd';
import { produce } from 'immer';
import { debounce, findLastIndex, noop } from 'lodash';
import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { useInViewport } from 'react-in-viewport';
import { useImmer } from 'use-immer';
import { useStaticValue, useT } from '../shared';

const { Step } = Steps;

// Nav state

export enum AdminPanelNavStep {
  TableList,
  CsvImport,
  DataPreview,
  AidSelection,
}

export type AdminPanelNavStepStatus = 'inactive' | 'active' | 'loading' | 'done' | 'failed';

type AdminPanelNavStepState = {
  htmlElement: HTMLElement | null;
  status: AdminPanelNavStepStatus;
};

type AdminPanelNavState = {
  steps: AdminPanelNavStepState[];
  focusedStep: AdminPanelNavStep;
};

const defaultNavState: AdminPanelNavState = {
  steps: Array(AdminPanelNavStep.AidSelection + 1)
    .fill(null)
    .map(() => ({ status: 'inactive', htmlElement: null })),
  focusedStep: AdminPanelNavStep.TableList,
};

const defaultVisibility = Array(AdminPanelNavStep.AidSelection + 1).fill(false);

const AdminPanelNavStateContext = React.createContext<AdminPanelNavState>(defaultNavState);

export function useNavState(): AdminPanelNavState {
  return useContext(AdminPanelNavStateContext);
}

// Nav functions

type AdminPanelNavStepPatch =
  | { htmlElement: null; status?: never }
  | { htmlElement: HTMLElement; status: 'active' | 'loading' | 'done' | 'failed' }
  | { htmlElement?: never; status: AdminPanelNavStepStatus };

type AdminPanelNavFunctions = {
  updateStepStatus(step: AdminPanelNavStep, patch: AdminPanelNavStepPatch): void;
  updateStepVisibility(step: AdminPanelNavStep, visible: boolean): void;
  scrollToStep(step: AdminPanelNavStep): void;
};

const AdminPanelNavFunctionsContext = React.createContext<AdminPanelNavFunctions>({
  updateStepStatus: noop,
  updateStepVisibility: noop,
  scrollToStep: noop,
});

function useNavFunctions(): AdminPanelNavFunctions {
  return useContext(AdminPanelNavFunctionsContext);
}

// Context provider

export type AdminPanelNavProviderProps = {
  isActive: boolean;
};

export const AdminPanelNavProvider: React.FunctionComponent<AdminPanelNavProviderProps> = ({ isActive, children }) => {
  const [navState, updateNavState] = useImmer(defaultNavState);

  // Refs are needed in `navFunctions` because we want it referentially stable.
  const navStateRef = useRef(navState);
  navStateRef.current = navState;
  const visibilityRef = useRef(defaultVisibility);

  const focusStep = useStaticValue(() =>
    debounce(
      (step?: AdminPanelNavStep) =>
        updateNavState((draft) => {
          if (typeof step !== 'undefined') {
            draft.focusedStep = step;
            return;
          }

          const maxStep = Math.max(
            AdminPanelNavStep.CsvImport,
            findLastIndex(draft.steps, (s) => s.status !== 'inactive'),
          );
          const visibleStep = visibilityRef.current.findIndex((visible) => visible);
          draft.focusedStep = visibleStep < 0 || visibleStep > maxStep ? maxStep : visibleStep;
        }),
      500,
    ),
  );

  const navFunctions = useStaticValue<AdminPanelNavFunctions>(() => ({
    updateStepStatus(step, patch) {
      updateNavState((draft) => {
        const { steps } = draft as AdminPanelNavState;
        if (patch.htmlElement === null) {
          steps[step] = {
            htmlElement: null,
            status: 'inactive',
          };
        } else if (patch.htmlElement) {
          steps[step] = patch;
        } else if (steps[step].htmlElement) {
          steps[step].status = patch.status;
        }
      });

      focusStep();
    },
    updateStepVisibility(step: AdminPanelNavStep, visible: boolean) {
      visibilityRef.current = produce(visibilityRef.current, (draft) => void (draft[step] = visible));
      focusStep();
    },
    scrollToStep(step: AdminPanelNavStep) {
      const { htmlElement } = navStateRef.current.steps[step];
      if (htmlElement) {
        htmlElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }

      focusStep(step);
      focusStep.flush();

      // Ugly workaround below...
      // `scrollIntoView` does not return a promise, so we have to cancel intermediate events that happened while smooth scrolling
      setTimeout(() => {
        focusStep.cancel();
        if (!visibilityRef.current[step]) {
          // If scrolling across the entire page, 400 ms is not enough, so we wait again...
          setTimeout(() => focusStep.cancel(), 400);
        }
      }, 400);
    },
  }));

  // Prevents updates while adminPanel is not active.
  useEffect(() => {
    if (!isActive) {
      focusStep.cancel();
      const id = setTimeout(() => focusStep.cancel(), 400);
      return () => clearTimeout(id);
    }
  }, [isActive, focusStep]);

  // Cancels pending updates when unmounted.
  useEffect(() => {
    return () => focusStep.cancel();
  }, [focusStep]);

  return (
    <AdminPanelNavStateContext.Provider value={navState}>
      <AdminPanelNavFunctionsContext.Provider value={navFunctions}>{children}</AdminPanelNavFunctionsContext.Provider>
    </AdminPanelNavStateContext.Provider>
  );
};

// Context consumers

export type AdminPanelNavAnchorProps = {
  step: AdminPanelNavStep;
  status?: AdminPanelNavStepStatus;
};

export const AdminPanelNavAnchor: React.FunctionComponent<AdminPanelNavAnchorProps> = ({ step, status = 'active' }) => {
  const navFunctions = useNavFunctions();

  const visibilityRef = useRef<HTMLDivElement>(null);

  const scrollRef = useCallback(
    (htmlElement: HTMLElement | null) => {
      navFunctions.updateStepStatus(step, {
        htmlElement,
        status,
      } as AdminPanelNavStepPatch);
    },
    [step, status, navFunctions],
  );

  const { inViewport } = useInViewport(visibilityRef, {}, { disconnectOnLeave: false }, {});

  useEffect(() => {
    navFunctions.updateStepVisibility(step, inViewport);
  }, [step, inViewport, navFunctions]);

  // Clicking on the first step will scroll to top.
  const scrollOffset = step === 0 ? -32 : -24;

  return (
    <div style={{ position: 'relative' }}>
      <div ref={scrollRef} style={{ position: 'absolute', top: scrollOffset, left: 0 }}></div>
      <div ref={visibilityRef} style={{ position: 'absolute', top: 0, left: 0 }}></div>
    </div>
  );
};

function mapStatus(status: AdminPanelNavStepStatus): 'error' | 'process' | 'finish' | 'wait' {
  switch (status) {
    case 'inactive':
      return 'wait';
    case 'active':
    case 'loading':
      return 'process';
    case 'done':
      return 'finish';
    case 'failed':
      return 'error';
  }
}

function mapText(text: string, focused: boolean) {
  if (focused) return <strong>{text}</strong>;
  else return <>{text}</>;
}

const AdminPanelNavSteps = React.memo<{ steps: AdminPanelNavStepState[]; focusedStep: AdminPanelNavStep }>(
  ({ steps, focusedStep }) => {
    const t = useT('Sidebar::AdminPanelNavSteps');
    const navFunctions = useNavFunctions();
    const status = (step: AdminPanelNavStep) => mapStatus(steps[step].status);

    return (
      <Steps
        progressDot={(dot, { index }) =>
          steps[index].status === 'loading' ? (
            <span
              key="loading"
              className="ant-steps-icon-dot"
              style={{
                backgroundColor: 'transparent',
                color: '#1890ff',
                left: -5,
              }}
            >
              <LoadingOutlined />
            </span>
          ) : (
            dot
          )
        }
        direction="vertical"
        current={-1}
        onChange={(step) => {
          navFunctions.scrollToStep(step);
        }}
        size="small"
      >
        <Step
          status={status(AdminPanelNavStep.TableList)}
          title={mapText(t('Table List'), focusedStep === AdminPanelNavStep.TableList)}
          description={t('Inspect and manage imported tables')}
        />
        <Step
          status={status(AdminPanelNavStep.CsvImport)}
          title={mapText(t('CSV Import'), focusedStep === AdminPanelNavStep.CsvImport)}
          description={t('Load data from CSV')}
        />
        <Step
          status={status(AdminPanelNavStep.DataPreview)}
          title={mapText(t('Data Preview'), focusedStep === AdminPanelNavStep.DataPreview)}
          description={t('Preview contents of file')}
        />
        <Step
          status={status(AdminPanelNavStep.AidSelection)}
          title={mapText(t('ID Selection'), focusedStep === AdminPanelNavStep.AidSelection)}
          description={t('Select the entity identifier column')}
        />
      </Steps>
    );
  },
);

export const AdminPanelNav: React.FunctionComponent = () => {
  const { steps, focusedStep } = useNavState();
  return <AdminPanelNavSteps steps={steps} focusedStep={focusedStep} />;
};
