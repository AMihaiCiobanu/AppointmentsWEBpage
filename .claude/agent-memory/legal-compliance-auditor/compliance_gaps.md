---
name: compliance_gaps
description: All compliance gaps identified in the April 2026 audit with severity, legal basis, and remediation status
type: project
---

## Audit date: 2026-04-10

### CRITICAL (must fix before/at launch)

1. **Company registration numbers missing on 7 of 9 language pages**
   - Affected: index.html (EN), es/, fr/, it/, pt/, bg/, pl/ — all show "Reg. Com.: xxxxx | CUI: xxxxx"
   - Correct values (from privacy-policy-android.html and ro/): Reg. Com. J2026023970005, CUI 54463640
   - Legal basis: Romanian OG 130/2000 and e-Commerce Directive require legal name, address, and registration numbers to be visibly displayed. Also required by EU e-commerce law for cross-border traders.
   - Status: OPEN

2. **iOS waitlist form lacks GDPR-compliant consent for email marketing**
   - Issue: No privacy policy link adjacent to the form; no explicit consent checkbox; Formspree (US processor) not disclosed in Privacy Policy.
   - Legal basis: GDPR Art. 6(1)(a) — email marketing requires explicit consent; Art. 13 — data subjects must be informed at point of collection.
   - Fix: Add "By signing up, you agree to receive one launch notification. See our [Privacy Policy]." adjacent to form. Add Formspree to Privacy Policy section 5. Consider adding a checkbox.
   - Status: OPEN

3. **Cookie banner missing from /booking/, terms.html, and privacy-policy-android.html**
   - Issue: Google Fonts is loaded on booking/index.html via fonts.googleapis.com. This is an external request that may transmit IP address to Google without consent. The main landing pages have a consent banner; the booking page does not.
   - Legal basis: GDPR / ePrivacy Directive — any non-essential external resource that transmits personal data requires prior consent.
   - Fix: Either self-host the Inter font (preferred), or add the cookie banner to booking/index.html. The standalone legal pages (terms.html, privacy-policy-android.html) do not load external fonts so this is lower risk there.
   - Status: OPEN

4. **No subscription cancellation / refund policy**
   - Issue: The Pro plan is EUR 5.99/month or EUR 60/year. EU Consumer Rights Directive (2011/83/EU) requires clear information on the right of withdrawal (14-day cooling-off period) for digital subscriptions sold to consumers. Terms Section 6 says "we may discontinue features" but there is no cancellation, refund, or withdrawal rights clause.
   - Legal basis: EU CRD, Romanian OG 34/2014.
   - Fix: Add a Section 17 to terms.html: "Subscriptions and cancellations — You may cancel your Pro subscription at any time via the Google Play Store. Cancellation takes effect at the end of the current billing period. As a consumer in the EU, you have a 14-day right of withdrawal from the date of initial purchase, after which no refund is due for the current period. Refund requests: contact@appointmentsapps.com."
   - Status: OPEN

### IMPORTANT (fix soon)

5. **Booking page consent notice is incomplete**
   - Issue: The booking page says "By submitting, you agree that your details will be shared with the service provider." This is valid for the data-sharing disclosure but does not tell clients: (a) who the service provider is, (b) how long their data is stored, (c) how to request deletion.
   - Legal basis: GDPR Art. 13 — the data controller (the salon/professional using the app) must inform data subjects at point of collection. The Terms Section 16 places this responsibility on the service provider, which is reasonable, but the booking page itself could do more.
   - Fix: Expand the consent note to: "By submitting, your name, phone number and any note will be shared with the service provider who owns this booking link. They control your data under their own privacy policy. Contact them directly to request deletion. See our [Terms & Conditions] and [Privacy Policy]."
   - Status: OPEN

6. **Privacy Policy does not mention Formspree as a data processor**
   - Issue: Section 5 of the Privacy Policy lists only Google/Firebase. Formspree processes email addresses of iOS waitlist signups.
   - Fix: Add to Section 5: "Formspree (Formspree Inc., USA) — used to receive iOS waitlist sign-up requests. Subject to Formspree's Privacy Policy."
   - Status: OPEN

7. **Contact email not shown in plain text in legal documents**
   - Issue: Both Privacy Policy and Terms link to a JavaScript-assembled mailto: link (data-contact attribute + base64 decoding in script.js). If JavaScript is disabled or a user wants to copy the address for a formal GDPR request letter, they cannot easily do so.
   - Fix: Add "contact@appointmentsapps.com" as visible plain text in the Contact sections of both legal pages, in addition to the mailto link.
   - Status: OPEN

8. **Cookie banner does not link to the Privacy Policy**
   - Issue: The cookie banner says what cookies do but does not include a "Learn more" or "Privacy Policy" link.
   - Legal basis: GDPR recital 42, ICO guidance — consent must be "informed," which includes knowing where to find more detail.
   - Fix: Add a link to privacy-policy-android.html within the banner text.
   - Status: OPEN

### RECOMMENDED (best practice)

9. **No separate iOS Privacy Policy yet**
   - When the iOS app launches it may collect different data (Face ID, Live Activities). The current policy is scoped to "Android" in its title and subtitle. A combined or updated policy will be needed.
   - Status: OPEN — deferred until iOS launch.

10. **Google Analytics consent mode fires GA script even on Decline**
    - In script.js, when the user declines, GA is still loaded (loadGA() is called) but with consent mode set to 'denied'. This is technically compliant with Google Consent Mode v2 but may be confusing to privacy-conscious users and could still set a __ga cookie. Consider not loading GA at all on decline.
    - Status: OPEN (low risk given consent mode implementation).

11. **Testimonials appear to be illustrative, not verified**
    - "Alex M., Barbershop owner", "Diana K., Physiotherapist", "Radu T., Personal Trainer" — if these are not real, verified users, this could violate consumer protection rules on fake testimonials (EU Directive 2005/29/EC on unfair commercial practices).
    - Fix: Either use verified real testimonials with permission, or add a small disclaimer: "Illustrative feedback based on early user testing."
    - Status: OPEN (requires business decision).

12. **WCAG / Accessibility gaps**
    - Logo image in booking/index.html has empty alt="" (acceptable for decorative use, but the logo is also a link — screen readers may not announce it properly without alt text).
    - Cookie banner lacks `role="dialog"` and `aria-labelledby` attributes.
    - Status: OPEN (lower legal risk, more UX).

13. **No Data Protection Officer (DPO) listed**
    - For a Romanian company processing EU personal data, a DPO is only required if processing is large-scale or involves special categories. For this app's scale, it is likely not required. However, the supervisory authority contact (ANSPDCP for Romania) could be named in the Privacy Policy alongside the generic DPA reference.
    - Status: INFORMATIONAL.
