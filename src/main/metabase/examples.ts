import { Table } from './types';

/** An example query card. */
type ExampleQuery = {
  name: string; // Title of card.
  sql: string; // SQL query.
  sizeX: number; // Grid of 18 units wide.
  sizeY: number; // Height of card in units.
  display: 'table' | 'bar' | 'row' | 'scalar' | 'map'; // Other types TBD.
  visualizationSettings: Record<string, unknown>; // To be typed later.

  // There's also row/col properties, but we'll make some rectangle
  // packing algorithm to arrange cards automatically in a section.
};

/** A section for a group of examples. */
type ExamplesSection = {
  title: string | null; // Markdown text as the section heading.
  queries: ExampleQuery[]; // Cards in section.
};

function lines(...lines: string[]) {
  return lines.join('\n');
}

export function exampleQueries(table: Table, aidColumns: string[]): ExamplesSection[] {
  const { fields, display_name } = table; // TODO: iterate and inspect fields

  let name = table.name;
  // if (requiresQuoting(name)) {
  //   name = `"${name}"`
  // }

  // const t = getT('example-queries'); // Let's worry about i18n later...

  return [
    {
      title: 'Overview',
      queries: [
        {
          name: `Count of ${display_name}`,
          sql: lines('SELECT count(*)', `FROM ${name}`),
          sizeX: 6, // 6 is a good default (3 cards per row).
          sizeY: 4, // 4 is a good default.
          display: 'scalar',
          visualizationSettings: {}, // No visualizations for now. To be done after we finish SQL.
        },
      ],
    },
    {
      // GROUP BY examples
      title: `Distribution of ${display_name}`,
      queries: [
        {
          name: `${display_name} by <column>`,
          sql: lines('SELECT <column>, count(*)', `FROM ${name}`, 'GROUP BY <column>'),
          sizeX: 6,
          sizeY: 4, // For a table we might need something taller.
          display: 'table', // For now we show results only as 'table'.
          visualizationSettings: {},
        },
      ],
    },
    // ...
  ];
}
