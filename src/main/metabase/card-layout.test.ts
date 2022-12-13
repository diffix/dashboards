import { CardLayout } from './card-layout';

let layout: CardLayout;

beforeEach(() => {
  layout = new CardLayout();
});

test('Adds newlines and sections', () => {
  expect(layout.putSection(0)).toEqual({ col: 0, row: 0, sizeX: 18, sizeY: 0 });
  expect(layout.putSection(1)).toEqual({ col: 0, row: 0, sizeX: 18, sizeY: 1 });
  expect(layout.putSection(2)).toEqual({ col: 0, row: 2, sizeX: 18, sizeY: 2 });
  expect(layout.putSection(1)).toEqual({ col: 0, row: 5, sizeX: 18, sizeY: 1 });
});

test('Rejects nonsense', () => {
  expect(() => layout.putSection(-1)).toThrow();
  expect(() => layout.putCard(-1, 0)).toThrow();
  expect(() => layout.putCard(0, -1)).toThrow();
  expect(() => layout.putCard(19, 1)).toThrow();
});

test('Arranges a regular grid', () => {
  expect(layout.putCard(6, 3)).toEqual({ col: 0, row: 0, sizeX: 6, sizeY: 3 });
  expect(layout.putCard(6, 3)).toEqual({ col: 6, row: 0, sizeX: 6, sizeY: 3 });
  expect(layout.putCard(6, 3)).toEqual({ col: 12, row: 0, sizeX: 6, sizeY: 3 });
  expect(layout.putCard(6, 3)).toEqual({ col: 0, row: 3, sizeX: 6, sizeY: 3 });
});

test('Arranges an irregular grid', () => {
  expect(layout.putCard(1, 6)).toEqual({ col: 0, row: 0, sizeX: 1, sizeY: 6 });
  expect(layout.putCard(2, 5)).toEqual({ col: 1, row: 0, sizeX: 2, sizeY: 5 });
  expect(layout.putCard(3, 4)).toEqual({ col: 3, row: 0, sizeX: 3, sizeY: 4 });
  expect(layout.putCard(12, 3)).toEqual({ col: 6, row: 0, sizeX: 12, sizeY: 3 });
  expect(layout.putCard(12, 3)).toEqual({ col: 6, row: 3, sizeX: 12, sizeY: 3 });
  expect(layout.putCard(6, 3)).toEqual({ col: 0, row: 6, sizeX: 6, sizeY: 3 });
  expect(layout.putCard(1, 1)).toEqual({ col: 3, row: 4, sizeX: 1, sizeY: 1 });
});

test('Arranges an irregular grid with line breaks', () => {
  expect(layout.putCard(1, 6)).toEqual({ col: 0, row: 0, sizeX: 1, sizeY: 6 });
  expect(layout.putCard(2, 5)).toEqual({ col: 1, row: 0, sizeX: 2, sizeY: 5 });
  expect(layout.putCard(3, 4)).toEqual({ col: 3, row: 0, sizeX: 3, sizeY: 4 });
  expect(layout.putCard(12, 3)).toEqual({ col: 6, row: 0, sizeX: 12, sizeY: 3 });
  expect(layout.putSection(0)).toEqual({ col: 0, row: 6, sizeX: 18, sizeY: 0 });
  expect(layout.putCard(12, 3)).toEqual({ col: 0, row: 6, sizeX: 12, sizeY: 3 });
  expect(layout.putCard(6, 3)).toEqual({ col: 12, row: 6, sizeX: 6, sizeY: 3 });
  expect(layout.putCard(1, 1)).toEqual({ col: 0, row: 9, sizeX: 1, sizeY: 1 });
});
