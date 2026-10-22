# SMBC Remix — Second-Round Save Code Optimization Study

## Objective

The initial feasibility analysis demonstrates substantial improvements over compressed JSON. Before implementing the proposed codec, investigate whether **multiple reference states (multiple K values), modular dictionaries, and cross-slot compression** can further reduce save-code lengths.

This is an experimental extension of the existing proposal, not a request to replace the working architecture.

**Do not modify production game code yet.** Use the existing benchmark harness and real save/load modules.

## 1. Multiple reference states

Investigate replacing the single frozen default reference with several immutable reference templates.

For each input A, evaluate candidate references K₀…Kₙ and select the one minimizing:

`totalBits = referenceIdentifierBits + encodedDeltaBits + requiredOverheadBits`

Potential templates:

- Fresh game / empty progression
- All levels completed
- Intermediate progression
- All characters unlocked
- All achievements unlocked
- Standard or upgraded hero equipment
- Standard Classic configurations

Determine which templates are genuinely useful. Do not assume that the closest reference by character differences produces the smallest encoding.

## 2. Modular references

Investigate selecting references independently for:

- Campaign progression
- Character unlocks
- Hero equipment and `heroKits`
- Classic rules
- Achievements and global progress

Compare the results against whole-profile reference selection.

Identify whether individual components have enough predictable structure to justify their own reference selectors.

## 3. Adaptive encoding

Benchmark an encoder that chooses the most compact representation per section.

Candidate methods:

1. Existing campaign bit-packed codec
2. Generic schema delta
3. Multiple-K delta
4. Modular reference delta
5. Deflate, where beneficial

Include selector bits and framing overhead in all reported lengths.

Preserve the existing campaign-code decoder and backward compatibility.

## 4. Cross-slot compression

Investigate reusing information between multiple campaign or Classic slots within a whole-profile backup.

Examples:

- Shared Classic rules
- Repeated hero equipment
- Common unlock combinations
- Similar progress sets

Test whether a shared dictionary or reference-to-previous-slot representation improves compression compared with encoding each slot independently.

Ensure arbitrary valid combinations remain reconstructible.

## 5. Benchmarks

Reuse the existing scenarios and 200 seeded random profiles.

Compare the original hybrid method against all new candidates. Report:

- Minimum, median, maximum lengths
- Results for fresh, typical, late-game, fully completed and Survival profiles
- Current Classic slot shape versus planned B-L shape
- Per-file codes separately from whole-profile codes
- Encoding and decoding performance
- Static reference-table size added to the shipped game
- The percentage of saves for which each new method actually wins

Include tests where reference selection makes a code longer; the adaptive encoder must avoid that regression.

If practical, add scenarios representing player progress at 10%, 25%, 50%, 75%, 90%, 99% and 100%, with sparse exceptions rather than only sequential completion.

## 6. Correctness and compatibility

Retain:

- Frozen, versioned reference tables and dictionaries
- Existing migrations and validation
- Checksums and strict decoding
- Full round-trip validation
- Loader-level equality
- Exclusion of developer unlock fields

Pay particular attention to non-derivable fields such as `freed`, `story`, Classic cheat unlocks, and `heroKits`.

Do not interpret similarities in synthetic test data as guaranteed invariants of actual gameplay.

## 7. Deliverables

Produce a follow-up Markdown report answering:

1. Does multiple-K encoding outperform the current hybrid codec?
2. Which sections benefit most?
3. Are modular references superior to whole-save references?
4. Does cross-slot deduplication materially reduce future nine-file Classic backups?
5. What is the improvement after including all overhead?
6. What is the smallest practical implementation that captures most of the benefits?
7. Is the improvement worthwhile considering code complexity, bundle size, and long-term compatibility?

Provide measured results, clearly separate forecasts, and recommend either adopting the improvements or retaining the current proposal.

**Primary goal: minimize portable code length without sacrificing reconstruction accuracy, compatibility, or offline operation.**