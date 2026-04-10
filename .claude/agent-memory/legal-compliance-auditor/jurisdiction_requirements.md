---
name: jurisdiction_requirements
description: Legal frameworks applicable to this business and why, with key obligations
type: project
---

## Applicable Legal Frameworks

### GDPR (EU General Data Protection Regulation)
**Applies because:** The website is in 8 EU languages including French, Italian, Spanish, Romanian, Bulgarian, Polish. The site explicitly targets EU users. The operator is established in Romania (EU member state).
**Key obligations:**
- Lawful basis for all data processing
- Privacy notice at point of collection
- Cookie consent before non-essential tracking
- Data subject rights (access, erasure, portability)
- Third-party processor disclosure
- International transfer safeguards (Firebase/Google covered by SCCs)

### ePrivacy Directive (EU Cookie Law)
**Applies because:** Website uses Google Analytics (confirmed in script.js with GA_ID G-6JM3GTCVR4). Google Fonts loaded on booking page.
**Key obligations:** Consent before setting analytics cookies or loading external resources that transmit personal data.
**Current status:** Consent mode implemented correctly on main landing pages. Gap: booking page loads Google Fonts without consent.

### Romanian e-Commerce Law (OG 130/2000, Legea 365/2002)
**Applies because:** SOFTAPPS S.R.L. is a Romanian company selling digital services.
**Key obligations:** Company name, registered address, CUI, and Reg. Com. must be displayed on the website. Currently missing from 7 of 9 language pages.

### EU Consumer Rights Directive (2011/83/EU) — as implemented in Romanian law OG 34/2014
**Applies because:** App offers paid subscription (EUR 5.99/month / EUR 60/year) to consumers.
**Key obligations:** 14-day right of withdrawal for digital services (unless consumer explicitly waived it); clear pricing before purchase; cancellation terms.

### ANSPDCP (Romanian Data Protection Authority)
**Supervisory authority** for SOFTAPPS S.R.L. Complaint address: anspdcp.ro. Should be named in Privacy Policy as the competent DPA alongside the general EU DPA reference.

### LGPD (Brazilian General Data Protection Law)
**Potentially applies** because of Portuguese (Brazil) language support. If Brazilian users are targeted, LGPD requires a legal basis, data subject rights, and a Data Protection Officer (Encarregado) listed. At minimum, the PT privacy policy section already mentions "LGPD/GDPR" legal basis which is a good start.

### CCPA (California Consumer Privacy Act)
**Low risk** — no specific US targeting, no California-specific marketing. If US traffic remains incidental, CCPA likely does not apply as the revenue/user thresholds probably won't be met. Monitor if US user base grows.

### Google Play Developer Policy
**Applies to:** Android app.
**Key obligations:** Privacy policy URL must be in the Play Store listing; the policy must accurately reflect data collected by the app. The current privacy-policy-android.html URL is appropriate for this purpose.

### Apple App Store Guidelines
**Applies to:** iOS app (pending approval).
**Key obligations:** Privacy policy URL must be provided in App Store Connect; NSPrivacyManifest required for apps using certain APIs; App Privacy nutrition label must accurately reflect data practices.
**Note:** iOS app is not yet live. Ensure iOS privacy policy is updated/separated before submission.
