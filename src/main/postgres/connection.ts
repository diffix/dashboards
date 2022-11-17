import postgres, { ParameterOrFragment } from 'postgres';
import { postgresConfig } from '../config';

export const sql = postgres({
  host: postgresConfig.hostname,
  port: postgresConfig.port,
  database: postgresConfig.tablesDatabase,
  username: postgresConfig.adminUser,
  password: postgresConfig.adminPassword,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlFragment = ParameterOrFragment<any>;
