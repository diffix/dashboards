# GUI for the BI Diffix tools

TODO

## To use

## Development

Run `asdf install` to install `node` via `asdf`.
Run `npm install` to install dependencies.

Following the setup, run `npm start` to start the development environment with hot code reloading.

Before committing, make sure to lint and format your code with `npm run lint` and `npm run format`.

## Making a release

1. Make sure there is a new section titled "### Next version" in the changelog, listing the most recent changes.

2. Execute `npm version [major|minor|patch]` in a clean working folder.

  This will bump and update the app version, create a commit for the new release, tag it and push it to GitHub.
  A draft release will be then created automatically on GitHub.

3. After making sure the generated assets are OK, the release can be published manually in the GitHub UI.
