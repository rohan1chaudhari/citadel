# Dashboard Template

A read-only data visualization template for displaying metrics and statistics. Perfect for analytics, monitoring, and reporting apps.

## Structure

```
dashboard/
├── README.md              # This file
├── app.yaml               # App manifest
├── page.tsx               # Main dashboard page
├── DashboardClient.tsx    # Interactive dashboard component
├── api/
│   └── stats/
│       └── route.ts       # API endpoint for data (optional)
└── migrations/
    └── 001_initial.sql    # Sample data schema
```

## Features

- **Summary Cards**: High-level metrics at a glance
- **Category Filtering**: Filter data by category
- **Simple Bar Charts**: Visual trends using CSS bars
- **Data Table**: Sortable, scrollable data view
- **Responsive Design**: Works on desktop and mobile

## Data Model

The template uses a simple `metrics` table:

```sql
CREATE TABLE metrics (
  id INTEGER PRIMARY KEY,
  category TEXT,      -- Grouping field (e.g., 'sales', 'users')
  label TEXT,         -- Display label (e.g., 'Jan 2024')
  value REAL,         -- Numeric value
  unit TEXT,          -- Optional unit ('$', '%', etc.)
  created_at TEXT     -- Timestamp
);
```

## Getting Started

1. Copy this directory to `apps/my-dashboard/`
2. Edit `app.yaml` - change `id` and `name`
3. Customize the data in `migrations/001_initial.sql`
4. Restart the Citadel host
5. Visit `/apps/my-dashboard` to see your dashboard

## Customizing Data

Replace the sample INSERT statements in `001_initial.sql` with your actual data structure. You can:

- Add more categories
- Change the time range
- Add new metrics
- Modify units and labels

## Adding Real Charts

The template includes a simple CSS bar chart. For production use, consider adding a charting library:

```bash
npm install recharts
```

Then replace the bar chart section in `DashboardClient.tsx` with Recharts components.

## API Integration

The template reads directly from the database on page load. For dynamic updates:

1. Poll the API route periodically
2. Use Server-Sent Events (SSE) for real-time updates
3. Add refresh buttons for manual updates

## Next Steps

- Connect to live data sources via API
- Add date range pickers
- Implement export functionality (CSV, PDF)
- Add user preferences for default views
- Set up automated alerts for threshold violations
