import { roundBinSize } from './utils';

const BIN_SIZES_INTEGER = [1, 2, 3, 5, 10, 15, 20];
const BIN_SIZES_REAL = [1, 1.25, 2, 2.5, 3, 5, 7.5, 10];

test('roundBinSize', () => {
  BIN_SIZES_INTEGER.map((x) => expect(roundBinSize(x, BIN_SIZES_INTEGER)).toBe(x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(x, BIN_SIZES_REAL)).toBe(x));

  BIN_SIZES_INTEGER.map((x) => expect(roundBinSize(10 * x, BIN_SIZES_INTEGER)).toBe(10 * x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(10 * x, BIN_SIZES_REAL)).toBe(10 * x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(x / 10, BIN_SIZES_REAL)).toBe(x / 10));

  BIN_SIZES_INTEGER.map((x) => expect(roundBinSize(1.01 * x, BIN_SIZES_INTEGER)).toBe(x));
  BIN_SIZES_INTEGER.map((x) => expect(roundBinSize(0.99 * x, BIN_SIZES_INTEGER)).toBe(x));
  BIN_SIZES_INTEGER.map((x) => expect(roundBinSize(1.000000001 * x, BIN_SIZES_INTEGER)).toBe(x));
  BIN_SIZES_INTEGER.map((x) => expect(roundBinSize(0.999999999 * x, BIN_SIZES_INTEGER)).toBe(x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(1.01 * x, BIN_SIZES_REAL)).toBe(x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(0.99 * x, BIN_SIZES_REAL)).toBe(x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(1.000000001 * x, BIN_SIZES_REAL)).toBe(x));
  BIN_SIZES_REAL.map((x) => expect(roundBinSize(0.999999999 * x, BIN_SIZES_REAL)).toBe(x));

  expect(roundBinSize(0.0000000000000001, BIN_SIZES_INTEGER)).toBe(0.0001);
  expect(roundBinSize(0.0000000000000001, BIN_SIZES_REAL)).toBe(0.0001);
  expect(roundBinSize(0, BIN_SIZES_INTEGER)).toBe(0.0001);
  expect(roundBinSize(0, BIN_SIZES_REAL)).toBe(0.0001);
  const hugeInt = 9007199254740991;
  expect(roundBinSize(hugeInt, BIN_SIZES_INTEGER)).toBe(10000000000000000.0);
  const hugeReal = 123412341243.12341234123;
  expect(roundBinSize(hugeReal, BIN_SIZES_REAL)).toBe(125000000000);
});
