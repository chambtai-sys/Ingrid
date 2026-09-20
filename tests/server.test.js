const request = require('supertest');
const { app, ASCII_LOGO } = require('../src/server');
const fs = require('fs');
const path = require('path');

describe('Ingrid Server API', () => {
  const testSheet = {
    id: 'test-sheet-1',
    title: 'Test Budget',
    rowCount: 20,
    colCount: 10,
    activeTab: 'Sheet1',
    tabs: [
      {
        id: 'Sheet1',
        name: 'Sheet1',
        cells: {
          'A1': { raw: '100', style: { bold: true }, comment: 'Important revenue note' },
          'A2': { raw: '200' },
          'A3': { raw: '=SUM(A1:A2)' }
        }
      }
    ]
  };

  let importedSheetId = null;

  afterAll(() => {
    const filesToDelete = [
      path.join(__dirname, '../data/sheets/test-sheet-1.json'),
      importedSheetId ? path.join(__dirname, `../data/sheets/${importedSheetId}.json`) : null
    ];
    filesToDelete.forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  test('ASCII logo contains BETA', () => {
    expect(ASCII_LOGO).toContain('[v1.5 BETA]');
    expect(ASCII_LOGO).toContain('INtelligent GRID');
  });

  test('POST /api/sheets saves sheet with comment metadata', async () => {
    const res = await request(app)
      .post('/api/sheets')
      .send(testSheet);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe('test-sheet-1');
  });

  test('GET /api/sheets lists saved sheet', async () => {
    const res = await request(app).get('/api/sheets');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.sheets)).toBe(true);
    const found = res.body.sheets.find(s => s.id === 'test-sheet-1');
    expect(found).toBeDefined();
    expect(found.title).toBe('Test Budget');
  });

  test('GET /api/sheets/:id retrieves sheet content with comment metadata', async () => {
    const res = await request(app).get('/api/sheets/test-sheet-1');
    expect(res.statusCode).toEqual(200);
    expect(res.body.title).toBe('Test Budget');
    expect(res.body.tabs[0].cells['A1'].comment).toBe('Important revenue note');
    expect(res.body.tabs[0].cells['A3'].raw).toBe('=SUM(A1:A2)');
  });

  test('GET /api/sheets/:id/export/csv evaluates formulas and returns CSV', async () => {
    const res = await request(app).get('/api/sheets/test-sheet-1/export/csv');
    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('100');
    expect(res.text).toContain('200');
    expect(res.text).toContain('300');
  });

  test('POST /api/sheets/import/csv imports CSV text into a new spreadsheet', async () => {
    const csvData = 'Item,Price,Quantity\nApple,1.50,10\nBanana,0.75,20';
    const res = await request(app)
      .post('/api/sheets/import/csv?title=FruitStore')
      .set('Content-Type', 'text/plain')
      .send(csvData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sheet).toBeDefined();
    expect(res.body.sheet.title).toBe('FruitStore');
    expect(res.body.sheet.tabs[0].cells['A1'].raw).toBe('Item');

    importedSheetId = res.body.sheet.id;
  });

  test('DELETE /api/sheets/:id removes sheet', async () => {
    const res = await request(app).delete('/api/sheets/test-sheet-1');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app).get('/api/sheets/test-sheet-1');
    expect(checkRes.statusCode).toEqual(404);
  });
});
