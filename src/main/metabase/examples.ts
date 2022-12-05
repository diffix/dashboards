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
// Multiple columns
// ----------------------------------------------------------------

function groupBy2ColumnsSQL(fieldA: Field, fieldB: Field, table: Table): ExampleQuery {
  const query: ExampleQuery = {
    name: `${table.display_name} by ${fieldA.display_name}, ${fieldB.display_name}`,
    sql: lines(
      `SELECT ${postgresQuote(fieldA.name)}, ${postgresQuote(fieldB.name)}, count(*)`,
      `FROM ${postgresQuote(table.name)}`,
      `GROUP BY ${postgresQuote(fieldA.name)}, ${postgresQuote(fieldB.name)}`,
      `ORDER BY count(*) DESC`,
    ),
  };

  const distinctA = fieldA.fingerprint.global['distinct-count'];
  const distinctB = fieldB.fingerprint.global['distinct-count'];
  if (typeof distinctA === 'number' && distinctA <= 5 && typeof distinctB === 'number' && distinctA <= 5) {
    return {
      sizeY: 6,
      display: 'bar',
      visualizationSettings: {
        'graph.dimensions': [fieldB.name, fieldA.name],
        'graph.metrics': ['count'],
      },
      ...query,
    };
  } else {
    return {
      sizeY: 6,
      display: 'table',
      visualizationSettings: {
        'table.pivot': true,
        'table.cell_column': 'count',
        'table.pivot_column': fieldA.name,
      },
      ...query,
    };
  }
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
        return [countDistinctSQL(field, table)];
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

function makeMultipleColumnQueries(fields: Field[], table: Table, aidColumns: string[]): ExampleQuery[] {
  // Candidates are non-ID fields, with at least 2 distinct entries, having the least distinct entries
  const candidateFields = fields
    .filter(
      (field) =>
        !aidColumns.includes(field.name) &&
        field.fingerprint &&
        field.semantic_type !== 'type/PK' &&
        field.database_type !== 'serial' &&
        field.fingerprint.global['distinct-count'] &&
        field.fingerprint.global['distinct-count'] >= 2 &&
        field.fingerprint.global['distinct-count'] <= 20,
    )
    .sort(
      (fieldA, fieldB) => fieldA.fingerprint!.global['distinct-count']! - fieldB.fingerprint!.global['distinct-count']!,
    );

  if (candidateFields.length >= 2) {
    return [groupBy2ColumnsSQL(candidateFields[0], candidateFields[1], table)];
  } else {
    return [];
  }
}

export function exampleQueries(table: Table, aidColumns: string[]): ExamplesSection[] {
  const columnQueries = table.fields.flatMap((field) => columnExampleQueries(field, table, aidColumns));
  const multipleColumnQueries = makeMultipleColumnQueries(table.fields, table, aidColumns);

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
      queries: columnQueries,
    },
    {
      title: `# ${table.display_name} by multiple columns`,
      queries: multipleColumnQueries,
    },
  ];
}
