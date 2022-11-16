import { atom, useAtomValue } from 'jotai';
import { noop } from 'lodash';
import { ServiceName, ServiceStatus } from '../types';

export const $postgresqlStatus = atom(window.getServicesStatus(ServiceName.PostgreSQL));

$postgresqlStatus.onMount = (setAtom) => {
  window.onPostgresqlStatusUpdate = (status) => setAtom(status);
  return () => (window.onPostgresqlStatusUpdate = noop);
};

export const $metabaseStatus = atom(window.getServicesStatus(ServiceName.Metabase));

$metabaseStatus.onMount = (setAtom) => {
  window.onMetabaseStatusUpdate = (status) => setAtom(status);
  return () => (window.onMetabaseStatusUpdate = noop);
};

export function usePostgresqlStatus(): ServiceStatus {
  return useAtomValue($postgresqlStatus);
}

export function useMetabaseStatus(): ServiceStatus {
  return useAtomValue($metabaseStatus);
}
