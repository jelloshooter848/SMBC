# Change notes for the next release

Every pull request with a user-facing change adds **one new file** here instead of editing
CHANGELOG.md. New files never conflict, so pull requests built side by side merge cleanly. The
release stamp (`pnpm changelog:stamp`) turns them into the next `## [x.y.z]` section of
[CHANGELOG.md](../CHANGELOG.md) and deletes them. This README is not a fragment and stays.

## The format

- **Name:** a short lowercase slug for the change, `changes/<slug>.md` (letters, digits and
  `-`), for example `changes/classic-save-files.md`.
- **First line:** one of `### Added`, `### Changed`, `### Fixed` or `### Removed`.
- **Then** one or more `- ` bullets, written for players as in CHANGELOG.md: what changed, not
  which files. A long bullet wraps onto lines indented by two spaces. Blank lines are ignored.
- A change that needs two groups puts the second heading and its bullets below the first
  (each group once per file).

```md
### Fixed

- Classic mode: quitting a practice run goes back to the map set it was played from, not
  Super Mario Bros.
```

## Commands

- `pnpm changelog:preview` prints the next release's section as it stands.
- `pnpm release:check` (CI, on every push and pull request) fails on a malformed fragment and
  on any text under `## [Unreleased]` in CHANGELOG.md.
- `pnpm changelog:stamp <version> <date>` stamps the release (see
  [docs/RELEASING.md](../docs/RELEASING.md)); `--dry-run` prints the section and writes nothing.

In the stamped section the groups follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
order (Added, Changed, Removed, Fixed), and inside a group the bullets follow the fragments'
file names.
