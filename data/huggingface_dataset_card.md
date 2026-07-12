---
license: cc-by-sa-3.0
task_categories:
  - text-classification
  - token-classification
language:
  - en
  - multilingual
tags:
  - linguistics
  - etymology
  - historical-linguistics
  - cognates
  - language-families
  - phonology
  - typology
size_categories:
  - 1M<n<10M
---

# Etymology Atlas: Global Language Relationships

4.2M+ etymological relationships across 8,500+ languages with geographic coordinates, phoneme inventories, and typological features.

## Dataset Description

- **Homepage:** https://diachronica.com/etymology/
- **Repository:** https://github.com/lukesteuber/etymology-atlas
- **Paper:** (forthcoming)
- **Point of Contact:** luke@lukesteuber.com

### Dataset Summary

Etymology Atlas combines multiple authoritative linguistic databases into a unified resource for studying word origins across the world's languages. It links etymology relationships from Wiktionary (via etymology-db) with expert-annotated cognate sets from Lexibank, geographic and genealogical data from Glottolog, phoneme inventories from PHOIBLE, and typological features from WALS.

### Supported Tasks

- **Etymology prediction**: Given a word, predict its likely origin language and relationship type
- **Cognate detection**: Identify words with shared ancestry across languages
- **Language similarity**: Compute distance metrics based on shared cognates
- **Cross-lingual embeddings**: Align word representations using cognate pairs
- **Historical linguistics research**: Study sound changes, semantic shifts, borrowing patterns

### Languages

The dataset covers 8,500+ languages from all major language families:
- Indo-European (450+ languages)
- Austronesian (2,000+ varieties)
- Sino-Tibetan (400+ languages)
- Niger-Congo (1,500+ languages)
- Afro-Asiatic (300+ languages)
- And 200+ other families

## Dataset Structure

### Data Instances

```python
# Etymology relationship
{
  "term1": "democracy",
  "lang1": "eng",
  "lang1_name": "English",
  "lang1_family": "Indo-European",
  "term2": "δημοκρατία",
  "lang2": "grc",
  "lang2_name": "Ancient Greek",
  "lang2_family": "Indo-European",
  "relationship_type": "borrowed",
  "confidence": 0.95,
  "concept": "government by the people"
}

# Language metadata
{
  "glottocode": "stan1293",
  "iso_639_3": "eng",
  "name": "English",
  "family_name": "Indo-European",
  "macroarea": "Eurasia",
  "latitude": 51.5,
  "longitude": -0.1,
  "status": "living",
  "speakers_count": 1500000000
}
```

### Data Fields

**etymologies.parquet**
- `term1`, `term2`: Word forms in the relationship
- `lang1`, `lang2`: ISO 639-3 language codes
- `lang1_name`, `lang2_name`: Language names
- `lang1_family`, `lang2_family`: Language family names
- `relationship_type`: One of 31 types (inherited, borrowed, cognate, etc.)
- `confidence`: Float 0.0-1.0 (expert annotations = 1.0)
- `concept`: Shared meaning for cognate pairs
- `sources`: Data provenance

**languages.parquet**
- `glottocode`: Glottolog identifier
- `iso_639_3`: ISO language code
- `name`: Language name
- `family_name`: Top-level family
- `macroarea`: Geographic region
- `latitude`, `longitude`: Coordinates
- `status`: living/endangered/extinct
- `speakers_count`: Estimated speakers

### Data Splits

Single unified dataset (no train/test splits). Users should create their own splits for ML tasks.

## Dataset Creation

### Curation Rationale

No existing dataset combines etymology relationships with linguistic geography, phonology, and typology. This integration enables research questions that span multiple dimensions of language structure and history.

### Source Data

| Source | License | Records |
|--------|---------|---------|
| etymology-db (Wiktionary) | CC BY-SA 3.0 | 3.8M entries |
| Glottolog 4.8 | CC BY 4.0 | 8,500+ languages |
| Lexibank CLDF | CC BY 4.0 | 370K cognate sets |
| PHOIBLE 2.0 | CC BY 4.0 | 2,186 inventories |
| WALS | CC BY 4.0 | 192 features |

### Annotations

Cognate judgments from Lexibank are expert-annotated by historical linguists. Etymology relationships from Wiktionary have variable quality; confidence scores reflect source reliability.

## Considerations for Using the Data

### Social Impact

This dataset supports linguistic research and language documentation. It may help preserve knowledge about endangered languages.

### Discussion of Biases

- Indo-European languages are overrepresented due to more extensive documentation
- Etymology confidence varies by language (well-documented languages have higher confidence)
- Some historical relationships are disputed among linguists

### Other Known Limitations

- Phoneme data available for ~25% of languages
- WALS features available for ~30% of languages
- Some etymology relationships are speculative

## Additional Information

### Dataset Curators

Luke Steuber (luke@lukesteuber.com)

### Licensing Information

CC BY-SA 3.0 - Attribution-ShareAlike required

### Citation Information

```bibtex
@dataset{etymology_atlas_2026,
  title = {Etymology Atlas: Global Language Relationships},
  author = {Steuber, Luke},
  year = {2026},
  url = {https://huggingface.co/datasets/lukesteuber/etymology-atlas}
}
```
