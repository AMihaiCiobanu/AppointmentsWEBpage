---
name: project_context
description: Business entity details, app overview, and site structure relevant to legal compliance
type: project
---

Legal entity: SOFTAPPS S.R.L.
Registration: CUI 54463640, Reg. Com. J2026023970005
Address: Aleea Sucidava Nr. 2, Iași 700442, Romania
Contact email: contact@appointmentsapps.com (obfuscated at runtime via base64 in script.js)
Website: https://appointmentsapps.com

Products:
- Android app: live on Google Play (com.AmihaiCiobanu.appointmenstreports)
- iOS app: pending Apple approval, shown as "Work in Progress" on site
- Online booking page: /booking/ — takes client name, phone, notes; submits to Firebase Firestore
- iOS waitlist form: uses Formspree (https://formspree.io/f/xojkyrjn) — collects email addresses

Target markets: Romania, EU (French, Italian, Spanish, Portuguese, Bulgarian, Polish language support), Brazil
User segments: Beauty salons, barbershops, doctors, trainers, mechanics — sole traders and small businesses

**Why:** Shapes which legal frameworks apply (GDPR mandatory, ANPC Romania consumer law, potentially CCPA for any US traffic, LGPD for Brazil).
**How to apply:** Always apply GDPR as the baseline. Romania-specific law (OUG 13/2012 on e-commerce) requires Romanian company registration details on all pages — this is a live gap in 7 of 9 language pages.
