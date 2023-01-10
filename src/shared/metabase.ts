export function makeSqlPayload(databaseId: number, queryString: string): Record<string, unknown> {
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
