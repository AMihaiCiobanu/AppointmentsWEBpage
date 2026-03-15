// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const faqItem = button.parentElement;
        const isActive = faqItem.classList.contains('active');

        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });

        if (!isActive) {
            faqItem.classList.add('active');
        }
    });
});

// Google Analytics
// TODO: Replace '' with your Measurement ID, e.g. 'G-XXXXXXXXXX'
const GA_ID = '';

function loadGA() {
    if (!GA_ID) return;
    const s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    s.async = true;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
}

// Cookie Consent
const consent = localStorage.getItem('cookieConsent');
if (consent === 'accepted') {
    loadGA();
} else if (!consent) {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'flex';
}

document.getElementById('cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookie-banner').style.display = 'none';
    loadGA();
});

document.getElementById('cookie-decline')?.addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'declined');
    document.getElementById('cookie-banner').style.display = 'none';
});
