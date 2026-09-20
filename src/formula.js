/**
 * Ingrid Formula Parser and Evaluator Engine
 */

/**
 * Convert column letter(s) (e.g. "A", "Z", "AA") to 0-indexed column index.
 */
function colLetterToIndex(colStr) {
  let index = 0;
  const uppercaseStr = colStr.toUpperCase();
  for (let i = 0; i < uppercaseStr.length; i++) {
    index = index * 26 + (uppercaseStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert 0-indexed column index to letter(s) (e.g. 0 -> "A", 25 -> "Z", 26 -> "AA").
 */
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

/**
 * Parse a cell reference string like "A1" or "B12" into { col: number, row: number }.
 * Returns null if invalid format.
 */
function parseCellRef(refStr) {
  const match = /^([A-Za-z]+)([1-9][0-9]*)$/.exec(refStr.trim());
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1; // 0-indexed
  return { col, row, colStr: match[1].toUpperCase(), rowStr: match[2] };
}

/**
 * Expand range string like "A1:B3" into list of cell ref strings ["A1", "A2", "A3", "B1", "B2", "B3"].
 */
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

/**
 * Evaluates formula string or raw value using a getCellValue getter function: (refStr: string) => number|string|null.
 * Prevents circular dependency stack overflows with visitingSet.
 */
function evaluateFormula(expr, getCellValue, visitingSet = new Set()) {
  if (typeof expr !== 'string') {
    return expr ?? '';
  }

  const trimmed = expr.trim();
  if (!trimmed.startsWith('=')) {
    // Attempt numeric conversion if possible, else return string
    if (trimmed !== '' && !isNaN(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  }

  const formulaContent = trimmed.substring(1).trim();
  if (!formulaContent) return '';

  try {
    const tokens = tokenize(formulaContent);
    const parser = new Parser(tokens, getCellValue, visitingSet);
    const result = parser.parseExpression();
    return result;
  } catch (err) {
    if (err.message && err.message.startsWith('#')) {
      return err.message;
    }
    return '#ERROR!';
  }
}

// Tokenizer
function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9]/.test(char) || (char === '.' && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      let numStr = '';
      while (i < input.length && (/[0-9]/.test(input[i]) || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    // String literal in double quotes
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
      if (i < input.length && input[i] === '"') {
        i++; // skip closing quote
      }
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Identifiers (Functions, Cell References, Ranges) or comparison operators
    if (/[A-Za-z_]/.test(char)) {
      let id = '';
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        id += input[i];
        i++;
      }

      // Check if followed by ':' for range like A1:B3
      if (i < input.length && input[i] === ':') {
        i++; // consume ':'
        let endId = '';
        while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
          endId += input[i];
          i++;
        }
        tokens.push({ type: 'RANGE', value: `${id.toUpperCase()}:${endId.toUpperCase()}` });
        continue;
      }

      // Check if followed by '(' -> function call
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

    // Two-character operators: <=, >=, <>, ==
    if (i + 1 < input.length) {
      const two = input.substring(i, i + 2);
      if (['<=', '>=', '<>', '=='].includes(two)) {
        tokens.push({ type: 'OPERATOR', value: two });
        i += 2;
        continue;
      }
    }

    // Single character operators & delimiters
    if (['+', '-', '*', '/', '^', '=', '<', '>', '(', ')', ',', ':'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    throw new Error(`#SYNTAX! Unknown character: ${char}`);
  }

  return tokens;
}

// Parser
class Parser {
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

      let isEq = false;
      if (op === '=' || op === '==') isEq = left == right;
      else if (op === '<>') isEq = left != right;
      else if (op === '<') isEq = left < right;
      else if (op === '>') isEq = left > right;
      else if (op === '<=') isEq = left <= right;
      else if (op === '>=') isEq = left >= right;

      return isEq;
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
        if (op === '/' && rNum === 0) {
          throw new Error('#DIV/0!');
        }
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

    // Unary plus/minus
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
      let rawVal = null;
      if (this.getCellValue) {
        rawVal = this.getCellValue(refKey);
      }

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
      this.consume(); // '('
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
    const fnToken = this.consume(); // FUNCTION token
    const fnName = fnToken.value;

    const openParen = this.consume();
    if (!openParen || openParen.type !== 'OPERATOR' || openParen.value !== '(') {
      throw new Error('#SYNTAX!');
    }

    // Collect function arguments
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
            if (typeof val === 'string' && val.startsWith('#')) {
              throw new Error(val);
            }
            if (val !== '' && val !== null && val !== undefined) {
              rangeValues.push(val);
            }
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

    // Execute functions
    return this.evaluateBuiltinFunction(fnName, args);
  }

  evaluateBuiltinFunction(fnName, args) {
    const flattenNumbers = (argList) => {
      const result = [];
      const recurse = (item) => {
        if (Array.isArray(item)) {
          item.forEach(recurse);
        } else {
          const n = Number(item);
          if (!isNaN(n) && item !== '' && item !== null && item !== undefined) {
            result.push(n);
          }
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
        const sum = nums.reduce((acc, curr) => acc + curr, 0);
        return sum / nums.length;
      }
      case 'COUNT': {
        const nums = flattenNumbers(args);
        return nums.length;
      }
      case 'MIN': {
        const nums = flattenNumbers(args);
        if (nums.length === 0) return 0;
        return Math.min(...nums);
      }
      case 'MAX': {
        const nums = flattenNumbers(args);
        if (nums.length === 0) return 0;
        return Math.max(...nums);
      }
      case 'IF': {
        if (args.length < 2) throw new Error('#VALUE!');
        const condition = Boolean(args[0]);
        if (condition) {
          return args[1];
        } else {
          return args.length >= 3 ? args[2] : false;
        }
      }
      case 'CONCAT':
      case 'CONCATENATE': {
        const flattenStrings = (argList) => {
          let str = '';
          const recurse = (item) => {
            if (Array.isArray(item)) {
              item.forEach(recurse);
            } else if (item !== null && item !== undefined) {
              str += String(item);
            }
          };
          argList.forEach(recurse);
          return str;
        };
        return flattenStrings(args);
      }
      case 'UPPER': {
        if (args.length === 0) return '';
        return String(args[0]).toUpperCase();
      }
      case 'LOWER': {
        if (args.length === 0) return '';
        return String(args[0]).toLowerCase();
      }
      case 'LEN': {
        if (args.length === 0) return 0;
        return String(args[0]).length;
      }
      case 'TRIM': {
        if (args.length === 0) return '';
        return String(args[0]).trim();
      }
      case 'ROUND': {
        if (args.length === 0) throw new Error('#VALUE!');
        const num = Number(args[0]);
        if (isNaN(num)) throw new Error('#VALUE!');
        const decimals = args.length >= 2 ? Number(args[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
      }
      case 'ABS': {
        if (args.length === 0) throw new Error('#VALUE!');
        const num = Number(args[0]);
        if (isNaN(num)) throw new Error('#VALUE!');
        return Math.abs(num);
      }
      case 'PRODUCT': {
        const nums = flattenNumbers(args);
        if (nums.length === 0) return 0;
        return nums.reduce((acc, curr) => acc * curr, 1);
      }
      case 'MEDIAN': {
        const nums = flattenNumbers(args);
        if (nums.length === 0) throw new Error('#DIV/0!');
        nums.sort((a, b) => a - b);
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }
      case 'TODAY': {
        const now = new Date();
        return now.toISOString().split('T')[0];
      }
      case 'NOW': {
        return new Date().toLocaleString();
      }
      default:
        throw new Error('#NAME?');
    }
  }
}

module.exports = {
  colLetterToIndex,
  indexToColLetter,
  parseCellRef,
  expandRange,
  evaluateFormula,
  tokenize
};
