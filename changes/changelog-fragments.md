### Changed

- Release notes are now written as one small file per change in `changes/`, which a release
  stamps into CHANGELOG.md (`pnpm changelog:stamp`, `pnpm changelog:preview`). CI fails a pull
  request that adds lines under `## [Unreleased]` or a malformed change file.
