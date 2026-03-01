# CRUD Template

A complete Create-Read-Update-Delete app template. This provides a solid foundation for apps that manage records with a database backend.

## Structure

```
crud/
├── README.md              # This file
├── app.yaml               # App manifest
├── page.tsx               # Main list view
├── new/
│   └── page.tsx          # Create item page
├── [id]/
│   └── page.tsx          # Edit item page
├── api/
│   └── items/
│       ├── route.ts      # List all items
│       ├── create/
│       │   └── route.ts  # Create new item
│       ├── [id]/
│       │   └── route.ts  # Get single item
│       └── update/
│           └── route.ts  # Update/delete item
└── migrations/
    └── 001_initial.sql   # Database schema
```

## Features

- **List View**: Displays all items in a clean list/table format
- **Create**: Form to add new items
- **Edit**: Form to modify existing items
- **Delete**: Remove items with confirmation
- **Search**: Client-side filtering of the list
- **Validation**: Form validation before submission
- **Optimistic UI**: Immediate feedback on actions

## Getting Started

1. Copy this directory to `apps/my-app/`
2. Edit `app.yaml` - change `id` and `name`
3. Customize the item fields in:
   - `migrations/001_initial.sql` (database schema)
   - `page.tsx` (list columns)
   - `new/page.tsx` and `[id]/page.tsx` (forms)
   - API routes (field handling)
4. Restart the Citadel host
5. Visit `/apps/my-app` to see your CRUD app

## Customizing Fields

To change the item structure (e.g., from `title`/`description` to `name`/`email`/`phone`):

1. Update the SQL schema in `migrations/001_initial.sql`
2. Update the TypeScript interfaces in each file
3. Update the form inputs and list display columns

## Next Steps

- Add sorting (click column headers)
- Add pagination for large datasets
- Add server-side search
- Add export to CSV
- Add bulk actions (delete selected)
