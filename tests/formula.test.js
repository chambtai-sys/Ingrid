const {
  colLetterToIndex,
  indexToColLetter,
  parseCellRef,
  expandRange,
  evaluateFormula
} = require('../src/formula');

describe('Ingrid Formula Engine', () => {
  test('Column indexing conversions', () => {
    expect(colLetterToIndex('A')).toBe(0);
    expect(colLetterToIndex('Z')).toBe(25);
    expect(colLetterToIndex('AA')).toBe(26);

    expect(indexToColLetter(0)).toBe('A');
    expect(indexToColLetter(25)).toBe('Z');
    expect(indexToColLetter(26)).toBe('AA');
  });

  test('parseCellRef and expandRange', () => {
    expect(parseCellRef('A1')).toEqual({ col: 0, row: 0, colStr: 'A', rowStr: '1' });
    expect(parseCellRef('B10')).toEqual({ col: 1, row: 9, colStr: 'B', rowStr: '10' });
    expect(parseCellRef('invalid')).toBeNull();

    expect(expandRange('A1:B2')).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  test('Basic arithmetic evaluation', () => {
    expect(evaluateFormula('10')).toBe(10);
    expect(evaluateFormula('= 2 + 3 * 4')).toBe(14);
    expect(evaluateFormula('=(10 - 2) / 2')).toBe(4);
    expect(evaluateFormula('=2^3')).toBe(8);
  });

  test('Cell reference resolution', () => {
    const gridData = {
      'A1': '10',
      'A2': '20',
      'B1': '=A1 * 2',
      'B2': '=A1 + A2'
    };
    const getCell = (ref) => gridData[ref] ?? '';

    expect(evaluateFormula('=A1 + A2', getCell)).toBe(30);
    expect(evaluateFormula('=B1', getCell)).toBe(20);
    expect(evaluateFormula('=B2', getCell)).toBe(30);
  });

  test('Functions SUM, AVERAGE, MIN, MAX, COUNT', () => {
    const gridData = {
      'A1': '10',
      'A2': '20',
      'A3': '30',
      'A4': '40'
    };
    const getCell = (ref) => gridData[ref] ?? '';

    expect(evaluateFormula('=SUM(A1:A4)', getCell)).toBe(100);
    expect(evaluateFormula('=AVERAGE(A1:A4)', getCell)).toBe(25);
    expect(evaluateFormula('=MIN(A1:A4)', getCell)).toBe(10);
    expect(evaluateFormula('=MAX(A1:A4)', getCell)).toBe(40);
    expect(evaluateFormula('=COUNT(A1:A4)', getCell)).toBe(4);
  });

  test('IF logic and string handling', () => {
    const gridData = {
      'A1': '100'
    };
    const getCell = (ref) => gridData[ref] ?? '';

    expect(evaluateFormula('=IF(A1 > 50, "High", "Low")', getCell)).toBe('High');
    expect(evaluateFormula('=IF(A1 < 50, "High", "Low")', getCell)).toBe('Low');
    expect(evaluateFormula('=CONCAT("Ingrid", " ", "Beta")', getCell)).toBe('Ingrid Beta');
  });

  test('Error handling (division by zero, circular reference, invalid syntax)', () => {
    const gridData = {
      'A1': '=B1',
      'B1': '=A1'
    };
    const getCell = (ref) => gridData[ref] ?? '';

    expect(evaluateFormula('=10 / 0')).toBe('#DIV/0!');
    expect(evaluateFormula('=A1', getCell)).toBe('#CIRCULAR!');
    expect(evaluateFormula('=SUM(')).toBe('#SYNTAX!');
  });
});
