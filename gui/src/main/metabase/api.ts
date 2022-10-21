import { ClientRequestConstructorOptions, net } from 'electron';
import { metabaseConfig, postgresConfig } from '../config';
import { getUsername } from '../service-utils';

type RequestOptions = Partial<ClientRequestConstructorOptions> & {
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
};

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthCheck(): Promise<boolean> {
  try {
    const response = await get('/api/health');
    return response.status === 'ok';
  } catch (e) {
    return false;
  }
}

async function waitUntilReady(): Promise<void> {
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

async function setupMetabase(setupToken: string): Promise<void> {
  const { siteName, adminEmail, adminPassword } = metabaseConfig;
  await post('/api/setup', {
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
    prefs: { site_name: 'Open Diffix', site_locale: 'en', allow_tracking: 'false' },
  });
}

async function logIn(): Promise<void> {
  const { adminEmail, adminPassword } = metabaseConfig;
  await post('/api/session', {
    username: adminEmail,
    password: adminPassword,
    remember: false,
  });
}

async function addDataSources(): Promise<void> {
  function conn(name: string, user: string, password: string) {
    return {
      engine: 'postgres',
      name,
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
      },
      is_full_sync: true,
    };
  }

  await post(
    '/api/database',
    conn(metabaseConfig.directDataSourceName, postgresConfig.adminUser, postgresConfig.adminPassword),
  );
  await post(
    '/api/database',
    conn(metabaseConfig.anonymizedDataSourceName, postgresConfig.trustedUser, postgresConfig.trustedPassword),
  );
}

export async function syncMetabaseSchema(): Promise<void> {
  const databases = (await get('/api/database')).data as Array<{ id: number; is_sample: boolean }>;
  for (const db of databases) {
    if (!db.is_sample) {
      await post(`/api/database/${db.id}/sync_schema`, {});
    }
  }
}

export async function initializeMetabase(): Promise<void> {
  await waitUntilReady();
  const properties = await get('/api/session/properties');
  const hasUserSetup = properties['has-user-setup'];
  if (!hasUserSetup) {
    await setupMetabase(properties['setup-token'] as string);
    await logIn();
    await addDataSources();
  } else {
    await logIn();
  }
}
