```
 ██████╗███╗   ██╗ ██████╗  ██████╗  ██████╗
  ██║  ████╗  ██║██╔════╝  ██╔══██╗ ██╔══██╗
  ██║  ██╔██╗ ██║██║  ███╗ ██████╔╝ ██║  ██║  [v1.5 BETA]
  ██║  ██║╚██╗██║██║   ██║ ██╔══██╗ ██║  ██║
 ██████╗██║ ╚████║╚██████╔╝██║  ██║ ██████╔╝
 ╚═════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝
        INtelligent GRID spreadsheet engine 1.5
```

# Ingrid 1.5 [v1.5 BETA] — Google Sheets Edition

> **Ingrid 1.5** is a major update to the fast, local-first spreadsheet application built for localhost productivity. Redesigned with a clean, pixel-perfect **Google Sheets interface**, Ingrid 1.5 combines modern spreadsheet aesthetics with powerful productivity tools, state history, sorting, find & replace, and expanded formula capabilities.

---

## 🚀 What's New in Ingrid 1.5

* **🎨 Google Sheets Aesthetic Redesign**: Redesigned UI featuring Google Sheets color themes (`#0f9d58` green, `#1a73e8` blue), menu bar (File, Edit, View, Insert, Format, Data, Help), formula bar with `fx` indicator, cell selection outline, and status footer.
* **↩️ Undo / Redo History (Ctrl+Z / Ctrl+Y)**: Full state history stack enabling effortless undo and redo of cell edits, formatting, sorting, and structural changes.
* **🔤 Column Sorting (A-Z & Z-A)**: Instantly sort entire spreadsheets based on values in any selected column.
* **🔍 Find & Replace Tool (Ctrl+H)**: Modal tool to search across all grid cells and execute single or bulk replacements.
* **💬 Cell Notes & Comments**: Attach custom notes/comments to any cell with a Google Sheets-style red corner indicator popover.
* **🧮 Expanded 1.5 Formula Engine**: Support for 10 new built-in functions: `UPPER`, `LOWER`, `LEN`, `TRIM`, `ROUND`, `ABS`, `PRODUCT`, `MEDIAN`, `TODAY`, and `NOW`.

---

## 🌟 Core Features

* **⚡ Instant Localhost Performance**: Zero internet connection required. Runs entirely on your local machine with lightweight backend JSON persistence.
* **🧮 Interactive Formula Engine**: Evaluates arithmetic expressions, cell references (`A1`, `B2`), ranges (`A1:C10`), and built-in functions in real-time.
* **🎨 Rich Cell Styling & Formatting**: Custom styling including **Bold**, *Italics*, Underline, custom text and background colors, text alignment, and number formatting (Currency `$`, Percentage `%`, Decimals).
* **📄 Multi-Tab Spreadsheets**: Work on multiple sheets (`Sheet1`, `Sheet2`, ...) within a single spreadsheet file.
* **📊 Row & Column Dynamic Expansion**: Expand grid dimensions on demand.
* **📁 Local Storage & Saved Manager**: Built-in JSON storage manager to save, load, list, and delete local spreadsheet projects.
* **🔁 CSV Import & Export**: Import existing CSV datasets or export fully-evaluated spreadsheets directly to CSV files.

---

## 🚀 Quick Start & Installation

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Step-by-Step Setup

1. **Clone & Install Dependencies**
   ```bash
   git clone https://github.com/chambtai-sys/Ingrid.git
   cd ingrid
   npm install
   ```

2. **Start the Local Server**
   ```bash
   npm start
   ```

3. **Open Ingrid in Your Browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to start using Ingrid 1.5!

---

## 📐 Formula Reference Guide (Ingrid 1.5)

Ingrid formulas begin with an `=` sign and support case-insensitive functions, operators, and cell ranges:

| Function | Example Formula | Description |
| :--- | :--- | :--- |
| **Arithmetic** | `= (A1 + B1) * 2 ^ 3` | Basic math with standard operator precedence. |
| **SUM** | `=SUM(A1:A10)` | Total sum of numeric values in a range. |
| **AVERAGE** | `=AVERAGE(B1:B20)` | Arithmetic mean of numbers in a range. |
| **COUNT** | `=COUNT(C1:C50)` | Count non-empty numeric cells in a range. |
| **MIN / MAX** | `=MIN(A1:D10)`, `=MAX(A1:D10)` | Minimum or maximum numeric value in a range. |
| **PRODUCT** | `=PRODUCT(A1:A5)` | Multiplies all numbers in a range. |
| **MEDIAN** | `=MEDIAN(B1:B9)` | Middle value of a sorted range of numbers. |
| **ROUND** | `=ROUND(A1, 2)` | Rounds number to specified decimal places. |
| **ABS** | `=ABS(A1)` | Absolute value of a number. |
| **UPPER / LOWER** | `=UPPER("ingrid")`, `=LOWER("INGRID")` | Converts text to uppercase or lowercase. |
| **TRIM / LEN** | `=TRIM(A1)`, `=LEN(A1)` | Trims whitespace or returns string character length. |
| **IF** | `=IF(A1 > 50, "Pass", "Fail")` | Conditional evaluation based on logic statements. |
| **CONCAT** | `=CONCAT("Total: ", A1)` | Concatenates text strings or cell values. |
| **TODAY / NOW** | `=TODAY()`, `=NOW()` | Current date (`YYYY-MM-DD`) or timestamp. |

---

## 🛠️ API Documentation

Ingrid provides a clean REST API for local file interactions:

* `GET /api/sheets`: Lists all saved spreadsheets with metadata.
* `GET /api/sheets/:id`: Loads a specific spreadsheet JSON object.
* `POST /api/sheets`: Saves or updates a spreadsheet JSON object (including version 1.5 cell comments & formatting).
* `DELETE /api/sheets/:id`: Removes a spreadsheet by ID.
* `GET /api/sheets/:id/export/csv`: Exports evaluated spreadsheet cells to downloadable `.csv`.
* `POST /api/sheets/import/csv`: Parses uploaded CSV file text and returns a new spreadsheet object.

---

## 🧪 Testing

Run the full automated test suite (Formula Engine + Express API server):

```bash
npm test
```

---

## 📄 License

Distributed under the MIT License.
