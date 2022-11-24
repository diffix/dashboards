import { postgresReservedKeywords } from './constants';

const tableNameRE = /^[a-z_][a-z0-9$_]*$/;
export function isPostgresIdentifier(name: string): boolean {
  return postgresReservedKeywords.includes(name) || !tableNameRE.test(name);
}
