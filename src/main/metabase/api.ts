import { ClientRequestConstructorOptions, net } from 'electron';
import { find } from 'lodash';
import { postgresQuote } from '../../shared';
import { InitialQueryPayloads } from '../../types';
import { metabaseConfig, postgresConfig } from '../config';
import { getAppLanguage } from '../language';
import { delay, getUsername } from '../service-utils';
import { exampleQueries, ExampleQuery } from './examples';
import { Table } from './types';

type RequestOptions = Partial<ClientRequestConstructorOptions> & {
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
};

type Database = {
  id: number;
  is_sample: boolean;
  details: { dbname: string; user: string };
};

function findAnonymizedAccessDbId(databases: Database[]) {
  const databaseId = databases.find(
    (db) => db.details.dbname === postgresConfig.tablesDatabase && db.details.user === postgresConfig.trustedUser,
  )?.id;

  if (databaseId) {
    return databaseId;
  } else {
    throw new Error('Anonymized access data source not found in Metabase');
  }
}

function findDirectAccessDbId(databases: Database[]) {
  const databaseId = databases.find(
    (db) => db.details.dbname === postgresConfig.tablesDatabase && db.details.user === postgresConfig.adminUser,
  )?.id;

  if (databaseId) {
    return databaseId;
  } else {
    throw new Error('Direct access data source not found in Metabase');
  }
}

const sqlHint = `
-- HINTS
-- Change, add, or remove columns as desired.
-- Text columns can be masked:
--     substring(text_column, 1, 2)
-- Numeric columns can be binned:
--     diffix.floor_by(numeric_column, 10)
-- Sum numeric columns with:
--     sum(column)
-- Learn more at https://github.com/diffix/pg_diffix/blob/master/docs/analyst_guide.md#supported-functions.`;

function makeRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { protocol, hostname, port, sessionName } = metabaseConfig;
  const { headers = {}, timeout = 5_000, body, method = 'GET', ...otherOptions } = options;

  const request = net.request({
    protocol,
    hostname,
    port,
    path,
    useSessionCookies: true,
    partition: sessionName,
    method,
    ...otherOptions,
  });

  const allHeaders = {
    // Act as if the request is coming from the browser.
    Origin: `${protocol}//${hostname}:${port}`,
    Accept: 'application/json',
    ...headers,
  };
  Object.entries(allHeaders).forEach(([name, value]) => request.setHeader(name, value));

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (typeof timeout !== 'undefined') {
      timeoutId = setTimeout(() => reject('timed_out'), timeout);
    }

    request.on('abort', () => reject('aborted'));
    request.on('error', (e) => reject(e));

    request.on('response', (response) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      const statusCode = response.statusCode;
      let responseContent = '';

      response.on('data', (chunk) => {
        responseContent += chunk.toString();
      });

      response.on('error', () => reject('invalid_response'));

      response.on('end', () => {
        let data: unknown = null;
        if (responseContent) {
          try {
            data = JSON.parse(responseContent);
          } catch (e) {
            console.error(e);
            reject('invalid_response');
            return;
          }
        }

        if (statusCode >= 200 && statusCode <= 299) {
          resolve(data);
        } else {
          reject({ statusCode, data });
        }
      });
    });

    if (typeof body !== 'undefined') {
      request.setHeader('Content-Type', 'application/json');
      request.write(JSON.stringify(body), 'utf8');
    }

    request.end();
  });
}

function get(path: string) {
  return makeRequest(path) as Promise<Record<string, unknown>>;
}

function post(path: string, data: unknown) {
  return makeRequest(path, {
    method: 'POST',
    body: data,
  }) as Promise<Record<string, unknown>>;
}

function put(path: string, data: unknown) {
  return makeRequest(path, {
    method: 'PUT',
    body: data,
  }) as Promise<Record<string, unknown>>;
}

function deleteReq(path: string) {
  return makeRequest(path, { method: 'DELETE' }) as Promise<Record<string, unknown>>;
}

async function healthCheck(): Promise<boolean> {
  try {
    const response = await get('/api/health');
    return response.status === 'ok';
  } catch (e) {
    return false;
  }
}

async function getTableId(databaseId: number, tableName: string) {
  const tables = (await get(`api/database/${databaseId}?include=tables`)).tables as Array<{
    id: number;
    name: string;
  }>;
  const tableId = tables.find((table) => table.name === tableName)?.id;

  if (tableId) {
    return tableId;
  } else {
    throw new Error(`Table ${tableName} not found in data source ${databaseId}`);
  }
}

function makeSqlPayload(databaseId: number, queryString: string) {
  return {
    dataset_query: {
      type: 'native',
      native: { query: queryString, 'template-tags': {} },
      database: databaseId,
    },
    display: 'table',
    displayIsLocked: true,
    parameters: [],
  };
}

export async function waitUntilReady(): Promise<void> {
  const { connectAttempts, connectTimeout } = metabaseConfig;
  for (let i = 0; i < connectAttempts; i++) {
    const isReady = await healthCheck();
    if (isReady) {
      return;
    }

    await delay(connectTimeout / connectAttempts);
  }

  throw new Error('Could not connect to metabase.');
}

export async function setupMetabase(): Promise<Record<string, unknown>> {
  const properties = await get('/api/session/properties');
  const setupToken = properties['setup-token'] as string;
  const { siteName, adminEmail, adminPassword } = metabaseConfig;
  return post('/api/setup', {
    token: setupToken,
    user: {
      first_name: getUsername(),
      last_name: null,
      email: adminEmail,
      site_name: siteName,
      password: adminPassword,
      password_confirm: adminPassword,
    },
    database: null,
    invite: null,
    prefs: { site_name: 'Open Diffix', site_locale: getAppLanguage(), allow_tracking: 'false' },
  });
}

export async function logIn(): Promise<Record<string, unknown>> {
  const { adminEmail, adminPassword } = metabaseConfig;
  return post('/api/session', {
    username: adminEmail,
    password: adminPassword,
    remember: false,
  });
}

export async function addDataSources(): Promise<Array<Record<string, unknown>>> {
  function conn(access: 'direct' | 'anonymized', user: string, password: string) {
    return {
      engine: 'postgres',
      name: access === 'direct' ? metabaseConfig.directDataSourceName : metabaseConfig.anonymizedDataSourceName,
      details: {
        host: postgresConfig.hostname,
        port: postgresConfig.port,
        dbname: postgresConfig.tablesDatabase,
        user,
        password,
        'schema-filters-type': 'all',
        ssl: false,
        'tunnel-enabled': false,
        'advanced-options': false,
        'let-user-control-scheduling': true,
      },
      refingerprint: null,
      is_full_sync: access === 'direct',
      is_on_demand: access === 'direct',
    };
  }

  return [
    await post('/api/database', conn('direct', postgresConfig.adminUser, postgresConfig.adminPassword)),
    await post('/api/database', conn('anonymized', postgresConfig.trustedUser, postgresConfig.trustedPassword)),
  ];
}

export async function removeSampleData(): Promise<void> {
  // According to Metabase docs, sample data cannot be stopped from being generated.
  // When removed, the `id: 1` is not reused, so it's a fair assumption to delete it like this.
  await deleteReq('/api/database/1');
}

export async function getAnonymizedAccessDbId(): Promise<number> {
  const databases = (await get('/api/database')).data as Database[];
  return findAnonymizedAccessDbId(databases);
}

export async function buildInitialQueries(
  databaseId: number,
  tableName: string,
  aidColumns: string[],
): Promise<InitialQueryPayloads> {
  const tableId = await getTableId(databaseId, tableName);
  const fields = (await get(`api/table/${tableId}/query_metadata`)).fields as Array<{ id: number; name: string }>;

  // Picks some fields which aren't AIDs to put in the GROUP BY.
  const nonAidField = fields.find((field) => !aidColumns.includes(field.name));

  const columnSQL = nonAidField ? `${postgresQuote(nonAidField.name)},` : '';
  const groupBySQL = nonAidField ? `GROUP BY ${postgresQuote(nonAidField.name)}` : '';
  const query = [`SELECT ${columnSQL} count(*)`, `FROM ${postgresQuote(tableName)}`, `${groupBySQL}`].join('\n');
  const commentedQuery = `${query}\n\n${sqlHint}`;

  const sqlPayload = makeSqlPayload(databaseId, commentedQuery);

  return { sqlPayload: Buffer.from(JSON.stringify(sqlPayload)).toString('base64') };
}

export async function hasUserSetup(): Promise<boolean> {
  const properties = await get('/api/session/properties');
  return properties['has-user-setup'] as boolean;
}

export async function syncMetabaseSchema(): Promise<void> {
  const databases = (await get('/api/database')).data as Array<Database>;
  const anonymizedAccessDbId = findAnonymizedAccessDbId(databases);

  for (const db of databases) {
    if (!db.is_sample && db.id !== anonymizedAccessDbId) {
      await post(`/api/database/${db.id}/sync_schema`, {});
    }
  }
  await post(`/api/database/${anonymizedAccessDbId}/sync`, {});
}

type CollectionId = number;

async function createCollection(parentId: number, name: string, description?: string): Promise<CollectionId> {
  const { id } = await post('/api/collection', {
    name,
    description: description || null,
    color: '#509EE3',
    parent_id: parentId,
  });

  return id as CollectionId;
}

type Collection = {
  id: number;
  personal_owner_id: number;
  name: string;
  archived: boolean;
  children: Collection[];
};

// We can query the user ID from /api/user/current, but the initial user we create will always be 1.
const ADMIN_USER_ID = 1;
const EXAMPLES_COLLECTION_NAME = 'Examples';

async function getExamplesCollection(): Promise<{
  id: number;
  children: Collection[];
}> {
  const collections = (await get('/api/collection/tree?tree=true')) as unknown as Collection[];
  const personalCollection = find(collections, { archived: false, personal_owner_id: ADMIN_USER_ID });
  if (!personalCollection) {
    throw new Error('No personal collection found.');
  }

  const examplesCollection = find(personalCollection.children, { archived: false, name: EXAMPLES_COLLECTION_NAME });
  if (examplesCollection) {
    return examplesCollection;
  } else {
    return {
      id: await createCollection(personalCollection.id, EXAMPLES_COLLECTION_NAME),
      children: [],
    };
  }
}

async function addQueryToCollection(query: ExampleQuery, databaseId: number, collectionId: number): Promise<number> {
  const response = await post('/api/card', {
    name: query.name,
    dataset_query: {
      type: 'native',
      native: {
        query: query.sql,
        'template-tags': {},
      },
      database: databaseId,
    },
    display: query.display,
    description: null,
    visualization_settings: query.visualizationSettings,
    parameters: [],
    collection_id: collectionId,
    result_metadata: null,
  });

  return response.id as number;
}

export async function getOrCreateTableExamples(tableName: string, aidColumns: string[]): Promise<number> {
  const parentCollection = await getExamplesCollection();

  const collection = find(parentCollection.children, { archived: false, name: tableName });
  if (collection) {
    // Examples collection already exists, return ID.
    return collection.id;
  }

  // Make and populate examples collection.

  const collectionId = await createCollection(parentCollection.id, tableName);

  const databases = (await get('/api/database')).data as Database[];

  const directDatabaseId = findDirectAccessDbId(databases);
  const anonDatabaseId = findAnonymizedAccessDbId(databases);

  const directTableId = await getTableId(directDatabaseId, tableName);
  const tableMetadata = (await get(`/api/table/${directTableId}/query_metadata`)) as Table;

  if (tableMetadata.initial_sync_status !== 'complete') {
    throw new Error('Table metadata is not ready.');
  }

  // Create dashboard.
  const dashboard = await post('api/dashboard', {
    collection_id: collectionId,
    name: `${tableMetadata.display_name} Dashboard`,
  });
  const dashboardId = dashboard.id as number;

  // Pin dashboard.
  await put(`/api/dashboard/${dashboardId}`, { collection_position: 1 });

  // Add queries to dashboard.
  const sections = exampleQueries(tableMetadata, aidColumns);
  for (const section of sections) {
    for (const query of section.queries) {
      const queryId = await addQueryToCollection(query, anonDatabaseId, collectionId);
      await post(`/api/dashboard/${dashboardId}/cards`, { cardId: queryId });
    }
  }

  return collectionId;
}

/** Archives the collection of table examples if it exists. */
export async function removeTableExamples(tableName: string): Promise<void> {
  const collections = (await get('/api/collection/tree?tree=true')) as unknown as Collection[];
  const personalCollection = find(collections, { archived: false, personal_owner_id: ADMIN_USER_ID });
  if (!personalCollection) {
    return; // Should never happen.
  }

  const examplesCollection = find(personalCollection.children, { archived: false, name: EXAMPLES_COLLECTION_NAME });
  if (!examplesCollection) {
    return; // No examples at all yet.
  }

  const collection = find(examplesCollection.children, { archived: false, name: tableName });
  if (!collection) {
    return; // Table has no examples created.
  }

  await put(`/api/collection/${collection.id}`, { archived: true });
}
