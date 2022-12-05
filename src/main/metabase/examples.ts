import { find } from 'lodash';
import { postgresQuote } from '../../shared';
import { Field, Table } from './types';

// ----------------------------------------------------------------
// Types & helpers
// ----------------------------------------------------------------

/** A section for a group of examples. */
type ExamplesSection = {
  title: string; // Markdown text as the section heading.
  titleSizeY?: number; // Title height. Defaults to 1.
  queries: ExampleQuery[]; // Cards in section.
};

type Display = 'table' | 'bar' | 'row' | 'scalar' | 'map'; // Other types TBD.

/** An example query card. */
export type ExampleQuery = {
  name: string; // Title of card.
  sql: string; // SQL query.
  sizeX?: number; // Grid of 18 units wide. Defaults to 6.
  sizeY?: number; // Height of card in units. Defaults to 4.
  display?: Display; // Display type. Defaults to 'table';
  visualizationSettings?: Record<string, unknown>; // To be typed later.
};

export function withDefaults({
  name,
  sql,
  sizeX = 6,
  sizeY = 4,
  display = 'table',
  visualizationSettings = {},
}: ExampleQuery): Required<ExampleQuery> {
  return { name, sql, sizeX, sizeY, display, visualizationSettings };
}

function lines(...lines: string[]) {
  return lines.join('\n');
}

// ----------------------------------------------------------------
// Visualization
// ----------------------------------------------------------------

function tableMiniBar(example: ExampleQuery): ExampleQuery {
  return {
    sizeY: 6,
    display: 'table',
    visualizationSettings: {
      column_settings: {
        '["name","count"]': {
          show_mini_bar: true,
        },
      },
    },
    ...example,
  };
}

function rowChart(field: Field, example: ExampleQuery): ExampleQuery {
  return {
    display: 'row',
    visualizationSettings: {
      'graph.dimensions': [field.name],
      'graph.metrics': ['count'],
    },
    ...example,
  };
}

function scalar(example: ExampleQuery): ExampleQuery {
  return {
    display: 'scalar',
    ...example,
  };
}

// ----------------------------------------------------------------
// All columns
// ----------------------------------------------------------------

function rawGroupBySQL(field: Field, table: Table): ExampleQuery {
  const column = field.name;
  const query: ExampleQuery = {
    name: `${table.display_name} by ${field.display_name}`,
    sql: lines(
      `SELECT ${postgresQuote(column)}, count(*)`,
      `FROM ${postgresQuote(table.name)}`,
      `GROUP BY ${postgresQuote(column)}`,
      field.database_type === 'text' ? `ORDER BY count(*) DESC` : `ORDER BY ${postgresQuote(column)} ASC`,
    ),
  };

  const distinct = field.fingerprint.global['distinct-count'];
  if (typeof distinct === 'number' && distinct <= 5) {
    return {
      ...rowChart(field, query),
      sizeY: distinct <= 2 ? 4 : 6,
    };
  } else {
    return tableMiniBar(query);
  }
}

function countDistinctSQL(field: Field, table: Table): ExampleQuery {
  const column = field.name;
  return scalar({
    name: `Distinct ${field.display_name}`,
    sql: lines(
      `SELECT count(distinct ${postgresQuote(column)}) as ${postgresQuote('distinct_' + column)}`,
      `FROM ${postgresQuote(table.name)}`,
    ),
  });
}

// ----------------------------------------------------------------
// Numeric columns
// ----------------------------------------------------------------

const numberFieldTypes = ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'];

function avgSQL(field: Field, table: Table): ExampleQuery {
  const column = field.name;
  return scalar({
    name: `Average ${field.display_name}`,
    sql: lines(
      `SELECT avg(${postgresQuote(column)}) as ${postgresQuote('avg_' + column)}`,
      `FROM ${postgresQuote(table.name)}`,
    ),
  });
}

// ----------------------------------------------------------------
// Text columns
// ----------------------------------------------------------------

function textGeneralizedSQL(field: Field, table: Table, averageLength: number): ExampleQuery {
  const column = field.name;
  const nChars = Math.ceil(averageLength / 4);
  const stars = "'" + '*'.repeat(Math.ceil(averageLength - nChars)) + "'";
  const bucket = `substring(${postgresQuote(column)}, 1, ${nChars})`;

  return tableMiniBar({
    name: `${table.display_name} by ${field.display_name} ${nChars} initial characters`,
    sql: lines(
      `SELECT ${bucket} || ${stars} as ${postgresQuote(field.name + '_starts_with')}, count(*)`,
      `FROM ${postgresQuote(table.name)}`,
      `GROUP BY ${bucket}`,
      `ORDER BY count(*) DESC`,
    ),
  });
}

// ----------------------------------------------------------------
// Datetime columns
// ----------------------------------------------------------------

function yearlyGeneralizedSQL(field: Field, table: Table): ExampleQuery {
  const column = field.name;
  const bucket = `extract(year from ${postgresQuote(column)})`;

  return tableMiniBar({
    name: `${table.display_name} by ${field.display_name} year`,
    sql: lines(
      `SELECT ${bucket} as ${postgresQuote(column + '_year')}, count(*)`,
      `FROM ${postgresQuote(table.name)}`,
      `GROUP BY ${bucket}`,
      `ORDER BY ${bucket} ASC`,
    ),
  });
}

// ----------------------------------------------------------------
// Example builder
// ----------------------------------------------------------------

function columnExampleQueries(field: Field, table: Table, aidColumns: string[]): ExampleQuery[] {
  try {
    if (field.semantic_type === 'type/PK' || field.database_type === 'serial') {
      // No sensible example for columns being just row IDs.
      return [];
    } else if (aidColumns.includes(field.name)) {
      // Query is generated in 'Overview' section.
      return [];
    } else if (field.database_type === 'text' && field.fingerprint) {
      if (field.fingerprint.global['distinct-count'] && field.fingerprint.global['distinct-count'] < 10) {
        // Few distinct values - can GROUP BY directly.
        return [rawGroupBySQL(field, table)];
      } else {
        const averageLength = field.fingerprint.type?.['type/Text']?.['average-length'];

        // The `< 20`: we want to generalize surnames and categories but not sentences, paragraphs or addresses.
        if (averageLength && averageLength < 20) {
          return [textGeneralizedSQL(field, table, averageLength)];
        } else {
          return [countDistinctSQL(field, table)];
        }
      }
    } else if (numberFieldTypes.includes(field.database_type) && field.fingerprint) {
      if (field.fingerprint.global['distinct-count'] && field.fingerprint.global['distinct-count'] < 10) {
        // Few distinct values - can GROUP BY directly.
        return [rawGroupBySQL(field, table)];
      } else {
        // TODO: Construct stable generalization. Temporarily revert to the average.
        return [avgSQL(field, table)];
      }
    } else if (field.database_type === 'timestamp') {
      // TODO: using timestamps fingerprint is possible, but we need to pull in some datetime lib.
      return [yearlyGeneralizedSQL(field, table)];
    } else {
      // Fallback to the count distinct for anything else.
      return [countDistinctSQL(field, table)];
    }
  } catch (err) {
    console.warn(`Unable to make example query for ${table.name}, ${field.name}`, err);
    return [];
  }
}

export function exampleQueries(table: Table, aidColumns: string[]): ExamplesSection[] {
  const exampleQueries = table.fields.flatMap((field) => columnExampleQueries(field, table, aidColumns));

  function findField(name: string) {
    const field = find(table.fields, { name });
    if (!field) throw new Error(`Field '${name}' not found in table ${table.name}.`);
    return field;
  }
  // const t = getT('example-queries'); // Let's worry about i18n later...

  return [
    {
      title: '# Overview',
      queries: [
        scalar({
          name: 'Rows in table',
          sql: lines('SELECT count(*)', `FROM ${table.name}`),
        }),
        ...aidColumns.map((aidColumn) => ({
          ...countDistinctSQL(findField(aidColumn), table),
          name: 'Distinct entities',
        })),
      ],
    },
    {
      title: `# Overview of ${table.display_name} columns`,
      queries: exampleQueries,
    },
  ];
}
