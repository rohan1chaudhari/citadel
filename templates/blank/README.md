# Blank Template

The minimal starting point for a Citadel app. This template provides the absolute essentials: a manifest, a single page, and one API route.

## Structure

```
blank/
├── README.md           # This file
├── app.yaml            # App manifest (required)
├── page.tsx            # Main UI page
└── api/
    └── hello/
        └── route.ts    # Example API route
```

## Files

### app.yaml
The manifest declares your app's identity and permissions. Every app must have one.

### page.tsx
A simple React Server Component that displays a greeting. Uses the Shell component for consistent styling.

### api/hello/route.ts
A minimal API route demonstrating how to read from and write to the database.

## Getting Started

1. Copy this directory to `apps/my-app/`
2. Edit `app.yaml` - change `id` and `name` to your app's identity
3. Edit `page.tsx` and `api/` routes to implement your features
4. Restart the Citadel host (or wait for hot-reload in dev mode)
5. Visit `/apps/my-app` to see your app

## Next Steps

- Add more pages by creating additional `page.tsx` files in subdirectories
- Add migrations in `migrations/001_initial.sql` for database schema
- Request permissions in `app.yaml` for db, storage, ai, or network
- See the `crud` template for a more complete example with list/create/edit/delete
