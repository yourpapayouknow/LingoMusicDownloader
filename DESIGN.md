---
name: LingoMusicDownloader Design System
version: 1.1.1
source: Universal Quantum UI Tokens (frontend/src/tokens/tokens.ts)
---

# DESIGN.md — LingoMusicDownloader

## Overview
LingoMusicDownloader is a Tauri + React desktop application for Apple Music lossless audio, music video, and metadata management. Built atop the `Universal Quantum UI Tokens` (`v1.1.1`) architecture, it pairs deep-sea navy surfaces and cyan-teal accents (`#0FF7E5` / `#00CDBD`) with warm high-contrast orange primary actions (`#FF6D00` / `#E65100`) and frosted translucent panels in both dark and light themes.

## Colors
### Primitives
- **Base Neutrals**: `black_oled` (`#121212`), `white_pure` (`#FFFFFF`), `gray-50` (`#FAFAFA`), `gray-100` (`#F5F5F5`), `gray-200` (`#EEEEEE`), `gray-700` (`#616161`), `gray-800` (`#424242`), `gray-900` (`#212121`).
- **Navy Surfaces**: `navy-900` (`#0E1722`), `navy-800` (`#152131`), `navy-700` (`#1E2D3F`).
- **Teal Accents**: `teal-50` (`#EAFFFC`), `teal-100` (`#C8FFF8`), `teal-500` (`#0FF7E5`), `teal-700` (`#00CDBD`), `teal-900` (`#00756D`).
- **Action Orange**: `orange-500` (`#FF6D00`), `orange-700` (`#E65100`), `orange-900` (`#BF360C`).
- **Semantic Error**: `error-light` (`#EF5350`), `error-dark` (`#CF6679`).

### Semantic Mapping
| Token | Dark Mode | Light Mode |
| --- | --- | --- |
| `--bg-base` | `#0E1722` | `#FAFAFA` |
| `--bg-surface` | `#152131` | `#FFFFFF` |
| `--text-primary` | `#FAFAFA` | `#212121` |
| `--text-secondary` | `#EEEEEE` | `#616161` |
| `--component-wrapped-bg` | `#00CDBD` | `#C8FFF8` |
| `--component-wrapped-text` | `#EAFFFC` | `#00756D` |
| `--action-primary` | `#FF6D00` | `#E65100` |
| `--action-primary-hover` | `#E65100` | `#BF360C` |
| `--text-on-action` | `#212121` | `#FFFFFF` |
| `--system-error` | `#CF6679` | `#EF5350` |

## Typography
- **Font Family**: `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', 'Segoe UI', sans-serif`
- **Base Style**: `line-height: 1.5`, `font-weight: 500`
- **Headings**:
  - `H2` (`.ui-heading-2`): `clamp(1.5rem, 2vw + 1rem, 2.2rem)`, `letter-spacing: -0.02em`, `line-height: 1.2`
  - `H3` (`.ui-heading-3`): `clamp(1.1rem, 1.2vw + 0.9rem, 1.5rem)`
  - `H4` (`.ui-heading-4`): `1.18rem`
- **Body & Labels**: Primary body `0.94rem`, auxiliary/caption `0.78rem–0.84rem`.

## Layout
- **Spacing Unit**: `--spacing-base: 4px`
  - `compact`: `8px` (`calc(4px * 2)`)
  - `normal`: `16px` (`calc(4px * 4)`)
  - `loose`: `24px` (`calc(4px * 6)`)
- **Structure**: Centered `app-sections` container (`width: min(1100px, 100%)`), main viewport padding `calc(var(--padding-loose) * 1.2)`, bottom playback clearance `90px`.
- **Primitives**: `Box`, `HStack`, `VStack`, `ZStack`, `Grid`, `ScrollView`, `Spacer`, `Divider`.

## Elevation & Depth
- **Dark Mode**: `panel-blur: 22px`, `panel-opacity: 0.72`, layered shadows (`surface-shadow`, `soft-shadow`, `glow-shadow`), and teal glass tint gradient.
- **Light Mode**: `panel-blur: 18px`, `panel-opacity: 0.84`, soft cyan-tinted shadows and crisp 1px borders (`color-mix(in srgb, var(--text-secondary) 18%, transparent)`).
- **Motion**: `transition-quick` (`180ms cubic-bezier(0.22, 1, 0.36, 1)`), `transition-normal` (`300ms`), `transition-slow` (`460ms`).

## Shapes
- **Radius Base**: `--radius-base: 5px`
- **Control Radius** (`--radius-control`): `10px` (buttons, inputs, `Menu` selects)
- **Container Radius** (`--radius-container`): `15px` (cards, accordion sections, modals)
- **Pill Radius** (`--radius-full`): `9999px` (badges, toggles, avatars, segmented controls)

## Components
- **`Button` / `IconButton`**: Variants `primary`, `secondary`, `ghost`; sizes `sm`, `md`, `lg`; orange focus glow (`--focus-glow`).
- **`Menu` (Select Dropdown)**: Wrapped in `.ui-field.ui-menu-field` -> `.ui-select-wrap` with custom chevron icon and disabled opacity/cursor state. Used in Settings for audio codec, MV resolution, and metadata region selection.
- **`Toggle`**: Pill track switch for boolean settings (Wrapper lossless toggle, transcoding options).
- **`Box` Accordions**: Expandable single-layer surface cards (`border`, `radius="container"`) separated by `<Divider />` and `16px` inner padding.
- **`Badge` & `Toast`**: Inline status badges (`default`, `info`, `success`, `error`) and non-blocking floating notifications.

## Do's and Don'ts
- **Do** reuse existing UI primitives (`Box`, `VStack`, `HStack`, `Menu`, `Toggle`, `Divider`, `Text`) and CSS token variables instead of hardcoding colors or spacing.
- **Do** place explanatory notes inside compact tooltips (`title` / hover hints) or concise secondary lines matching adjacent controls, keeping labels short and direct.
- **Don't** introduce emojis into interface labels, buttons, or badges.
- **Don't** nest multi-layer bordered cards inside accordion panels; separate grouped settings with `<Divider />`.
- **Don't** invent divergent styles for select dropdowns or toggles; keep one consistent `Menu` / `Toggle` appearance across the application.
