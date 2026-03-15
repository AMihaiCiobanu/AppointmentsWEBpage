# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing landing page for **"Appointments & Reports"** — an iOS/iPadOS/Mac app for appointment scheduling and financial reporting targeting beauty salons, barbershops, and service-based businesses.

There are two companion apps:

- **Android** → `/Users/mihai/Sites/AppointmenstReports` (Kotlin/Gradle). In Google Play testing; will be live at site launch. Play Store URL not yet available — placeholder `#` in the HTML. Supports 8 languages: Romanian, English, Spanish, French, Italian, Portuguese (Brazil), Bulgarian, Polish.
- **iOS** → `/Users/mihai/Sites/Appointments&Reports` (SwiftUI/SwiftData, iOS 16.2+). Pending Apple approval — shown as "Work in Progress" on the site. Supports 6 languages (missing Bulgarian and Polish vs Android).

When updating landing page content, the **Android app is the source of truth** for current features. Do not present iOS as feature-complete until it receives Apple approval.

## Development

**No build process.** This is a pure static site (HTML/CSS/JS). Serve locally with:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Architecture

Three files make up the entire site:

- **`index.html`** — Full landing page structured as sequential sections: hero → features grid → devices → target audience → problem/solution → reports & security → FAQ accordion → CTA → footer
- **`styles.css`** — All styling using CSS custom properties for the color palette (deep violet `#2e1065`, fuchsia `#d946ef`, light purple background `#faf5ff`). Mobile-first with a single breakpoint at `768px`.
- **`script.js`** — Single responsibility: FAQ accordion (one item open at a time via `.active` class toggle)

Assets in `assets/` are app screenshots used inside CSS-styled device mockups (iPhone and tablet frames built purely in CSS).

## Key Conventions

- SVG icons are inlined directly in HTML (not external files)
- Device mockups (`.iphone-mockup`, `.tablet-mockup`) are CSS-only frames — no image assets for the frame itself
- The contact email is `c_mihail@icloud.com` (used in mailto links)
- `privacy-policy-android.html` is a standalone page linked from the footer
