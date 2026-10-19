# Coordinator notes (Classic mode project)
Started 2026-10-19. Slice-1 PR branch: claude/classic-mode (designated).
Phase 1 running: S1-core (wip claude/classic-wip-core, port 5182), S1-shell (wip claude/classic-wip-shell, 5181), S6 mockups (wip claude/classic-wip-mockups, 5183).
Next: merge core+shell into claude/classic-mode -> QA -> PR1.
Phase 2 (after core): shared rules builders: (a) power states + swimming, (b) enemy HP + bricks. Based on claude/classic-wip-core.
Phase 3: heroes: Mario/Luigi first (jump model), then MegaMan, Link, Samus, Simon, Ryu, Bill, Sophia in parallel groups.
Phase 4: extras Bass, ProtoMan/BreakMan, Pit/DarkPit.
If restarted: briefs are in briefs/ (also pushed to origin claude/classic-wip-coord); relaunch builders from wip branches.
- Owner 2026-10-19: wishlist heroes (Peach, Yoshi, Arthur, Scrooge, Toad, Higgins, Bub…) parked until current work is done; ask again then.
- S1-core DONE: claude/classic-core 12dabe85 (API: game.liveRules, game.runRules, newGame(..,{rules}), devStart(..,{rules}), rosterFor).
- S1-shell DONE: claude/classic-wip-shell 5e4126dc (beginClassicRun() sets runRules; game.classicRun). Reviewer running on it.
- S6 mockups DONE: claude/classic-wip-mockups 2f115119; sheets sent to owner, awaiting build/skip decision.
- S2-a (power+swim, claude/classic-wip-shared-a, 5184) and S2-b (enemyHP+bricks, claude/classic-wip-shared-b, 5185) launched on base classic-core.
- Known env issue: title.test PRE-RELEASE fails with 8-char short sha in container; check in CI.
- Owner: OK 8-4 -> Lost Levels new-run flow; OK keep E-tank row. "Keep working on new characters, release at end of docket" -> plan PR 6: Vic Viper + WoL built with recommended design defaults (confirm), after PR5. Build after S2 lands (needs classic power model).
