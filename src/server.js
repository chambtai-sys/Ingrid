const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { evaluateFormula, indexToColLetter } = require('./formula');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data/sheets');

const ASCII_LOGO = `
 ██████╗███╗   ██╗ ██████╗  ██████╗  ██████╗
  ██║  ████╗  ██║██╔════╝  ██╔══██╗ ██╔══██╗
  ██║  ██╔██╗ ██║██║  ███╗ ██████╔╝ ██║  ██║  [BETA]
  ██║  ██║╚██╗██║██║   ██║ ██╔══██╗ ██║  ██║
 ██████╗██║ ╚████║╚██████╔╝██║  ██║ ██████╔╝
 ╚═════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝
        INtelligent GRID spreadsheet engine
`;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Utility to get filepath for sheet ID
function getSheetPath(id) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeId}.json`);
}

// Helper to escape CSV values
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to parse CSV text into grid
function parseCsvText(csvText) {
  const lines = csvText.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim() && rows.length === 0) continue;
    const row = [];
    let inQuotes = false;
    let currVal = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          currVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currVal);
        currVal = '';
      } else {
        currVal += char;
      }
    }
    row.push(currVal);
    rows.push(row);
  }
  return rows;
}

// GET /api/sheets - List all sheets
app.get('/api/sheets', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const sheets = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(DATA_DIR, file);
        const stats = fs.statSync(filePath);
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            id: content.id || file.replace('.json', ''),
            title: content.title || 'Untitled Spreadsheet',
            updatedAt: content.updatedAt || stats.mtime,
            rowCount: content.rowCount || 50,
            colCount: content.colCount || 26
          };
        } catch {
          return {
            id: file.replace('.json', ''),
            title: file.replace('.json', ''),
            updatedAt: stats.mtime
          };
        }
      });
    res.json({ sheets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list sheets', message: err.message });
  }
});

// GET /api/sheets/:id - Get a sheet by ID
app.get('/api/sheets/:id', (req, res) => {
  try {
    const filePath = getSheetPath(req.params.id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Sheet not found' });
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sheet', message: err.message });
  }
});

// POST /api/sheets - Create or save a sheet
app.post('/api/sheets', (req, res) => {
  try {
    const sheetData = req.body;
    if (!sheetData || !sheetData.id) {
      return res.status(400).json({ error: 'Missing sheet id' });
    }
    sheetData.updatedAt = new Date().toISOString();
    const filePath = getSheetPath(sheetData.id);
    fs.writeFileSync(filePath, JSON.stringify(sheetData, null, 2), 'utf8');
    res.json({ success: true, id: sheetData.id, updatedAt: sheetData.updatedAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save sheet', message: err.message });
  }
});

// DELETE /api/sheets/:id - Delete a sheet
app.delete('/api/sheets/:id', (req, res) => {
  try {
    const filePath = getSheetPath(req.params.id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete sheet', message: err.message });
  }
});

// GET /api/sheets/:id/export/csv - Export sheet tab to CSV
app.get('/api/sheets/:id/export/csv', (req, res) => {
  try {
    const filePath = getSheetPath(req.params.id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Sheet not found' });
    }
    const sheetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const tabId = req.query.tabId || sheetData.activeTab || (sheetData.tabs && sheetData.tabs[0] ? sheetData.tabs[0].id : null);
    const tab = (sheetData.tabs || []).find(t => t.id === tabId) || sheetData.tabs[0];

    if (!tab) {
      return res.status(400).json({ error: 'No tab found in sheet' });
    }

    const cells = tab.cells || {};
    const rowCount = sheetData.rowCount || 50;
    const colCount = sheetData.colCount || 26;

    const getCellValue = (ref) => {
      const cell = cells[ref];
      return cell ? cell.raw : '';
    };

    let maxFilledRow = 0;
    let maxFilledCol = 0;

    // Find bounding box
    Object.keys(cells).forEach(ref => {
      const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(ref);
      if (match) {
        const colStr = match[1];
        let cIdx = 0;
        for (let i = 0; i < colStr.length; i++) {
          cIdx = cIdx * 26 + (colStr.charCodeAt(i) - 64);
        }
        cIdx -= 1;
        const rIdx = parseInt(match[2], 10) - 1;
        if (cIdx > maxFilledCol) maxFilledCol = cIdx;
        if (rIdx > maxFilledRow) maxFilledRow = rIdx;
      }
    });

    const exportRows = Math.max(maxFilledRow + 1, 1);
    const exportCols = Math.max(maxFilledCol + 1, 1);

    const csvLines = [];
    for (let r = 0; r < exportRows; r++) {
      const lineCells = [];
      for (let c = 0; c < exportCols; c++) {
        const colRef = indexToColLetter(c);
        const cellRef = `${colRef}${r + 1}`;
        const rawVal = cells[cellRef] ? cells[cellRef].raw : '';
        const evalVal = evaluateFormula(rawVal, getCellValue);
        lineCells.push(escapeCsvValue(evalVal));
      }
      csvLines.push(lineCells.join(','));
    }

    const csvString = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${sheetData.title || 'export'}.csv"`);
    res.send(csvString);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export CSV', message: err.message });
  }
});

// POST /api/sheets/import/csv - Import CSV data into a new sheet structure
app.post('/api/sheets/import/csv', express.text({ type: '*/*' }), (req, res) => {
  try {
    const csvContent = typeof req.body === 'string' ? req.body : (req.body ? req.body.csv || '' : '');
    const title = req.query.title || 'Imported Spreadsheet';
    const rows = parseCsvText(csvContent);

    const cells = {};
    let maxCols = 10;
    rows.forEach((row, rIdx) => {
      if (row.length > maxCols) maxCols = row.length;
      row.forEach((val, cIdx) => {
        if (val !== '') {
          const colRef = indexToColLetter(cIdx);
          const cellRef = `${colRef}${rIdx + 1}`;
          cells[cellRef] = { raw: val };
        }
      });
    });

    const sheetId = `sheet_${Date.now()}`;
    const newSheet = {
      id: sheetId,
      title: title,
      rowCount: Math.max(rows.length + 10, 50),
      colCount: Math.max(maxCols + 5, 26),
      activeTab: 'Sheet1',
      tabs: [
        {
          id: 'Sheet1',
          name: 'Sheet1',
          cells: cells
        }
      ],
      updatedAt: new Date().toISOString()
    };

    const filePath = getSheetPath(sheetId);
    fs.writeFileSync(filePath, JSON.stringify(newSheet, null, 2), 'utf8');

    res.json({ success: true, sheet: newSheet });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import CSV', message: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(ASCII_LOGO);
    console.log(`Ingrid Spreadsheet App running locally on http://localhost:${PORT}`);
  });
}

module.exports = { app, ASCII_LOGO, parseCsvText };
