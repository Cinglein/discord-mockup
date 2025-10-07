# Axum Next.js Template

To initialize the SqLite DB for query macros:

```bash
echo DATABASE_URL=sqlite://dev.db > .env
sqlx database create
```

Add migrations with `sqlx migrate add <name>`

Run migrations with `sqlx migrate run`
