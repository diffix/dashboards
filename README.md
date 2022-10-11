# Diffix Dashboards

Desktop application for producing anonymized dashboards using Open Diffix

## Local development

### Linux

1. Install PostgreSQL, ensure that `pg_config` is in your `PATH`
2. `npm install`

### Windows

1. Download the stand-alone binaries from https://www.enterprisedb.com/download-postgresql-binaries (version 14.5).
2. Extract the `pgsql` folder to `gui` subfolder in repo root.
2. Remove unnecessary subfolders from `pgsql` - keep only `share`, `StackBuilder`, `bin`, `lib`.
3. Build and install `pg_diffix` according to its instructions, pointing to the `pgsql` folder as `PGROOT`
4. `npm install`
5. `npm run start` should work now

## Packaging distribution bundles

### Linux

TBD but not supported at this point

### Windows

1. `npm run make`
