# LedgerPulse Expense Tracker

LedgerPulse is a modern, high-performance personal finance management application designed for precision budgeting, expense tracking, and predictive financial forecasting. Built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Recharts**, LedgerPulse combines real-time daily spend monitoring with automated recurring subscriptions and comparative analytics.

---

## Key Features

### 1. Daily Spend Tracker
- **Real-Time Daily Budget Gauge**: Monitor your daily spending pace relative to your automatic or custom daily target.
- **Frequent Expenses Quick-Log**: One-click logging for everyday purchases (e.g., "Morning Coffee", "Lunch", "Subway Fare") with pre-configured amounts and categories.
- **Daily Calendar Navigator**: Quickly inspect past and future days with visual spend indicators.
- **Immediate Categorization**: Real-time category allocation and payment method breakdowns for each day.

### 2. Monthly Budget & Savings Goals
- **Month-to-Date Pacing & Variance**: Visual burn-down tracking comparing cumulative monthly spending against your budget ceiling.
- **End-of-Month Run-Rate Projection**: Predictive forecasting that estimates your total end-of-month spend based on current and historical daily velocity.
- **Savings Goals Tracker**: Define target amounts and target categories for long-term savings goals with quick-deposit increments and progress meters.
- **Top Merchants & Payment Methods**: Identify top spending venues and breakdown across credit cards, debit cards, cash, and digital wallets.

### 3. Financial Forecast & Visual Projections (Insights Tab)
- **Predictive Run-Rate Engine**: Blends current-month trajectory, multi-week historical averages, and distinct weekday vs. weekend spending cadences.
- **Interactive Recharts Projection Chart**:
  - **Actual Cumulative Spend**: Solid line tracking recorded expenditures day-by-day.
  - **Projected Run-Rate Trajectory**: Seamlessly connects from the current date through month-end as a dashed forecasting line.
  - **Budget Ceiling Reference Line**: Horizontal ceiling marker for instant target comparisons.
  - **Ideal Linear Pace**: Dotted baseline illustrating steady burn-rate throughout the month.
  - **Confidence Corridor**: Low-spend discipline (-12%) and surge risk (+18%) bounds.
- **Scenario Modeling**: Switch between **Blended Run-Rate**, **7-Day Velocity Pace**, **Disciplined Saver**, and **Upper Surge Risk**.
- **Category-Level Forecast Breakdown**: Expandable breakdown forecasting each category's end-of-month total against allocated budget limits.

### 4. 30-Day Comparative Velocity & Label Analytics
- **30-Day Multi-Line Comparison**: Side-by-side graph comparing daily spend over the last 30 days against the preceding 30-day window, with support for **Daily Total**, **7-Day Rolling Average**, and **Cumulative Pace**.
- **Tag & Label Allocation Donut Chart**: Interactive Recharts Donut chart visualizing expenses categorized by custom tags (e.g., `#Personal`, `#Work`, `#Project X`).
- **Financial Health Score**: Algorithmic financial health assessment (0–100) with diagnostic key findings and actionable savings strategies.

### 5. Transaction Ledger & Search
- **Dedicated Search Bar**: Real-time filtering across merchant names and notes.
- **Search Scope Selector**: Toggle between **Merchant or Notes**, **Merchant Only**, and **Notes Only**.
- **Search Highlighting**: Highlights matching search terms directly in merchant names and transaction notes.
- **Advanced Filtering**: Filter by category, payment method, tag, recurrence type, or custom date ranges.
- **Data Export**: Export your entire ledger or filtered views to **CSV** and **JSON**.

### 6. Recurring Subscriptions & Automation
- Automated detection and logging of recurring bills (weekly, monthly, quarterly, yearly).
- Monthly projection of fixed subscription overhead.

### 7. Smart Expense Modal & Receipt Scanner Simulation
- Log one-off or recurring expenses with full tag, category, and payment method attribution.
- **Camera / Receipt Scanner Simulation**: Auto-fills merchant, amount, and category fields by simulating receipt OCR.

### 8. User Experience & Design
- **Collapsible Sidebar**: Space-efficient navigation with collapsible desktop sidebar and responsive mobile drawer.
- **Theme Toggle**: High-contrast Dark Mode and Light Mode with persistent `localStorage` synchronization.
- **Zero Mock API Dependencies**: Runs completely in the browser with persistent `localStorage` storage and optional Node/Express full-stack backend.

---

## Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Charts & Data Visualization**: [Recharts 3](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend / Dev Server**: [Express](https://expressjs.com/) via `tsx`
- **Animation**: [Motion](https://motion.dev/)

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **bun**

### Installation

1. Clone or open the project directory:
   ```bash
   cd /path/to/ledgerpulse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application runs by default on port `3000` (e.g., `http://localhost:3000`).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Express server with Vite middleware on port 3000 |
| `npm run build` | Compiles TypeScript and builds production assets with Vite |
| `npm run lint` | Runs TypeScript compilation check (`tsc --noEmit`) |
| `npm run preview` | Previews the compiled production build locally |
| `npm run clean` | Removes build artifacts (`dist` and `server.js`) |

---

## Project Structure

```text
├── index.html               # Main HTML entry point
├── package.json             # App dependencies and scripts
├── server.ts                # Express development and production server
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── src/
    ├── App.tsx              # Root app component and state orchestration
    ├── main.tsx             # Application bootstrap
    ├── index.css            # Global Tailwind CSS imports
    ├── types.ts             # TypeScript interfaces and data models
    ├── components/
    │   ├── BudgetModal.tsx     # Monthly budget and savings goal configuration
    │   ├── DailyTracker.tsx    # Daily spend gauge and frequent expense shortcuts
    │   ├── ExpenseList.tsx     # Transaction ledger with search, filtering, and export
    │   ├── ExpenseModal.tsx    # Expense creation/edit form with receipt scan simulation
    │   ├── InsightsView.tsx    # Financial forecast, 30-day velocity, and label donut chart
    │   ├── MonthlyTracker.tsx  # Monthly overview, burn pacing, and savings progress
    │   ├── RecurringView.tsx   # Recurring subscriptions and automated rules
    │   ├── Sidebar.tsx         # Collapsible desktop sidebar and mobile navigation drawer
    │   └── TopNav.tsx          # Top header with quick-action buttons and theme toggle
    ├── data/
    │   └── sampleExpenses.ts   # Default categories, colors, presets, and seed data
    └── utils/
        ├── formatters.ts       # Currency/date formatting and run-rate predictive functions
        ├── recurring.ts        # Automated recurrence engine
        └── storage.ts          # LocalStorage persistence, CSV, and JSON export utilities
```

---

## License

MIT License. Designed and built with Google AI Studio.
