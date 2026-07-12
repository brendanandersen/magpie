# Magpie

Procedurally generate a plausible **Indo-European-descended language** from a seed, then translate English into it.

Give Magpie a seed word and it invents a language: a phoneme inventory, phonotactics, a bit of grammar, and — most importantly — an ordered chain of **sound-change rules**. It then evolves real Proto-Indo-European roots through that chain to build a lexicon, so the result *feels* etymologically real. You can nudge the style, anchor a seed to a real branch (German, Greek, Russian, …), hand-edit the rules, hear phonemes spoken, and share a link.

> Magpie is a **vibe-coded hackathon project** — built fast, for fun. Results are rough, entertaining approximations, **not** scholarly reconstructions. Treat every
> "translation" as a party trick, not a peer-reviewed etymology.

## Features

- **Seed → language** — deterministic generation of phonology, phonotactics, grammar, and a full sound-change pipeline from any seed string.
- **PIE-first evolution** — words are derived by running Proto-Indo-European roots through the whole ordered rule chain, with partial credit toward attested modern reflexes.
- **Branch anchoring** — optionally lock a seed onto a real branch so it reliably carries that language's signature sound laws (Grimm's law, the High German consonant shift, i-umlaut, …).
- **Readable sound changes** — every rule is labelled with its historical law (on anchors) or its general phonological process (on generated rules: devoicing, spirantization, umlaut, …).
- **Rule customization** — edit, reorder, add, or remove rules and see the lexicon re-derive live; the exact configuration is compressed into a shareable URL.
- **Translate & reverse** — turn English sentences into the language and back.
- **Text-to-speech** — hear the phoneme inventory and words via in-browser Piper voices.

## Requirements

- **Node.js ≥ 20**
- npm

The runtime data slice (`data-build/*.json`) is **committed to the repo**, so you do *not* need
to download any dataset to run the app.

## Installation

```bash
git clone <this-repo>
cd magpie
npm install
```

## Usage

### Run the app (API + web UI)

```bash
npm run dev
```

This starts the Fastify API and the Vite dev server concurrently. Open the URL Vite prints (default `http://localhost:5173`); the API listens on `http://127.0.0.1:8787`.

### Build the web UI for production

```bash
npm run web:build
```

### CLI demos

```bash
# Print a generated language for a seed (default: "magpie")
npm run generate -- <seed>

# Translate a sentence with a given seed
npm run translate -- <seed> "The mother gave water to the brothers"
```

### Run only the API server

```bash
npm run server        # PORT=8787 by default; override with the PORT env var
```

### Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
```

## How it works

1. **Data slice.** `scripts/build-data.ts` reads the raw Etymology Atlas Parquet files and emits
   a compact JSON slice under `data-build/` (an English → ancestor-root index, phoneme
   inventories, typology, and modern reflexes). The runtime never touches Parquet.
2. **Generation.** `src/core/generator.ts` seeds a deterministic RNG to build the inventory,
   phonotactics, grammar, and — via `src/core/sound-change.ts` — the ordered sound-change chain
   (plus branch anchors when a branch is selected).
3. **Lexicon.** Each core concept's PIE root is evolved through the full rule chain
   (`deriveWord`); words with no reachable root are coined from the phonotactics.
4. **Serving.** `src/server/server.ts` exposes `/api/generate`, `/api/translate`,
   `/api/reverse`, and seed-matching endpoints consumed by the React UI in `web/`.

## Regenerating the data slice (optional)

Only needed if you want to rebuild `data-build/` from source. Place the Etymology Atlas Parquet
files (`etymologies.parquet`, `phonemes.parquet`, `linguistic_features.parquet`) in `./data/`,
then:

```bash
npm run build-data       # full rebuild (also regenerates the large ancestor index)
npm run build-reflexes   # rebuild only reflexes.json
```

## Data & credits

Linguistic data comes from the [**Etymology Atlas** dataset by **Luke Steuber**](https://huggingface.co/datasets/lukeslp/etymology-atlas)
(integrating etymology-db/Wiktionary, Glottolog, Lexibank IE-CoR, PHOIBLE, and WALS). See
`data/README.md` for details, citation, and links. The dataset is licensed **CC BY-SA 3.0**.

## Disclaimer

Magpie is a toy. It makes confident-sounding claims about how words evolved that are, at best,
loose approximations and often simply wrong. Enjoy it as a generative-linguistics sandbox, not
as a source of truth.
