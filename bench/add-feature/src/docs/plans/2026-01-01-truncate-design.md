---
status: design-intent
---

# A length cap for slugify

## 1. maxLength

- `slugify(text, { maxLength })` returns at most maxLength characters, cut at the last whole word that fits.
- A first word longer than maxLength is cut inside the word, and the result never ends in a hyphen.

## What proves it done

| test | how |
|---|---|
| the cases in `spec/truncate.spec.js` pass | `npm test` |
