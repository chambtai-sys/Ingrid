/**
 * Ingrid Client Application Engine
 */

// Local column indexing helpers
function colLetterToIndex(colStr) {
  let index = 0;
  const uppercaseStr = colStr.toUpperCase();
  for (let i = 0; i < uppercaseStr.length; i++) {
    index = index * 26 + (uppercaseStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

function indexToColLetter(index) {
  let temp = index + 1;
  let colName = '';
  while (temp > 0) {
    let rem = (temp - 1) % 26;
    colName = String.fromCharCode(65 + rem) + colName;
    temp = Math.floor((temp - 1) / 26);
  }
  return colName;
}

function parseCellRef(refStr) {
  const match = /^([A-Za-z]+)([1-9][0-9]*)$/.exec(refStr.trim());
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  return { col, row, colStr: match[1].toUpperCase(), rowStr: match[2] };
}

function expandRange(rangeStr) {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [];

  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  const refs = [];
  for (let c = minCol; c <= maxCol; c++) {
    const colLetter = indexToColLetter(c);
    for (let r = minRow; r <= maxRow; r++) {
      refs.push(`${colLetter}${r + 1}`);
    }
  }
  return refs;
}

// Client Formula Evaluator
function evaluateFormula(expr, getCellValue, visitingSet = new Set()) {
  if (typeof expr !== 'string') return expr ?? '';

  const trimmed = expr.trim();
  if (!trimmed.startsWith('=')) {
    if (trimmed !== '' && !isNaN(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  }

  const formulaContent = trimmed.substring(1).trim();
  if (!formulaContent) return '';

  try {
    const tokens = tokenize(formulaContent);
    const parser = new ClientParser(tokens, getCellValue, visitingSet);
    return parser.parseExpression();
  } catch (err) {
    if (err.message && err.message.startsWith('#')) {
      return err.message;
    }
    return '#ERROR!';
  }
}

function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(char) || (char === '.' && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      let numStr = '';
      while (i < input.length && (/[0-9]/.test(input[i]) || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    if (char === '"') {
      i++;
      let str = '';
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i < input.length && input[i] === '"') i++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let id = '';
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        id += input[i];
        i++;
      }

      if (i < input.length && input[i] === ':') {
        i++;
        let endId = '';
        while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
          endId += input[i];
          i++;
        }
        tokens.push({ type: 'RANGE', value: `${id.toUpperCase()}:${endId.toUpperCase()}` });
        continue;
      }

      let peekIndex = i;
      while (peekIndex < input.length && /\s/.test(input[peekIndex])) peekIndex++;

      if (peekIndex < input.length && input[peekIndex] === '(') {
        tokens.push({ type: 'FUNCTION', value: id.toUpperCase() });
      } else if (parseCellRef(id)) {
        tokens.push({ type: 'CELL_REF', value: id.toUpperCase() });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: id.toUpperCase() });
      }
      continue;
    }

    if (i + 1 < input.length) {
      const two = input.substring(i, i + 2);
      if (['<=', '>=', '<>', '=='].includes(two)) {
        tokens.push({ type: 'OPERATOR', value: two });
        i += 2;
        continue;
      }
    }

    if (['+', '-', '*', '/', '^', '=', '<', '>', '(', ')', ',', ':'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    throw new Error(`#SYNTAX! Unknown character: ${char}`);
  }

  return tokens;
}

class ClientParser {
  constructor(tokens, getCellValue, visitingSet) {
    this.tokens = tokens;
    this.pos = 0;
    this.getCellValue = getCellValue;
    this.visitingSet = visitingSet;
  }

  peek() {
    return this.tokens[this.pos] || null;
  }

  consume() {
    return this.tokens[this.pos++] || null;
  }

  parseExpression() {
    return this.parseComparison();
  }

  parseComparison() {
    let left = this.parseAdditive();
    const current = this.peek();
    if (current && current.type === 'OPERATOR' && ['=', '<', '>', '<=', '>=', '<>', '=='].includes(current.value)) {
      const op = this.consume().value;
      const right = this.parseAdditive();
      if (op === '=' || op === '==') return left == right;
      if (op === '<>') return left != right;
      if (op === '<') return left < right;
      if (op === '>') return left > right;
      if (op === '<=') return left <= right;
      if (op === '>=') return left >= right;
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (true) {
      const current = this.peek();
      if (current && current.type === 'OPERATOR' && (current.value === '+' || current.value === '-')) {
        const op = this.consume().value;
        const right = this.parseMultiplicative();
        const lNum = Number(left) || 0;
        const rNum = Number(right) || 0;
        left = op === '+' ? lNum + rNum : lNum - rNum;
      } else {
        break;
      }
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parsePower();
    while (true) {
      const current = this.peek();
      if (current && current.type === 'OPERATOR' && (current.value === '*' || current.value === '/')) {
        const op = this.consume().value;
        const right = this.parsePower();
        const lNum = Number(left) || 0;
        const rNum = Number(right) || 0;
        if (op === '/' && rNum === 0) throw new Error('#DIV/0!');
        left = op === '*' ? lNum * rNum : lNum / rNum;
      } else {
        break;
      }
    }
    return left;
  }

  parsePower() {
    let left = this.parsePrimary();
    const current = this.peek();
    if (current && current.type === 'OPERATOR' && current.value === '^') {
      this.consume();
      const right = this.parsePower();
      return Math.pow(Number(left) || 0, Number(right) || 0);
    }
    return left;
  }

  parsePrimary() {
    const token = this.peek();
    if (!token) throw new Error('#VALUE!');

    if (token.type === 'OPERATOR' && (token.value === '+' || token.value === '-')) {
      const op = this.consume().value;
      const val = this.parsePrimary();
      return op === '-' ? -Number(val) : Number(val);
    }

    if (token.type === 'NUMBER') {
      this.consume();
      return token.value;
    }

    if (token.type === 'STRING') {
      this.consume();
      return token.value;
    }

    if (token.type === 'CELL_REF') {
      const refToken = this.consume();
      const refKey = refToken.value.toUpperCase();

      if (this.visitingSet.has(refKey)) {
        throw new Error('#CIRCULAR!');
      }

      this.visitingSet.add(refKey);
      let rawVal = this.getCellValue ? this.getCellValue(refKey) : null;
      let evaluated = evaluateFormula(rawVal, this.getCellValue, this.visitingSet);
      this.visitingSet.delete(refKey);

      if (typeof evaluated === 'string' && evaluated.startsWith('#')) {
        throw new Error(evaluated);
      }
      return evaluated === '' ? 0 : evaluated;
    }

    if (token.type === 'FUNCTION') {
      return this.parseFunctionCall();
    }

    if (token.type === 'OPERATOR' && token.value === '(') {
      this.consume();
      const val = this.parseExpression();
      const closing = this.peek();
      if (closing && closing.type === 'OPERATOR' && closing.value === ')') {
        this.consume();
      } else {
        throw new Error('#SYNTAX!');
      }
      return val;
    }

    throw new Error('#VALUE!');
  }

  parseFunctionCall() {
    const fnToken = this.consume();
    const fnName = fnToken.value;

    const openParen = this.consume();
    if (!openParen || openParen.type !== 'OPERATOR' || openParen.value !== '(') {
      throw new Error('#SYNTAX!');
    }

    const args = [];
    if (this.peek() && (this.peek().type !== 'OPERATOR' || this.peek().value !== ')')) {
      while (true) {
        const next = this.peek();
        if (next && next.type === 'RANGE') {
          const rangeToken = this.consume();
          const cellRefs = expandRange(rangeToken.value);
          const rangeValues = [];
          for (const ref of cellRefs) {
            let val = evaluateFormula(this.getCellValue ? this.getCellValue(ref) : null, this.getCellValue, new Set(this.visitingSet));
            if (typeof val === 'string' && val.startsWith('#')) throw new Error(val);
            if (val !== '' && val !== null && val !== undefined) rangeValues.push(val);
          }
          args.push(rangeValues);
        } else {
          const argVal = this.parseExpression();
          args.push(argVal);
        }

        const commaOrClose = this.peek();
        if (commaOrClose && commaOrClose.type === 'OPERATOR' && commaOrClose.value === ',') {
          this.consume();
        } else {
          break;
        }
      }
    }

    const closeParen = this.consume();
    if (!closeParen || closeParen.type !== 'OPERATOR' || closeParen.value !== ')') {
      throw new Error('#SYNTAX!');
    }

    return this.evaluateBuiltinFunction(fnName, args);
  }

  evaluateBuiltinFunction(fnName, args) {
    const flattenNumbers = (argList) => {
      const result = [];
      const recurse = (item) => {
        if (Array.isArray(item)) item.forEach(recurse);
        else {
          const n = Number(item);
          if (!isNaN(n) && item !== '' && item !== null && item !== undefined) result.push(n);
        }
      };
      argList.forEach(recurse);
      return result;
    };

    switch (fnName) {
      case 'SUM': {
        const nums = flattenNumbers(args);
        return nums.reduce((acc, curr) => acc + curr, 0);
      }
      case 'AVERAGE': {
        const nums = flattenNumbers(args);
        if (nums.length === 0) throw new Error('#DIV/0!');
        return nums.reduce((acc, curr) => acc + curr, 0) / nums.length;
      }
      case 'COUNT': {
        return flattenNumbers(args).length;
      }
      case 'MIN': {
        const nums = flattenNumbers(args);
        return nums.length === 0 ? 0 : Math.min(...nums);
      }
      case 'MAX': {
        const nums = flattenNumbers(args);
        return nums.length === 0 ? 0 : Math.max(...nums);
      }
      case 'IF': {
        if (args.length < 2) throw new Error('#VALUE!');
        return Boolean(args[0]) ? args[1] : (args.length >= 3 ? args[2] : false);
      }
      case 'CONCAT':
      case 'CONCATENATE': {
        let str = '';
        const recurse = (item) => {
          if (Array.isArray(item)) item.forEach(recurse);
          else if (item !== null && item !== undefined) str += String(item);
        };
        args.forEach(recurse);
        return str;
      }
      default:
        throw new Error('#NAME?');
    }
  }
}

// Global Application State
class IngridApp {
  constructor() {
    this.sheetData = {
      id: `sheet_${Date.now()}`,
      title: 'Untitled Spreadsheet',
      rowCount: 50,
      colCount: 26,
      activeTab: 'Sheet1',
      tabs: [
        {
          id: 'Sheet1',
          name: 'Sheet1',
          cells: {}
        }
      ]
    };

    this.selectedCellRef = 'A1';

    this.initElements();
    this.bindEvents();
    this.renderTabs();
    this.renderGrid();
    this.updateStatus('Ingrid Spreadsheet Ready');
  }

  initElements() {
    this.titleInput = document.getElementById('spreadsheet-title');
    this.btnSave = document.getElementById('btn-save');
    this.btnSheetsList = document.getElementById('btn-sheets-list');
    this.btnImportCsv = document.getElementById('btn-import-csv');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.csvFileInput = document.getElementById('csv-file-input');

    this.btnBold = document.getElementById('btn-bold');
    this.btnItalic = document.getElementById('btn-italic');
    this.btnUnderline = document.getElementById('btn-underline');
    this.bgColorPicker = document.getElementById('bg-color-picker');
    this.textColorPicker = document.getElementById('text-color-picker');

    this.btnAlignLeft = document.getElementById('btn-align-left');
    this.btnAlignCenter = document.getElementById('btn-align-center');
    this.btnAlignRight = document.getElementById('btn-align-right');
    this.selectFormat = document.getElementById('select-format');

    this.btnAddRow = document.getElementById('btn-add-row');
    this.btnAddCol = document.getElementById('btn-add-col');

    this.cellIdIndicator = document.getElementById('active-cell-id');
    this.formulaInput = document.getElementById('formula-input');

    this.gridHeader = document.getElementById('grid-header');
    this.gridBody = document.getElementById('grid-body');

    this.tabsList = document.getElementById('tabs-list');
    this.btnAddTab = document.getElementById('btn-add-tab');
    this.statusText = document.getElementById('status-text');

    this.sheetsModal = document.getElementById('sheets-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.sheetsModalList = document.getElementById('sheets-modal-list');
    this.btnNewSpreadsheet = document.getElementById('btn-new-spreadsheet');
  }

  getActiveTab() {
    let tab = this.sheetData.tabs.find(t => t.id === this.sheetData.activeTab);
    if (!tab) {
      tab = this.sheetData.tabs[0];
      this.sheetData.activeTab = tab.id;
    }
    if (!tab.cells) tab.cells = {};
    return tab;
  }

  bindEvents() {
    // Title change
    this.titleInput.addEventListener('input', () => {
      this.sheetData.title = this.titleInput.value.trim() || 'Untitled Spreadsheet';
    });

    // Save
    this.btnSave.addEventListener('click', () => {
      this.commitFormulaInput();
      this.saveSheet();
    });

    // Sheets Modal
    this.btnSheetsList.addEventListener('click', () => this.openSheetsModal());
    this.btnCloseModal.addEventListener('click', () => this.sheetsModal.classList.remove('active'));
    this.btnNewSpreadsheet.addEventListener('click', () => {
      this.sheetsModal.classList.remove('active');
      this.createNewSheet();
    });

    // CSV Import / Export
    this.btnExportCsv.addEventListener('click', () => this.exportCsv());
    this.btnImportCsv.addEventListener('click', () => this.csvFileInput.click());
    this.csvFileInput.addEventListener('change', (e) => this.handleCsvFileSelect(e));

    // Formatting Toolbar
    this.btnBold.addEventListener('click', () => this.toggleCellFormat('bold'));
    this.btnItalic.addEventListener('click', () => this.toggleCellFormat('italic'));
    this.btnUnderline.addEventListener('click', () => this.toggleCellFormat('underline'));

    this.bgColorPicker.addEventListener('input', (e) => this.setCellProperty('bgColor', e.target.value));
    this.textColorPicker.addEventListener('input', (e) => this.setCellProperty('color', e.target.value));

    this.btnAlignLeft.addEventListener('click', () => this.setCellProperty('align', 'left'));
    this.btnAlignCenter.addEventListener('click', () => this.setCellProperty('align', 'center'));
    this.btnAlignRight.addEventListener('click', () => this.setCellProperty('align', 'right'));

    this.selectFormat.addEventListener('change', (e) => this.setCellProperty('format', e.target.value));

    // Add Row / Col
    this.btnAddRow.addEventListener('click', () => {
      this.sheetData.rowCount += 5;
      this.renderGrid();
      this.updateStatus(`Expanded rows to ${this.sheetData.rowCount}`);
    });

    this.btnAddCol.addEventListener('click', () => {
      this.sheetData.colCount += 2;
      this.renderGrid();
      this.updateStatus(`Expanded columns to ${this.sheetData.colCount}`);
    });

    // Quick Formula Chips
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const formulaTemplate = btn.getAttribute('data-formula');
        this.formulaInput.value = formulaTemplate;
        this.formulaInput.focus();
        if (formulaTemplate.endsWith('()')) {
          this.formulaInput.setSelectionRange(formulaTemplate.length - 1, formulaTemplate.length - 1);
        }
      });
    });

    // Formula Input events
    this.formulaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.commitFormulaInput();
        this.renderGrid();
      }
    });

    this.formulaInput.addEventListener('change', () => {
      this.commitFormulaInput();
      this.renderGrid();
    });

    // Add Tab
    this.btnAddTab.addEventListener('click', () => this.addTab());
  }

  commitFormulaInput() {
    this.applyFormulaValue(this.formulaInput.value, this.selectedCellRef);
  }

  updateStatus(msg) {
    this.statusText.textContent = msg;
  }

  // Render Grid Header & Body
  renderGrid() {
    const tab = this.getActiveTab();
    const rowCount = this.sheetData.rowCount;
    const colCount = this.sheetData.colCount;

    // Build Header
    let headerHtml = '<tr><th class="corner-header"></th>';
    for (let c = 0; c < colCount; c++) {
      headerHtml += `<th class="col-header">${indexToColLetter(c)}</th>`;
    }
    headerHtml += '</tr>';
    this.gridHeader.innerHTML = headerHtml;

    // Helper for cell values
    const getCellValue = (ref) => {
      const cellObj = tab.cells[ref];
      return cellObj ? cellObj.raw : '';
    };

    // Build Body
    let bodyHtml = '';
    for (let r = 0; r < rowCount; r++) {
      let rowHtml = `<tr><td class="row-header">${r + 1}</td>`;
      for (let c = 0; c < colCount; c++) {
        const colLetter = indexToColLetter(c);
        const cellRef = `${colLetter}${r + 1}`;
        const isSelected = cellRef === this.selectedCellRef;

        const cellData = tab.cells[cellRef] || {};
        const rawVal = cellData.raw ?? '';
        const style = cellData.style || {};

        const evaluatedVal = evaluateFormula(rawVal, getCellValue);
        const formattedVal = this.formatDisplayValue(evaluatedVal, style.format);

        // Build style inline string
        let inlineStyle = '';
        if (style.bold) inlineStyle += 'font-weight: bold;';
        if (style.italic) inlineStyle += 'font-style: italic;';
        if (style.underline) inlineStyle += 'text-decoration: underline;';
        if (style.bgColor) inlineStyle += `background-color: ${style.bgColor};`;
        if (style.color) inlineStyle += `color: ${style.color};`;
        if (style.align) inlineStyle += `text-align: ${style.align};`;

        rowHtml += `<td class="cell ${isSelected ? 'selected' : ''}"
                        data-ref="${cellRef}"
                        style="${inlineStyle}"
                        title="${this.escapeHtml(rawVal)}">${this.escapeHtml(formattedVal)}</td>`;
      }
      rowHtml += '</tr>';
      bodyHtml += rowHtml;
    }

    this.gridBody.innerHTML = bodyHtml;

    // Attach Cell Event Listeners
    this.gridBody.querySelectorAll('.cell').forEach(td => {
      td.addEventListener('click', (e) => {
        const ref = td.getAttribute('data-ref');
        this.selectCell(ref);
      });

      td.addEventListener('dblclick', (e) => {
        const ref = td.getAttribute('data-ref');
        this.startCellInlineEdit(td, ref);
      });
    });

    this.updateToolbarState();
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatDisplayValue(val, format) {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'string' && val.startsWith('#')) return val; // Error code

    const num = Number(val);
    if (isNaN(num)) return String(val);

    switch (format) {
      case 'number':
        return num.toFixed(2);
      case 'currency':
        return '$' + num.toFixed(2);
      case 'percent':
        return (num * 100).toFixed(1) + '%';
      default:
        return String(val);
    }
  }

  selectCell(refStr) {
    if (this.selectedCellRef !== refStr) {
      // Commit pending edit for previously selected cell before moving
      this.commitFormulaInput();
      this.selectedCellRef = refStr;
      this.cellIdIndicator.textContent = refStr;

      const tab = this.getActiveTab();
      const cellData = tab.cells[refStr] || {};
      this.formulaInput.value = cellData.raw ?? '';

      // Update selected class in DOM
      this.gridBody.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
      const targetTd = this.gridBody.querySelector(`.cell[data-ref="${refStr}"]`);
      if (targetTd) {
        targetTd.classList.add('selected');
      }

      this.updateToolbarState();
    }
  }

  startCellInlineEdit(tdElement, refStr) {
    const tab = this.getActiveTab();
    const cellData = tab.cells[refStr] || {};
    const currentRaw = cellData.raw ?? '';

    tdElement.innerHTML = `<input type="text" class="cell-editor" value="${this.escapeHtml(currentRaw)}">`;
    const input = tdElement.querySelector('input');
    input.focus();
    input.select();

    const commitEdit = () => {
      const newVal = input.value;
      this.applyFormulaValue(newVal, refStr);
      this.renderGrid();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitEdit();
      } else if (e.key === 'Escape') {
        this.renderGrid();
      }
    });

    input.addEventListener('blur', () => commitEdit());
  }

  applyFormulaValue(val, refStr = this.selectedCellRef) {
    const tab = this.getActiveTab();
    if (!tab.cells[refStr]) {
      tab.cells[refStr] = { raw: '' };
    }
    tab.cells[refStr].raw = val;
    if (refStr === this.selectedCellRef) {
      this.formulaInput.value = val;
    }
  }

  toggleCellFormat(prop) {
    const tab = this.getActiveTab();
    const cell = tab.cells[this.selectedCellRef] || { raw: '' };
    if (!cell.style) cell.style = {};

    cell.style[prop] = !cell.style[prop];
    tab.cells[this.selectedCellRef] = cell;

    this.renderGrid();
  }

  setCellProperty(prop, value) {
    const tab = this.getActiveTab();
    const cell = tab.cells[this.selectedCellRef] || { raw: '' };
    if (!cell.style) cell.style = {};

    cell.style[prop] = value;
    tab.cells[this.selectedCellRef] = cell;

    this.renderGrid();
  }

  updateToolbarState() {
    const tab = this.getActiveTab();
    const cell = tab.cells[this.selectedCellRef] || {};
    const style = cell.style || {};

    if (style.bold) this.btnBold.classList.add('active');
    else this.btnBold.classList.remove('active');

    if (style.italic) this.btnItalic.classList.add('active');
    else this.btnItalic.classList.remove('active');

    if (style.underline) this.btnUnderline.classList.add('active');
    else this.btnUnderline.classList.remove('active');

    this.btnAlignLeft.classList.toggle('active', style.align === 'left');
    this.btnAlignCenter.classList.toggle('active', style.align === 'center');
    this.btnAlignRight.classList.toggle('active', style.align === 'right');

    this.selectFormat.value = style.format || 'general';
  }

  // Multi-tab Management
  renderTabs() {
    this.tabsList.innerHTML = '';
    this.sheetData.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === this.sheetData.activeTab ? 'active' : ''}`;
      tabEl.textContent = tab.name;
      tabEl.addEventListener('click', () => {
        this.commitFormulaInput();
        this.sheetData.activeTab = tab.id;
        this.renderTabs();
        this.renderGrid();
      });
      this.tabsList.appendChild(tabEl);
    });
  }

  addTab() {
    this.commitFormulaInput();
    const newTabNum = this.sheetData.tabs.length + 1;
    const tabId = `Sheet${newTabNum}`;
    this.sheetData.tabs.push({
      id: tabId,
      name: `Sheet${newTabNum}`,
      cells: {}
    });
    this.sheetData.activeTab = tabId;
    this.renderTabs();
    this.renderGrid();
    this.updateStatus(`Added ${tabId}`);
  }

  // Server API calls
  async saveSheet() {
    try {
      this.updateStatus('Saving spreadsheet...');
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.sheetData)
      });
      const data = await res.json();
      if (data.success) {
        this.updateStatus(`Spreadsheet saved at ${new Date(data.updatedAt).toLocaleTimeString()}`);
      } else {
        this.updateStatus('Failed to save spreadsheet');
      }
    } catch (err) {
      this.updateStatus(`Save error: ${err.message}`);
    }
  }

  async openSheetsModal() {
    this.sheetsModal.classList.add('active');
    this.sheetsModalList.innerHTML = '<p style="color: #64748b;">Loading saved sheets...</p>';

    try {
      const res = await fetch('/api/sheets');
      const data = await res.json();
      const sheets = data.sheets || [];

      if (sheets.length === 0) {
        this.sheetsModalList.innerHTML = '<p style="color: #64748b;">No saved spreadsheets found.</p>';
        return;
      }

      this.sheetsModalList.innerHTML = '';
      sheets.forEach(s => {
        const item = document.createElement('div');
        item.className = 'sheet-item';
        item.innerHTML = `
          <div class="sheet-item-info">
            <span class="sheet-item-title">${this.escapeHtml(s.title)}</span>
            <span class="sheet-item-date">Last saved: ${new Date(s.updatedAt).toLocaleString()}</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="padding: 4px 8px;"><i class="fa-solid fa-folder-open"></i> Open</button>
        `;
        item.addEventListener('click', () => {
          this.loadSheet(s.id);
          this.sheetsModal.classList.remove('active');
        });
        this.sheetsModalList.appendChild(item);
      });
    } catch (err) {
      this.sheetsModalList.innerHTML = `<p style="color: #ef4444;">Error loading sheets: ${err.message}</p>`;
    }
  }

  async loadSheet(id) {
    try {
      this.updateStatus('Loading sheet...');
      const res = await fetch(`/api/sheets/${id}`);
      if (!res.ok) throw new Error('Sheet not found');
      const data = await res.json();

      this.sheetData = data;
      this.titleInput.value = this.sheetData.title || 'Untitled Spreadsheet';
      this.renderTabs();
      this.renderGrid();
      this.updateStatus(`Loaded sheet: ${this.sheetData.title}`);
    } catch (err) {
      this.updateStatus(`Error loading sheet: ${err.message}`);
    }
  }

  createNewSheet() {
    this.sheetData = {
      id: `sheet_${Date.now()}`,
      title: 'Untitled Spreadsheet',
      rowCount: 50,
      colCount: 26,
      activeTab: 'Sheet1',
      tabs: [
        {
          id: 'Sheet1',
          name: 'Sheet1',
          cells: {}
        }
      ]
    };
    this.titleInput.value = this.sheetData.title;
    this.selectedCellRef = 'A1';
    this.renderTabs();
    this.renderGrid();
    this.updateStatus('Created new spreadsheet');
  }

  exportCsv() {
    window.location.href = `/api/sheets/${this.sheetData.id}/export/csv?tabId=${this.sheetData.activeTab}`;
  }

  async handleCsvFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    const csvText = await file.text();

    try {
      this.updateStatus('Importing CSV file...');
      const res = await fetch(`/api/sheets/import/csv?title=${encodeURIComponent(file.name.replace('.csv', ''))}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: csvText
      });
      const data = await res.json();
      if (data.success && data.sheet) {
        this.sheetData = data.sheet;
        this.titleInput.value = this.sheetData.title;
        this.renderTabs();
        this.renderGrid();
        this.updateStatus(`Successfully imported ${file.name}`);
      } else {
        this.updateStatus('CSV import failed');
      }
    } catch (err) {
      this.updateStatus(`CSV import error: ${err.message}`);
    }

    this.csvFileInput.value = '';
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.ingridApp = new IngridApp();
});
