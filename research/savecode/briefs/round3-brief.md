# SMBC Remix – Round 3: targeted compression experiments after Round 2

## Purpose and evidence boundary

This is an addendum to `SAVE_CODE_ROUND2.md`, not a replacement for its findings. It incorporates the subsequent discussions of hierarchical structural sharing, semantic entropy coding, enumerative coding, and layout-aware compression.

This brief evaluates the reports. The reviewer has not inspected `codec2.ts` or independently rerun the benchmark harness. “Not reported” does not prove that an optimization is absent: audit the existing code before adding it.

All SMBC measurements cited below are reported by the coding agent. New experiments are hypotheses, not measured gains. Continue in the scratch benchmark harness; do not change production code or freeze a new public format solely to conduct these experiments.

## 1. Retain the Round-2 conclusions

Round 2 is evidence against another broad search for intermediate reference saves or increasingly elaborate stage-wise reference selection.

- On the fair-progress corpus, current-shape profile median lengths were R1 375, config M 345, and guarded full-adaptive 345 characters.
- For the planned nine-file B-L shape, corresponding medians were 487, 447, and 444.
- Modular/derived stages added only about 0–3%; they also require version-frozen reconstruction behavior.
- New Classic per-file variants won 0% of tested cases.
- Cross-slot gains depended strongly on correlation: roughly 1% for independent files, 3.7% for shared rules, and 31% for shared rules/hero kits with 30% of kit values changed.
- These are synthetic distributions. B-L remains a design, with no real B-L loader or player corpus.

Source: `SAVE_CODE_ROUND2.md`, answers 3–7 and sections 2–4.

Do not present the ratio of corpus median lengths as the median of individual percentage savings. For example, 375 → 345 is an 8.0% reduction in median length; the report separately gives a 5.1% median per-profile saving. These are different statistics.

Production recommendation remains separable from research: R1 can ship with versioned method dispatch and rejection of unknown methods. Improvements using an already-supported grammar need not change the decoder; genuinely new syntax, tables, or models need compatible method/version identification.

## 2. Audit and instrument before implementing new algorithms

First produce a short inventory of what the current campaign, R1, and R2 coders already implement:

1. Set encodings: bitmaps, sparse/gap lists, complements, runs, combinatorial ranking, and exception masks.
2. Integer encodings: existing EG-k or other variable-length schemes, exact ranges, numeric fallback behavior, and any joint packing.
3. Kit encoding: per-hero defaults, basic/full templates, and any conditional numerical prediction.
4. Probability coding: distinguish DEFLATE's byte/match-symbol Huffman coding from models conditioned on semantic game fields.
5. Structural sharing: whole-record references, separate rules/heroKits references, individual-hero references, and reusable nested subobjects.
6. Layout: record-major versus field-major, bit versus byte alignment, and stream partitioning.
7. Candidate selection: per-section raw-bit minimization versus whole-profile final-size optimization.

Add a cost breakdown of the uncompressed intermediate representation: presence/same flags, reference and mode selectors, set membership, numeric values, kit values, rule values, unknown-string escapes, and framing. Use controlled ablations to assess final compressed effects; compressed bytes generally cannot be attributed additively to individual fields.

Audit comparison policy. Every competing representation must preserve the same declared semantic/portable/exact state. In particular, Round 2's campaign per-file discussion mentions new codes keeping scores while existing codes omit them. Verify the normalization/sidecar policy before calling a shorter candidate interchangeable. This is a clarification request, not a finding that the tests are wrong.

## 3. Experiment A – improve representation choice without changing its meaning

### A1. Whole-profile candidate selection

Clarify whether every candidate was tested independently per section or whether combinations were evaluated after final DEFLATE and framing. Trying every reference for each section is not automatically an exhaustive search over combinations of section encodings.

If selection is local, test a bounded search over already-supported representations:

- Start with the existing chosen encoding.
- Retain a small number of competitive alternatives per section.
- Try coordinate-descent or a small beam, measuring the complete wrapped output.
- Set an explicit encoder-work budget and report latency.
- Keep the existing encoder output as a candidate.

A slightly larger intermediate section can conceivably create better whole-stream matches. This is a hypothesis to measure, not a promise of additional savings.

Where this only changes selection among already-valid encodings, it should not require new decoder semantics.

### A2. Field grouping and alignment

Compare a small matrix:

| Ordering | Representation |
| --- | --- |
| Existing record-major | Existing tightly packed bits |
| Field-major / typed channels | Tightly packed bits |
| Field-major / typed channels | Consistently byte-aligned values |

Suggested channels include structural/presence information, enum IDs, numeric values/residuals, and exceptional strings. Preserve record identity and all meaningful array order. Include counts, channel boundaries, alignment, and layout tags in the total.

Try one final compression stream first; do not create one independently framed stream per tiny field. Also retain raw output when compression loses.

This experiment changes how patterns are exposed, not which data is retained. W3C EXI is a precedent for grouping related values and using byte-aligned preprocessing before compression [S2].

## 4. Experiment B – semantic entropy coding

DEFLATE already uses entropy coding. The untested question is whether coding semantic events with contextual probabilities beats the current packed-byte/DEFLATE combination [S1, S3].

Build one modest range/arithmetic coder before considering multiple entropy-coder families. Feed it semantic decisions rather than only an opaque packed-byte stream:

- default versus exception;
- section/object presence;
- set membership or set gaps, according to the best existing representation;
- per-hero kit state and key occurrence;
- small enums;
- numerical residual categories and exact residual values.

Use contexts available from already-decoded state, such as hero identity, field identity, power state, or equipment tier. Do not assume those contexts fully determine a value: encode deviations exactly.

Test:

1. One small frozen probability model.
2. Only if useful, a few conditional contexts.
3. Optionally a deterministic adaptive model shared by encoder and decoder; count startup cost and specify update/rescale behavior exactly.

Requirements:

- Fixed, versioned, deterministic model rules and integer probability tables.
- Nonzero probability or an exact escape path for every accepted value.
- No dependence on live game functions that can change between releases.
- All stream-finalization, escape, model-selection, and envelope costs counted.
- Frozen models trained only on the training partition; separate real playthroughs for evaluation.
- No assumption that an arithmetic or ANS coder will beat DEFLATE merely because it is sophisticated.

An estimated held-out cross-entropy can help diagnose opportunities, but it is not a proven information-theoretic lower bound for all valid saves.

### Conditional numeric prediction

As a limited subexperiment, audit whether `(hero, power state, tier, field)` can predict a useful numeric baseline. Store actual minus predicted using the best exact residual representation, with fallback to the original value representation. Compare against existing per-hero/default/basic/full references; do not re-label those as a new idea.

Freeze small codec-specific tables, not copies of broad progression functions. Preserve noninteger values wherever the accepted save domain permits them. FLAC provides a precedent for prediction plus exact residual coding, not evidence that these game fields are predictable [S4].

## 5. Experiment C – enumerative coding and verified constraints

First audit the current set codec. If absent, add a combination-rank candidate for sets or changed-field masks with known universe size N and membership count k.

Cost model:

`mode + encode(k) + ceil(log2(binomial(N, k))) + changed values + framing`

If k is already known from an independently decoded field, omit only its redundant transmission. Do not claim a free count otherwise.

Compare with existing sparse/gap lists, bitmaps, complement lists, and runs. Ranking only identifies the selected positions; replacement values still need encoding.

Use constrained joint states only for verified invariants that hold for the accepted versioned data domain. Otherwise carry exceptions. Do not introduce lossy normalization to manufacture a smaller state space.

Mixed-radix packing of bounded values is a small secondary test. Compare final size, because tighter packing may interfere with later byte-oriented compression. Source precedent: enumerative source coding [S5].

## 6. Experiment D – hierarchical structural sharing, narrowly scoped

Round 2 already tested whole-slot references and independently referenced rules/heroKits stages. Do not repeat those under a new name.

The remaining question is whether smaller reusable components combine across different slots in ways those references miss. Example: a slot's Mario kit matches one earlier slot, its Link kit matches another, and neither entire equipment map is a close match.

Proceed in stages:

1. Measure actual repeated typed subcomponents after existing defaults and encodings have been applied.
2. Estimate savings from storing a definition once plus compact references, including dictionary headers and types.
3. Implement exact local sharing only if that estimate is material.
4. Try one additional level of nested sharing or a very small parameterized pattern vocabulary only if exact sharing leaves a documented opportunity.

Possible levels: individual kit → kit group → rules/equipment combination → slot. Do not force a balanced tree or a fixed number of levels.

Static definitions may live in frozen K. Dynamic definitions must be transmitted in H. A root hash alone cannot reconstruct definitions absent from both. Use local compact IDs in the serialized format; hashes, if used internally for duplicate detection, must be backed by equality checks. This is structural/grammar compression, not a need for cryptographic Merkle identifiers [S6].

Test against both R1 and guarded config M. Include independent, genuinely correlated, and adversarial cases. Synthetic duplicate-heavy profiles are stress tests, not an estimate of real benefit.

Decode requirements: acyclic/bounded expansion, valid type/index checks, bounded depth/output, preserved slot identity and array order, and independent mutable reconstructed records. Shared encoding definitions must not cause editing one imported save to mutate another.

Do not implement recursive DEFLATE at every tree level as the main candidate. At most keep it as a small control when warranted; prioritize structural reuse before final byte compression.

## 7. Established compressor controls

Benchmark these without assuming they should ship:

- A stronger DEFLATE encoder, such as Zopfli, against the already-used DEFLATE path. Its output remains DEFLATE-compatible, but encoder cost can be much higher [S7].
- Zstandard with a trained dictionary on the selected semantic/structural representation [S8].
- Shared Brotli as a secondary dictionary control only when an available offline implementation exposes the necessary dictionary interface [S9].

Count all frame bytes and required identifiers in H; report the static dictionary, decoder, encoder, and initialization cost separately. Browser HTTP support is not proof that a corresponding offline in-app API is available. Verify target-browser operation, including iPhone/iPad, before proposing deployment.

No external dictionary service is allowed. A dictionary must ship with the game or be inside the self-contained code.

## 8. Benchmark discipline and stopping rules

Baselines: R1, config M with its own complete-envelope no-regression guard, and the full adaptive result for reference. Do not assume config M has the exact same measured guard statistics as the report's min(H, R1); measure it explicitly.

Keep the same envelope, checksum, normalization policy, set-order policy, and preserved fields across comparisons. Minimize complete wrapped code length, not an isolated intermediate buffer.

Retain the existing synthetic suites for regression and stress coverage. Do not describe the fair-progress generator as a measured player distribution. If real saves are available, split training/test data by player or independent playthrough, not adjacent snapshots. If unavailable, say so and avoid generalizing synthetic gains.

For each experiment report:

- Complete Base64url lengths and typed Base32 lengths separately when applicable.
- Corpus median length, p95 length, maximum, and separately median per-profile percentage savings.
- Absolute characters saved and shorter/equal/longer rates.
- Fresh/typical/late/fully-complete/current versus B-L results separately.
- Encode/decode time, memory, deployed table/implementation size, browser startup cost.
- Incremental gains beyond guarded config M, not only beyond R1.
- Isolated gains and combined gains; do not add percentages across transformations.
- All framing, counts, dictionary definitions, model costs, escape costs, and finalization bytes.

Round-trip through the real loaders where they exist. Keep checksums, strict decoding, dev exclusions, migrations, and immutable old decoders/tables. Add malformed-reference, entropy-stream, version, decompression-limit, and resource-exhaustion tests as applicable. B-L still needs structural-only checks until a real loader exists.

Use measured byte budgets to stop low-value experiments. If a feature costs only a few bytes, optimizing it cannot plausibly explain a large whole-code reduction. A no-size-regression guard does not remove maintenance, bundle, latency, or decoding-risk costs.

## 9. Desired conclusion

Return a short Round-3 report that distinguishes:

1. Already present or already tested; no new experiment needed.
2. New technique with material measured improvement.
3. New technique with marginal/no improvement.
4. Not evaluated because implementation or representative data is unavailable.

Recommend the smallest justified combination, or retain R1/config M. No specific percentage improvement is assumed. Negative results constrain these approaches on the tested workload; they do not prove a theoretical optimum.

Prioritize audit/measurement, layout and encoder-choice experiments, then semantic entropy coding and set coding. Gate hierarchy work on observed component reuse. Defer model mixtures, neural compressors, bits-back methods, and large grammars until simpler experiments reveal a reason to pursue them.

## Primary references

[S1] RFC 1951, DEFLATE: LZ77 plus Huffman coding. https://www.rfc-editor.org/rfc/rfc1951.html

[S2] W3C EXI Primer, section 2.3: homogeneous value channels and byte-aligned preprocessing. https://www.w3.org/TR/exi-primer/

[S3] Gao and Parameswaran, *Squish: Near-Optimal Compression for Archival of Relational Datasets*: attribute dependencies and arithmetic coding. https://arxiv.org/html/1602.04256v2

[S4] RFC 9639, FLAC: prediction and exact residual coding. https://www.rfc-editor.org/rfc/rfc9639.html

[S5] Cover, *Enumerative source encoding*, IEEE Transactions on Information Theory, 1973. https://ieeexplore.ieee.org/document/1054929/

[S6] Lohrey, Maneth and Mennicke, *Tree structure compression with RePair*: repeated subtrees and parameterized tree patterns. https://arxiv.org/html/1007.5406v1

[S7] Google Open Source, *Compress Data More Densely with Zopfli*: encoder search with DEFLATE-compatible output. https://opensource.googleblog.com/2013/02/compress-data-more-densely-with-zopfli.html

[S8] Zstandard official overview and RFC 8878: small-data dictionaries and format. https://facebook.github.io/zstd/ ; https://www.rfc-editor.org/rfc/rfc8878.html

[S9] RFC 9841, *Shared Brotli Compressed Data Format*. https://www.rfc-editor.org/rfc/rfc9841.html
