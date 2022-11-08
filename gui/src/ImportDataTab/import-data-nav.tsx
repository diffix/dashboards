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

export enum ImportDataNavStep {
  CsvImport,
  DataPreview,
  AidSelection,
  Import,
}

export type ImportDataNavStepStatus = 'inactive' | 'active' | 'loading' | 'done' | 'failed';

type ImportDataNavStepState = {
  htmlElement: HTMLElement | null;
  status: ImportDataNavStepStatus;
};

type ImportDataNavState = {
  steps: ImportDataNavStepState[];
  focusedStep: ImportDataNavStep;
};

const defaultNavState: ImportDataNavState = {
  steps: Array(ImportDataNavStep.Import + 1)
    .fill(null)
    .map(() => ({ status: 'inactive', htmlElement: null })),
  focusedStep: ImportDataNavStep.CsvImport,
};

const defaultVisibility = Array(ImportDataNavStep.Import + 1).fill(false);

const ImportDataNavStateContext = React.createContext<ImportDataNavState>(defaultNavState);

export function useNavState(): ImportDataNavState {
  return useContext(ImportDataNavStateContext);
}

// Nav functions

type ImportDataNavStepPatch =
  | { htmlElement: null; status?: never }
  | { htmlElement: HTMLElement; status: 'active' | 'loading' | 'done' | 'failed' }
  | { htmlElement?: never; status: ImportDataNavStepStatus };

type ImportDataNavFunctions = {
  updateStepStatus(step: ImportDataNavStep, patch: ImportDataNavStepPatch): void;
  updateStepVisibility(step: ImportDataNavStep, visible: boolean): void;
  scrollToStep(step: ImportDataNavStep): void;
};

const ImportDataNavFunctionsContext = React.createContext<ImportDataNavFunctions>({
  updateStepStatus: noop,
  updateStepVisibility: noop,
  scrollToStep: noop,
});

function useNavFunctions(): ImportDataNavFunctions {
  return useContext(ImportDataNavFunctionsContext);
}

// Context provider

export type ImportDataNavProviderProps = {
  isActive: boolean;
};

export const ImportDataNavProvider: React.FunctionComponent<ImportDataNavProviderProps> = ({ isActive, children }) => {
  const [navState, updateNavState] = useImmer(defaultNavState);

  // Refs are needed in `navFunctions` because we want it referentially stable.
  const navStateRef = useRef(navState);
  navStateRef.current = navState;
  const visibilityRef = useRef(defaultVisibility);

  const focusStep = useStaticValue(() =>
    debounce(
      (step?: ImportDataNavStep) =>
        updateNavState((draft) => {
          if (typeof step !== 'undefined') {
            draft.focusedStep = step;
            return;
          }

          const maxStep = Math.max(
            ImportDataNavStep.CsvImport,
            findLastIndex(draft.steps, (s) => s.status !== 'inactive'),
          );
          const visibleStep = visibilityRef.current.findIndex((visible) => visible);
          draft.focusedStep = visibleStep < 0 || visibleStep > maxStep ? maxStep : visibleStep;
        }),
      500,
    ),
  );

  const navFunctions = useStaticValue<ImportDataNavFunctions>(() => ({
    updateStepStatus(step, patch) {
      updateNavState((draft) => {
        const { steps } = draft as ImportDataNavState;
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
    updateStepVisibility(step: ImportDataNavStep, visible: boolean) {
      visibilityRef.current = produce(visibilityRef.current, (draft) => void (draft[step] = visible));
      focusStep();
    },
    scrollToStep(step: ImportDataNavStep) {
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

  // Prevents updates while the tab is not active.
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
    <ImportDataNavStateContext.Provider value={navState}>
      <ImportDataNavFunctionsContext.Provider value={navFunctions}>{children}</ImportDataNavFunctionsContext.Provider>
    </ImportDataNavStateContext.Provider>
  );
};

// Context consumers

export type ImportDataNavAnchorProps = {
  step: ImportDataNavStep;
  status?: ImportDataNavStepStatus;
};

export const ImportDataNavAnchor: React.FunctionComponent<ImportDataNavAnchorProps> = ({ step, status = 'active' }) => {
  const navFunctions = useNavFunctions();

  const visibilityRef = useRef<HTMLDivElement>(null);

  const scrollRef = useCallback(
    (htmlElement: HTMLElement | null) => {
      navFunctions.updateStepStatus(step, {
        htmlElement,
        status,
      } as ImportDataNavStepPatch);
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

function mapStatus(status: ImportDataNavStepStatus): 'error' | 'process' | 'finish' | 'wait' {
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

const ImportDataNavSteps = React.memo<{ steps: ImportDataNavStepState[]; focusedStep: ImportDataNavStep }>(
  ({ steps, focusedStep }) => {
    const t = useT('ImportDataTab::Sidebar::ImportDataNavSteps');
    const navFunctions = useNavFunctions();
    const status = (step: ImportDataNavStep) => mapStatus(steps[step].status);

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
          status={status(ImportDataNavStep.CsvImport)}
          title={mapText(t('Select File'), focusedStep === ImportDataNavStep.CsvImport)}
          description={t('Load data from CSV')}
        />
        <Step
          status={status(ImportDataNavStep.DataPreview)}
          title={mapText(t('Data Preview'), focusedStep === ImportDataNavStep.DataPreview)}
          description={t('Preview contents of the file')}
        />
        <Step
          status={status(ImportDataNavStep.AidSelection)}
          title={mapText(t('Protected Entity'), focusedStep === ImportDataNavStep.AidSelection)}
          description={t('Identify the protected entity in the data')}
        />
        <Step
          status={status(ImportDataNavStep.Import)}
          title={mapText(t('Table Name'), focusedStep === ImportDataNavStep.Import)}
          description={t('Select table name and finalize import')}
        />
      </Steps>
    );
  },
);

export const ImportDataNav: React.FunctionComponent = () => {
  const { steps, focusedStep } = useNavState();
  return <ImportDataNavSteps steps={steps} focusedStep={focusedStep} />;
};
