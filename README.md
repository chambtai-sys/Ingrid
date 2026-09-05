```
 ██████╗███╗   ██╗ ██████╗  ██████╗  ██████╗
  ██║  ████╗  ██║██╔════╝  ██╔══██╗ ██╔══██╗
  ██║  ██╔██╗ ██║██║  ███╗ ██████╔╝ ██║  ██║  [BETA]
  ██║  ██║╚██╗██║██║   ██║ ██╔══██╗ ██║  ██║
 ██████╗██║ ╚████║╚██████╔╝██║  ██║ ██████╔╝
 ╚═════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝
        INtelligent GRID spreadsheet engine
```

# Ingrid [BETA]

> **Ingrid** is a high-performance, local-first spreadsheet application built specifically for localhost productivity. Designed with speed, privacy, and simplicity in mind, Ingrid brings spreadsheet creation and analysis directly to your local environment.

---

## 🌟 Key Features

* **⚡ Instant Localhost Performance**: Zero internet connection required. Runs entirely on your local machine with lightweight backend JSON persistence.
* **🧮 Interactive Formula Engine**: Evaluates arithmetic expressions, cell references (`A1`, `B2`), ranges (`A1:C10`), and built-in functions in real-time.
* **🎨 Rich Cell Styling & Formatting**: Custom styling including **Bold**, *Italics*, Underline, custom text and background colors, text alignment, and number formatting (Currency `$`, Percentage `%`, Decimals).
* **📄 Multi-Tab Spreadsheets**: Work on multiple sheets (`Sheet1`, `Sheet2`, ...) within a single spreadsheet file.
* **📊 Row & Column Dynamic Expansion**: Effortlessly expand grid dimensions on demand.
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
   git clone <repository-url>
   cd ingrid
   npm install
   ```

2. **Start the Local Server**
   ```bash
   npm start
   ```

3. **Open Ingrid in Your Browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to start using Ingrid!

---

## 📐 Formula Reference Guide

Ingrid formulas begin with an `=` sign and support case-insensitive functions, operators, and cell ranges:

| Category | Example Formula | Description |
| :--- | :--- | :--- |
| **Arithmetic** | `= (A1 + B1) * 2 ^ 3` | Basic math with standard operator precedence. |
| **SUM** | `=SUM(A1:A10)` | Calculates the total sum of all numeric values in a range. |
| **AVERAGE** | `=AVERAGE(B1:B20)` | Computes the arithmetic mean of numbers in a range. |
| **COUNT** | `=COUNT(C1:C50)` | Counts non-empty numeric cells within a range. |
| **MIN / MAX** | `=MIN(A1:D10)`, `=MAX(A1:D10)` | Resolves minimum or maximum numeric value in a range. |
| **Logic (IF)** | `=IF(A1 > 50, "Pass", "Fail")` | Conditional evaluation based on logic statements. |
| **String (CONCAT)** | `=CONCAT("Total: ", A1)` | Concatenates text strings or cell values together. |

---

## 🛠️ API Documentation

Ingrid provides a clean REST API for local file interactions:

* `GET /api/sheets`: Lists all saved spreadsheets with metadata.
* `GET /api/sheets/:id`: Loads a specific spreadsheet JSON object.
* `POST /api/sheets`: Saves or updates a spreadsheet JSON object.
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
