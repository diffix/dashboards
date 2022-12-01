import { postgresQuote } from '../../shared';
import { Field, Table } from './types';

type Display = 'table' | 'bar' | 'row' | 'scalar' | 'map'; // Other types TBD.

/** An example query card. */
export type ExampleQuery = {
  name: string; // Title of card.
  sql: string; // SQL query.
  sizeX: number; // Grid of 18 units wide.
  sizeY: number; // Height of card in units.
  display: Display;
  visualizationSettings: Record<string, unknown>; // To be typed later.

  // There's also row/col properties, but we'll make some rectangle
  // packing algorithm to arrange cards automatically in a section.
};

/** A section for a group of examples. */
type ExamplesSection = {
  title: string | null; // Markdown text as the section heading.
  queries: ExampleQuery[]; // Cards in section.
};

type ExampleInfo = {
  sql: string;
  name: string;
};

function lines(...lines: string[]) {
  return lines.join('\n');
}

const numberFieldTypes = ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'];

function rawGroupBySQL(column: string, table: string, displayName: string): ExampleInfo {
  return {
    name: `${displayName} by ${column}`,
    sql: lines(`SELECT ${postgresQuote(column)}`, `FROM ${postgresQuote(table)}`, `GROUP BY ${postgresQuote(column)}`),
  };
}

function countDistinctSQL(column: string, table: string): ExampleInfo {
  return {
    name: `Distinct ${column}`,
    sql: lines(
      `SELECT count(distinct ${postgresQuote(column)}) as ${postgresQuote('distinct_' + column)}`,
      `FROM ${postgresQuote(table)}`,
    ),
  };
}

function avgSQL(column: string, table: string): ExampleInfo {
  return {
    name: `Average ${column}`,
    sql: lines(
      `SELECT avg(${postgresQuote(column)}) as ${postgresQuote('avg_' + column)}`,
      `FROM ${postgresQuote(table)}`,
    ),
  };
}

function textGeneralizedSQL(column: string, table: string, displayName: string, averageLength: number): ExampleInfo {
  const nChars = Math.ceil(averageLength / 4);
  const stars = '*'.repeat(Math.ceil(averageLength - nChars));
  const bucket = `substring(${postgresQuote(column)}, 1, ${nChars})`;

  return {
    name: `${displayName} by ${column}`,
    sql: lines(`SELECT ${bucket} || ${stars}, count(*)`, `FROM ${postgresQuote(table)}`, `GROUP BY ${bucket}`),
  };
}

function yearlyGeneralizedSQL(column: string, table: string, displayName: string): ExampleInfo {
  const bucket = `extract(year from ${postgresQuote(column)})`;

  return {
    name: `${displayName} by ${column} year`,
    sql: lines(
      `SELECT ${bucket} as ${postgresQuote(column + '_year')}, count(*)`,
      `FROM ${postgresQuote(table)}`,
      `GROUP BY ${bucket}`,
    ),
  };
}

function makeExampleInfos(field: Field, table: Table, aidColumns: string[]): ExampleInfo[] {
  try {
    if (field.semantic_type === 'type/PK' || field.database_type === 'serial') {
      // No sensible example for columns being just row IDs.
      return [];
    } else if (aidColumns.includes(field.name)) {
      // Never SELECT/GROUP BY AIDs directly, also no point in generalizing.
      return [countDistinctSQL(field.name, table.name)];
    } else if (field.database_type === 'text' && field.fingerprint) {
      if (field.fingerprint.global['distinct-count'] && field.fingerprint.global['distinct-count'] < 10) {
        // Few distinct values - can GROUP BY directly.
        return [rawGroupBySQL(field.name, table.name, table.display_name)];
      } else {
        const averageLength = field.fingerprint.type?.['type/Text']?.['average-length'];

        // The `< 20`: we want to generalize surnames and categories but not sentences, paragraphs or addresses.
        if (averageLength && averageLength < 20) {
          return [textGeneralizedSQL(field.name, table.name, table.display_name, averageLength)];
        } else {
          return [countDistinctSQL(field.name, table.name)];
        }
      }
    } else if (numberFieldTypes.includes(field.database_type) && field.fingerprint) {
      if (field.fingerprint.global['distinct-count'] && field.fingerprint.global['distinct-count'] < 10) {
        // Few distinct values - can GROUP BY directly.
        return [rawGroupBySQL(field.name, table.name, table.display_name)];
      } else {
        // TODO: Construct stable generalization. Temporarily revert to the average.
        return [avgSQL(field.name, table.name)];
      }
    } else if (field.database_type === 'timestamp') {
      // TODO: using timestamps fingerprint is possible, but we need to pull in some datetime lib.
      return [yearlyGeneralizedSQL(field.name, table.name, table.display_name)];
    } else {
      // Fallback to the count distinct for anything else.
      return [countDistinctSQL(field.name, table.name)];
    }
  } catch (err) {
    console.warn(`Unable to make example query for ${table.name}, ${field.name}`, err);
    return [];
  }
}

export function exampleQueries(table: Table, aidColumns: string[]): ExamplesSection[] {
  const exampleInfos = table.fields.flatMap((field) => makeExampleInfos(field, table, aidColumns));
  // const t = getT('example-queries'); // Let's worry about i18n later...

  return [
    {
      title: 'Overview',
      queries: [
        {
          name: `Count of ${table.display_name}`,
          sql: lines('SELECT count(*)', `FROM ${table.name}`),
          sizeX: 6, // 6 is a good default (3 cards per row).
          sizeY: 4, // 4 is a good default.
          display: 'scalar',
          visualizationSettings: {}, // No visualizations for now. To be done after we finish SQL.
        },
      ],
    },
    {
      title: `Overview of ${table.display_name} columns`,
      queries: exampleInfos.map(({ name, sql }) => {
        return {
          name: name,
          sql: sql,
          sizeX: 6,
          sizeY: 4, // TODO: For a table we might need something taller.
          display: 'table' as Display, // For now we show results only as 'table'.
          visualizationSettings: {},
        };
      }),
    },
  ];
}
