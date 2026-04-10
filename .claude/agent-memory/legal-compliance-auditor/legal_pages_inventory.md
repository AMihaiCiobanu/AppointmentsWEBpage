---
name: legal_pages_inventory
description: All legal/compliance pages on the site — URLs, last updated dates, and current status
type: project
---

## Privacy Policy
- URL: https://appointmentsapps.com/privacy-policy-android.html
- Last updated: March 2026 (stated in subtitle)
- Coverage: Android app + website
- Status: EXISTS. Covers developer identity, data collected, permissions, storage, third parties, user rights, retention, GDPR legal basis, international transfers, DPA complaint right, age restriction.
- Gap: Title says "Android" — no separate iOS privacy policy page exists yet. When iOS launches, a separate or updated policy will be needed.
- Gap: Contact in policy uses obfuscated mailto link (data-contact attribute), not plain email text. This makes it harder for users to copy and submit a GDPR request.
- Gap: Policy does not mention Formspree (used by the iOS waitlist form) as a third-party processor.
- Gap: Policy is only available at the English URL; no translated standalone policy pages exist (translations are JS-injected via i18n.js, which works but depends on JS).

## Terms & Conditions
- URL: https://appointmentsapps.com/terms.html
- Last updated: April 2026
- Status: EXISTS. Covers acceptance, app purpose, user responsibilities, data ownership, cloud sync, availability, warranty disclaimer, liability limitation, IP, changes, contact, age restriction, app store terms, governing law (Romania), severability, online booking intermediary clause.
- Gap: No explicit refund/subscription cancellation policy (the app has a paid Pro plan at EUR 5.99/month or EUR 60/year — EU consumer law requires clear cancellation rights and cooling-off period disclosures for digital subscriptions).
- Gap: Contact link uses obfuscated mailto (data-contact), not a plain email address in the text.

## Cookie Policy
- Status: Incorporated into Privacy Policy sections 7 and 8. No standalone cookie policy page.
- This is acceptable if the Privacy Policy is clearly linked and the cookie banner links to it.

## Cookie Banner
- Status: EXISTS on all main landing pages (index.html and all 8 language variants).
- Implementation: Banner is hidden by default (display:none), shown only if no localStorage consent value. On accept: GA loads with consent granted. On decline: GA loads with consent denied (consent mode). Does NOT fire GA before consent decision.
- Gap: Banner does not link to the Privacy Policy.
- Gap: Banner does not appear on booking/index.html or on terms.html or privacy-policy-android.html standalone pages.

## Online Booking Page (/booking/)
- Status: Has footer links to Terms and Privacy Policy.
- Has inline consent note: "By submitting, you agree that your details will be shared with the service provider."
- Gap: This is informational notice, not active consent (no checkbox). Under GDPR Art. 7 and ePrivacy, processing client personal data (name, phone) for appointment booking arguably qualifies as contract performance (Art. 6(1)(b)) — which does NOT require a checkbox. However, the consent text is incomplete: it does not say who the service provider is (anonymous booking links), what data is retained, or how to request deletion.
- Gap: No cookie banner on the booking page. If Google Fonts (fonts.googleapis.com) is loaded, this counts as a tracking request under GDPR and requires consent or a self-hosted alternative.

## iOS Waitlist Form
- Present on all 9 language landing pages.
- Processor: Formspree (US-based). Emails collected and stored by Formspree.
- Gap: Formspree is not listed as a third-party processor in the Privacy Policy.
- Gap: No link to Privacy Policy adjacent to the form. Only a "No spam. One email when we launch, that's it." note — this does not constitute adequate GDPR notice for email collection.
- Gap: No consent checkbox before submission (relies on implied consent from submitting). GDPR requires unambiguous consent for marketing communications.
