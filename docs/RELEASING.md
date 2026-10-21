# Releases and versions

The live site on GitHub Pages changes only when a version is released. Each release has a tag
(`v0.2.0`), a section in [CHANGELOG.md](../CHANGELOG.md), a GitHub Release with those notes and a
zipped build, and the same version on the title screen, so a tester's report always names a build
anyone can find again.

## Version numbers

[Semantic Versioning](https://semver.org/spec/v2.0.0.html), with the pre-1.0 rules:

| Change                                                                                                                                                | Bump                 | Example       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- |
| New player-facing features or content: worlds, heroes, modes, the map, editor features                                                                | minor: `0.MINOR.0`   | 0.1.0 → 0.2.0 |
| A save-file or settings format change that needs a migration                                                                                          | minor: `0.MINOR.0`   | 0.2.0 → 0.3.0 |
| Fixes, and changes players don't see: dev-mode tools, docs, build and release tooling, optional save fields that older saves load without a migration | patch: `0.x.PATCH`   | 0.2.0 → 0.2.1 |
| A build for testers before a release                                                                                                                  | pre-release: `-rc.N` | 0.3.0-rc.1    |
| Chapter 1, the story campaign, opens for everyone (docs/ROADMAP.md "The plan")                                                                        | `1.0.0`              |               |

The plan (owner, 2026-10-20): **0.5.0** is the Classic remake, **0.6.0 to 0.9.x** add new heroes through the
Expansion heroes option, and **1.0.0** opens Chapter 1. Until then the campaign shows "CHAPTER 1 COMING SOON!"
outside dev mode (`Game.campaignOpen`, `src/game/scenes/chapter1-gate.ts`); its save files, codes and links are
kept untouched. After 1.0.0 the usual SemVer rules apply (major for breaking changes such as dropping old saves).

## The changelog

[CHANGELOG.md](../CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

- Every pull request with a user-facing change adds a line under `## [Unreleased]`, in the right
  group: `### Added`, `### Changed`, `### Fixed` or `### Removed` (create the group if it is
  missing). Write for players: what changed, not which files. Internal-only changes (tests,
  tooling, refactors) need no entry. The pull request template has a checkbox for this.
- `## [Unreleased]` always exists, even when empty.
- A release renames the Unreleased entries to `## [x.y.z] - YYYY-MM-DD` (the release date) and
  starts a new empty `## [Unreleased]` above it.
- The link footers at the bottom compare tags: `[Unreleased]` compares the newest tag with `HEAD`,
  and each version links to its release (or compares it with the previous tag).

`pnpm release:check` (run by CI on every push and pull request) checks that `package.json` has a
valid SemVer version and that CHANGELOG.md has `## [Unreleased]`. With `--tag vX.Y.Z` it also
checks that the tag is `v` + the `package.json` version and that a dated `## [X.Y.Z]` section
exists; `--notes` prints that section, which becomes the GitHub Release notes:

```sh
pnpm release:check
pnpm -s release:check --tag v0.2.0 --notes
```

## Releasing a version

1. Open a pull request named **Release vX.Y.Z** that only:
   - sets `"version": "X.Y.Z"` in `package.json`;
   - in CHANGELOG.md, turns `## [Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD`, adds a new empty
     `## [Unreleased]` above it, and updates the footers:
     ```
     [Unreleased]: https://github.com/jelloshooter848/SMBC/compare/vX.Y.Z...HEAD
     [X.Y.Z]: https://github.com/jelloshooter848/SMBC/compare/vPREVIOUS...vX.Y.Z
     ```
   - passes `pnpm release:check --tag vX.Y.Z` locally.
2. Merge it into `main`. Nothing deploys yet.
3. Tag the merge commit and push the tag:
   ```sh
   git checkout main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
   Or create the release in the GitHub UI (Releases → Draft a new release → new tag `vX.Y.Z`
   on `main`); the workflow then fills in its notes and the zip.
4. The **Release** workflow (`.github/workflows/release.yml`) runs on the tag: it checks the tag
   against `package.json` and the changelog, runs lint, typecheck and tests, builds with
   `RELEASE_TAG`, deploys GitHub Pages, and creates (or updates) the GitHub Release with the
   changelog section as notes and two zips attached: `smbc-remix-vX.Y.Z.zip` (the site) and
   `smbc-remix-vX.Y.Z-offline.zip` (the download, below). Releases before 0.5.0 named them
   `smbc-vX.Y.Z.zip` and `smbc-vX.Y.Z-offline.zip`. If any check fails nothing is
   deployed: fix it on `main`, delete the tag (`git push --delete origin vX.Y.Z`,
   `git tag -d vX.Y.Z`) and tag again.

Tags are public and permanent in practice: never move a tag that has been released; release a
patch instead.

The zip is the exact site that was deployed. It is built for the `/SMBC/` path, so serve it from
a folder of that name (for example `mkdir SMBC && unzip smbc-remix-v0.5.0.zip -d SMBC && npx serve .`
then open `/SMBC/`).

### The download: `smbc-remix-vX.Y.Z-offline.zip`

For players who want the game on their disk (PC, Mac or Linux): unzip, double-click
`index.html`, and play offline with nothing to install and no server. Tested in Chrome; it
should work in Edge, Firefox and Safari (try them by hand before saying so in `README.txt`). The
zip holds two files:

- `index.html`: the whole game in one file, from `pnpm build:offline` (Vite's `offline` mode,
  written to `dist-offline/`). `tools/offline/plugin.ts` puts the script inside the page as one
  inline module (a file:// page can't load module scripts from other files) and the favicon as
  a data: URL; art, music and levels are already in the script. There is no service worker,
  manifest or Home Screen icon, and Options has no ADD TO HOME SCREEN row there.
- `README.txt`: what it is, "double-click index.html", how to carry saves over with save codes,
  and the browsers it was tested in (`tools/offline/README.txt`, with the version filled in).

Opened from the disk, the game keeps its own saves (the browser's storage for file:// pages,
apart from the website's). On its first launch it says so once, waiting for a press, and points
to Options → Save files → COPY CODE / PASTE CODE. Chrome and Edge share one storage for all
local files; Firefox keeps it per folder, so a copy moved to another folder starts empty (the
README says to carry saves with a code, or update in the same folder).

Links the download shares (save codes' resume links, the level editor's SHARE) are made on the
public site, `SITE_URL` in `src/engine/site.ts`, never on its file:// address.

`tests/tools/offline.test.ts` builds it and checks it is one file with no outside script, style
or link. Play-test it from disk before a release by opening `dist-offline/index.html` in a
browser (no `pnpm preview`): the title, the save note, a level, and a reload keeping the save.

### One-time setup: the dev-mode passphrase

Release builds open developer mode only with the owner's passphrase (`src/game/dev-lock.ts`):
the title's developer code opens a prompt, and `?dev=1` does nothing. Local and other non-release
builds (`pnpm dev`, CI, branches) keep dev mode open as before. Set the passphrase once:

1. On GitHub: the repository's **Settings → Secrets and variables → Actions → New repository
   secret**.
2. Name: `DEV_MODE_PASSPHRASE`. Secret: the passphrase. **The rule: 6 to 32 characters, only
   A-Z, 0-9 and `-`, case-insensitive** (no spaces, no other symbols): that is all the game's
   prompt can type. A secret that breaks the rule fails the release at the "Dev-mode lock" step
   (exit 1, without showing the secret), so the owner can never be locked out by it.
3. **Add secret.** The next release build uses it.

The workflow's "Dev-mode lock" step (`tools/release/dev-lock-hash.mjs`) turns the secret into its
salted SHA-256 and passes only that to the build (`DEV_MODE_HASH`); the passphrase itself is never
printed, committed or bundled. Without the secret a release build has **no** way into dev mode
(the code does nothing). A dev flag saved by an earlier version is turned off on a release build
until the passphrase is entered there. To change the passphrase, update the secret and release
again; the old one stops working with that build. The lock is a gate for players, not security:
the hash is in the bundle, so a long passphrase is best.

### One-time setup: let tags deploy

GitHub's `github-pages` environment usually allows deployments only from the default branch. In
**Settings → Environments → github-pages → Deployment branches and tags**, add a tag rule `v*`,
or tag pushes stop at the deploy job. (Runs started by hand from `main` are not affected.)

## Redeploying or publishing an existing tag

Actions → **Release** → **Run workflow**, leave "Use workflow from" on `main`, and enter the
tag (for example `v0.1.0`). The workflow checks out that tag, runs the same checks and build,
deploys it and creates or updates its GitHub Release. Use this to:

- roll the live site back to an earlier release (run it with the older tag);
- retry a release whose run failed for reasons outside the code (Pages outage, permissions);
- publish a tag that was pushed before this workflow existed. For such old tags (v0.1.0) the
  checker and changelog come from `main`, since the tag itself has neither, and the build keeps
  that commit's own version string (v0.1.0 shows `V0.1.0-62F9AB0`).

With the GitHub CLI: `gh workflow run release.yml -f tag=v0.1.0`.

Re-running a tag from before 0.5.0 with today's workflow names its zips the new way: the run
uploads `smbc-remix-vX.Y.Z.zip` and `smbc-remix-vX.Y.Z-offline.zip` **beside** the release's
original `smbc-vX.Y.Z.zip` and `smbc-vX.Y.Z-offline.zip` (`--clobber` replaces only files of the
same name). Both pairs hold the same build; delete the one you don't want from the release page
if it matters.

**Run it from a `main` commit that hasn't been deployed yet.** GitHub Pages labels each deployment
with the commit the workflow runs from (not the tag), and it ignores a deployment whose label it
has already served: when v0.1.0 was published by hand from `main` and v0.2.0 was then tagged on
that same `main` commit, the v0.2.0 deploy reported success but the site stayed on v0.1.0 until
v0.2.0 was redeployed from a newer `main` commit. So after publishing an older tag by hand, make
sure `main` has moved on (merge anything, even a docs change) before the next release runs, or
redeploy the newest tag by hand afterwards.

## Pre-releases for testers

A release candidate is a normal release with a `-rc.N` suffix:

1. A **Release vX.Y.Z-rc.N** pull request sets `package.json` to `X.Y.Z-rc.N` and moves the
   Unreleased entries into `## [X.Y.Z-rc.N] - YYYY-MM-DD`.
2. Merge, then tag and push `vX.Y.Z-rc.N`.
3. The workflow marks the GitHub Release as a **pre-release** (any tag with a `-`). Note that it
   still deploys the live site, which then shows `VX.Y.Z-RC.N`.

When the final version ships, its `## [X.Y.Z]` section lists everything since the previous final
release (the rc entries plus anything newer), so its notes stand alone; the rc sections stay
below it as history.

## Save and settings compatibility

Players keep their progress across releases:

- A release must load every save file and settings written by any earlier release. Never silently
  drop or reset data.
- Changing the stored format of save files (`src/game/save/save-files.ts`) means appending a
  migration to `SAVE_MIGRATIONS` (each maps version v to v + 1; `SAVE_VERSION` follows) with a unit
  test that loads the old shape. Settings (`src/engine/save/settings.ts`) and the global progress
  flags (`src/engine/save/progress.ts`) follow the same rule.
- A format change that needs a migration is a minor version bump; adding an optional field that
  older saves load with its default (no migration) is a patch. Either way it gets a changelog line.

## The version in the game

The title screen shows the build at the bottom right (`__APP_VERSION__`, set in `vite.config.ts`):

- a release build (built with `RELEASE_TAG=vX.Y.Z`, or from a commit that carries the tag
  `vX.Y.Z` matching `package.json`) shows **`V0.2.0`**;
- any other build (`pnpm dev`, CI, a branch) shows **`V0.2.0-DEV.<commit>`**, where the version is
  the last one set in `package.json`, so the build is newer than that release;
- without git it shows `V0.2.0-DEV`.

Bug reports quote this string (see [bug-reports/README.md](../bug-reports/README.md)).
