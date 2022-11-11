# Diffix Dashboards

Desktop application for producing anonymized dashboards using Open Diffix.

## Development

Run `git submodule update --init`.
Run `asdf install` to install `node` via `asdf`.
Run `npm install` to install dependencies.

Build required services:

On Windows:

- Install VS 2019 with "Desktop development with C++" selected;
- Run `npm run build-win`.

On Linux:

- Install PostgreSQL (and ensure that `pg_config` is in your `PATH`);
- Install pg_diffix;
- Download JDK compatible with Metabase;
- Download Metabase JAR file and use `jpackage` to bundle it into a runtime image.
  - `metabase.jar` should be placed in the `metabase_jar` folder inside `gui`
  - invoke from `gui` folder using: `jpackage --type app-image -i metabase_jar -n metabase --main-jar metabase.jar`

Following the setup, run `npm start` to start the development environment with hot code reloading.

Before committing, make sure to lint and format your code with `npm run lint` and `npm run format`.

## Making a release

1. Make sure there is a new section titled "### Next version" in the changelog, listing the most recent changes.

2. Execute `npm version [major|minor|patch]` in a clean working folder.

This will bump and update the app version, create a commit for the new release, tag it and push it to GitHub.
A draft release will be then created automatically on GitHub.

3. After making sure the generated assets are OK, the release can be published manually in the GitHub UI.
