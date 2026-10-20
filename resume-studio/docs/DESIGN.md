# Design notes

## Concept: a proofing desk
The resume is the hero object: a white sheet with sharp corners on a cool grey desk. The trust system
(Confident / Needs review / Excluded) borrows from proofreading marks, so the interface itself shows what has been checked:

| State | Mark | Where it shows |
|---|---|---|
| Confident | green tick | status controls, badges, library stripe |
| Needs review | **highlighter marker** | highlighted text in lists and on the paper preview, yellow stripe, yellow page chip when over target |
| Excluded | red strike-through | struck text, red stripe |

Status is never colour alone: every state also has an icon and a word.

## Palette (tokens in `src/styles/tokens.css`)
Desk `#DCE0E7` / paper `#FFFFFF` / ink `#14182A` (text and primary buttons) / pencil blue `#2F5BEA` (links, focus) /
highlighter `#FFE066` / tick green `#17693A` / red pencil `#B3261E`. Dark mode inverts the desk and ink; the paper stays white
so the resume always looks like the document it will become.

## Type
One family, **Atkinson Hyperlegible** (bundled locally through `@fontsource`, so it works offline). It was designed by the Braille Institute
for legibility, which suits an app meant to be easy for everyone, and its distinctive letterforms give the interface character.
Two weights (regular, bold); hierarchy comes from size and space rather than many weights. Body text is 16px.

## Principles
* Structure carries information: resumes appear as paper thumbnails, not identical cards; the library's state is a proportional bar.
* Quiet around the one distinctive thing: neutral surfaces, hairline dividers, shadows only on paper and popovers.
* Every action gets an answer: autosave status, toasts with Undo, status rows that fade their highlighter when confirmed.
* Nothing is destructive without a way back: confirmation dialogs, backups, and Undo for deleted resumes.

## Accessibility
* WCAG 2.2 AA is checked in CI-style by `npm run test:e2e` (axe-core, light and dark, every page, real contrast measurement).
* Keyboard: skip link, visible 3px focus ring, arrow-key tabs and menus, Escape closes dialogs and menus, icon buttons have names.
* Native `<dialog>`, `<details>` and form controls are used wherever possible, so browsers and screen readers do the heavy lifting.
* Motion is short and only answers an action; `prefers-reduced-motion` turns it off.
* Touch: controls are at least 32px (primary actions 40px); the editor collapses to one pane per view on small screens.

## Adding to the design system
1. Add a primitive in `src/components/ui/` and export it from `index.js`.
2. Style it in `src/styles/ui.css` using tokens only (no hard-coded colours except the paper and the highlighter).
3. Prefer composing primitives in `src/features/*` over new one-off CSS.
