# Touch controls revamp — shared brief

Project: browser remake of Super Mario Bros. Crossover (TypeScript, Canvas, Vite, pnpm). Base: branch
claude/admiring-galileo-quy3ri at 999dc59 (main + Lost Levels cards). Work in your git worktree; symlink
node_modules from /home/user/SMBC if missing. Never use browser port 4173 (pick 4195 for T1, 4196 for T2).
Don't edit CHANGELOG.md. Commit with trailers:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g
Checks before reporting: pnpm lint && pnpm typecheck && pnpm test && pnpm build. Report < 20 lines.

Owner's requests (verbatim intent):
1. Detect mobile; hide touch controls when not on mobile; plus a manual toggle in the in-game pause
   menu.
2. Instruction menus are convoluted because they show several control schemes. Touch buttons should
   say what they do ("JUMP", "FIRE"/"SHOOT", "TOOL BELT"…; start = "PAUSE"/"MENU"), dynamic per
   character, power/equipment and context.
3. Sprint-jumping with Mario/Luigi on touch works badly. Owner chose: pushing the d-pad far = run.
4. D-pad is easy to mis-hit. Owner chose: build BOTH a fixed pad with smarter zones and a floating
   stick, chosen in Options (fixed by default); highlight the pressed direction.

Current code: src/engine/input/touch.ts (TouchSource: DOM overlay, dpad with 0.22 per-axis deadzone,
buttons A/B/C/START/SELECT with setPointerCapture), settings `input.touch: 'auto'|'on'|'off'` and
`touchScale` (src/engine/save/settings.ts), detection `TouchSource.likelyTouchDevice()` used in
src/main.ts:~109, Options rows in src/game/scenes/options.ts:~144, guide pages in
src/game/scenes/guide.ts (shows keyboard + pad + touch per row), actions in
src/engine/input/actions.ts, run check src/game/entities/player.ts:~168
(`p.canRun && input.held('attack')`).

## Shared contract (both agents code against this exactly)
- `export type TouchLabels = Partial<Record<Action, string | null>>` in src/engine/input/touch.ts.
  `string` = label to show; `null` = hide that button; key absent = default label.
- `TouchSource.setLabels(labels: TouchLabels): void` — cheap to call every frame (no-op when unchanged).
- Scene hook: `Scene.touchLabels?(): TouchLabels` (optional, in src/engine/scene.ts).
- A new action `'run'` (add to `Actions` in actions.ts; label 'Run'; no default keyboard/gamepad
  binding unless one is obviously free — say what you chose). Running for characters that can run
  = `held('attack') || held('run')`. `run` never fires/attacks.
