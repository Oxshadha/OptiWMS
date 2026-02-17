# UI Consistency Playbook (Admin)

## Why This Exists

Current admin pages use many color styles for similar meanings. This creates cognitive load and causes semantic conflicts (good/bad/neutral shown with similar colors).

This playbook defines one shared system for status, priority, and category visuals.

## Core Rules

1. One meaning per color family.
2. Brand color (`primary`) is for actions/navigation emphasis, not operational status meaning.
3. Status chips are outline-first and low saturation by default.
4. Do not rely on color alone; include label text and optionally an icon/dot.
5. Maximum of 5 semantic tones in data tables: `neutral`, `info`, `success`, `warning`, `danger`.
6. Keep non-status labels (type/category/location) neutral unless they represent risk/health/state.

## Semantic Color Contract

- `success` (green): completed, active, healthy, available.
- `warning` (amber): pending attention, low stock, delayed, at risk.
- `danger` (red): failed, cancelled, blocked, critical issue.
- `info` (blue): in-progress, processing, scheduled/running.
- `neutral` (gray): draft, unknown, unassigned, not started.

Never map both good and bad states to the same semantic tone.

## Status Chip Style Standard

- Default pattern: thin-border pill with light tint.
- Neutral labels/chips use grey palette surface (`base-200`), not white.
- Text always present (no color-only indicators).
- Optional dot/icon can reinforce state, but text is required.
- Recommended component: `StatusChip` in `frontend/components/StatusChip.tsx`.
- Base classes live in `frontend/app/globals.css`.

Example:

```tsx
<StatusChip label="In Progress" tone="info" showDot />
<StatusChip label="Completed" tone="success" />
<StatusChip label="Cancelled" tone="danger" />
```

## Priority vs Status

- Status answers: "what lifecycle state is this item in?"
- Priority answers: "how urgent is this item?"
- Keep them visually distinct:
  - Status uses semantic tones above.
  - Priority should use a separate compact scale (for example: `Low=neutral`, `Normal=info`, `High=warning`, `Critical=danger`).

## Summary Cards Rule

- Use color only on the value/icon accent, not fully saturated card backgrounds.
- Keep card surfaces neutral (`base-100`) for all cards.
- One page should not exceed 1 brand accent + semantic tones.

## Tabs and Filters

- Yes, minimalist tabs/chips are UI-friendly when:
  - active state is clear (weight + border + subtle background),
  - inactive states are neutral,
  - semantic color is used only when a tab itself represents status.

## Accessibility Guardrails

- Maintain sufficient contrast for text (WCAG 2.1 SC 1.4.3).
- Do not use color as the only cue (WCAG 2.1 SC 1.4.1).

## Rollout Plan (Recommended)

1. Introduce `StatusChip` everywhere status appears in tables first.
2. Normalize task/cycle-count/supplier/delivery status mappings to the semantic contract.
3. Remove ad-hoc inline colors and map to the 5 tones only.
4. Add visual regression checks for key admin pages after migration.

## Sources

- Nielsen Norman Group, 10 Usability Heuristics (Consistency and Standards): [NN/g Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- W3C WCAG 2.1, Use of Color (SC 1.4.1): [W3C SC 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- W3C WCAG 2.1, Contrast Minimum (SC 1.4.3): [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- GOV.UK Design System, Tag component (status labels and color discipline): [GOV.UK Tag](https://design-system.service.gov.uk/components/tag/)
