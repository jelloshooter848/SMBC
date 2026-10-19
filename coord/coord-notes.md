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
- S1 integrated: claude/classic-mode (b3b6d71a + final fixes pending). QA passed, owner shown screenshots. Next: open PR 1.
- S2-a DONE: claude/classic-shared-a 0fce9b81. Helpers in characters/classic/power.ts (classicOnHurt/OnPowerUp/Busy/StartKit/Respawn/Drop), classic-swim.ts, classic-water.ts, test-def.ts. Conflict expected in World.strikeBlock w/ S2-b (blockDrop calls).
- Owner: no co-op in Classic; Lost Levels only after (non-dev) Classic clear; dev rows in classic pause.
- PR 1 opened: #146 (claude/classic-mode 055ecafe). Subscribed.
- PR2 integrated: claude/classic-shared d886a1bf (base classic-mode). Reviewer running.
- Heroes launched: ML (wip claude/classic-wip-ml, 5186, base shared-a), MM (wip claude/classic-wip-mm, 5187, base classic-shared), Bill (wip claude/classic-wip-bill, 5188, base classic-shared). Next: Link after ML; Samus, Simon, Ryu, Sophia.
- PR1 #146 green; fix pending (tag clipped on phone + rules-toggle tests robust to registered defs) by S1 agent.
- PR2 review done (no blockers), fixes pending by S2-b agent on claude/classic-shared.
- ML DONE: claude/classic-heroes-ml 8f4f583c (base shared-a; needs merge w/ classic-shared; fireball classicBlocks flag + Bowser-5 pending S2-b). New profile fields rise/softCut/inertia/turnInAir/jumpBuffer/stompBounce/crouchJump.
- Link launched: claude/classic-wip-link, 5189, base classic-shared + ML.
- PR1 #146: fixes pushed 1195c199 (tag y28, rules-toggle robust, QA nits). CI pending. Release session ACCEPTed earlier head.
- Bill DONE: claude/classic-heroes-bill 81a46c5f (deathThrow vs ML deathHop -> merge in World.updateDeath).
- MM DONE: claude/classic-heroes-mm 08fcaa4e (factory classicMegaMan(options) for Bass/ProtoMan; softCut same name as ML -> player.ts conflict).
- Running: S2-b fix (PR2), Link (5189), Samus (5195), Simon (5196), Ryu (5197). Sophia not yet launched.
- #146 MERGED 04:58. #147 (claude/classic-shared ac0b52db) retargeted to main, CI running, subscribed.
- #147 green (ac0b52db); test-robustness fix requested (shared tests using real heroes as unbuilt) -> will re-run CI.
- Link DONE 9f63c4d0 (wip-link, includes ML+shared). Link agent now integrating PR3 -> claude/classic-heroes-1 (ML+Link+MM).
- Sophia launched (wip-sophia, 5198). Running: Samus 5195, Simon 5196, Ryu 5197.
- Simon DONE 843c0441 (wip-simon). Judgment call: standing whip box extended down to 13px above feet (original enemy attack boxes in missing SWF) so it hits Goombas -> tell owner. airStop duplicated across Link/MM/Simon -> unify at PR4 integration.
- Release session ACCEPTED #147 (nits 2,4,5 being folded into the PR2 test-fix push).
- #147 head c21a0f28 (tests robust + nits; verified Current strikeBlock change is a no-op). CI pending.
- Samus DONE 611353d2 (Pit flags via classicSamus({variant})). Samus agent now integrating PR4 -> claude/classic-heroes-2 (Samus+Bill+Simon+Ryu, then stack on heroes-1).
- Ryu DONE 4938519d + follow-up pending (Fire Wheel stop, art).
- Sophia building separately (own PR later).
- Bass launched (wip-bass, 5199, base shared+MM). Next: ProtoMan/BreakMan + Pit/DarkPit builder (base shared+MM+Samus).
- Ryu follow-up DONE 9a2641d8. ProtoMan+Pit launched (wip-pm-pit, 5200).
- #147 green c21a0f28, waiting merge. PR3 integrated: claude/classic-heroes-1 c4120da9; QA reviewer running (5201).
- Sophia DONE d4005110 (id sophia in CLASSIC_CHARACTERS; owner call: keep nose-first fall in Classic as safety net). Added to PR4 integration.
- PM+Pit DONE 290a3281 (wip-pm-pit): 4 slots PROTOMAN,BREAKMAN,PIT,DARKPIT; hideExtras test helper. Owner calls for PR5: Proto Shield (PM-M1), castle names, music, Proto Man palette w/ Flower (uses MM weapon palettes).
- PR6 builders launched: Vic Viper (wip-vicviper 5202), Warriors (wip-warriors 5203), base shared+pm-pit, recommended design defaults.
- Bass DONE 3cb3ad38. Bass agent integrating PR5 -> claude/classic-extras (Bass+PM+Pit, stack on heroes-2).
- PR3 QA done (no blockers); fixes sent to Link agent (af37444) on heroes-1.
- PR4 integrated: claude/classic-heroes-2 46ef39cb (Samus/Simon/Ryu/Bill/Sophia, on heroes-1). Bill buttons -> hide (sent). QA reviewer on PR4 running (5204). Needs re-merge of heroes-1 fixes.
- PR4 Bill buttons hidden d7f414d3. PR5 integrated: claude/classic-extras 016cc6e5 (on heroes-2 46ef39cb). PR5 QA running (5205). Chain: heroes-1 fix -> merge into heroes-2 -> merge into extras.
- PR3 opened #148 (heroes-1 4d51bdd6, base classic-shared; retarget to main after #147 merges). Subscribed. Samus agent merging heroes-1 fix into heroes-2.
- #148 green 4d51bdd6. PR4 QA done (no blockers). Fixes: guide.ts Classic guides -> heroes-1 (Link agent); frozen tint + IDs -> heroes-2 (Samus agent). Then cascade into extras.
- Warriors DONE a27b233d (wip-warriors). Uses holdsStill (now 'rooted' in heroes-2) -> unify at PR6 integration. Owner notes: hit response is our call; placeholder sounds.
- VicViper DONE 50249c50 (wip-vicviper). VV agent integrating PR6 -> claude/classic-extras-2 (VV+Warriors, stack on extras). Owner note: 1-1 first pipe crush trap.
