const MOBILE_BREAKPOINT = 768;

// Dark Mode Toggle
const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_ICON  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (_) {}
    applyTheme(next);
});

// Scroll Animations
const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            animateObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('[data-animate]').forEach(el => {
    // stagger siblings in the same grid
    const siblings = Array.from(el.parentElement.querySelectorAll('[data-animate]'));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = `${index * 0.1}s`;
    animateObserver.observe(el);
});

// Count-up animation for stats
function countUp(el, target, suffix) {
    if (target === 0) { el.textContent = '0' + suffix; return; }
    const duration = 1400;
    const start = performance.now();
    const update = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            countUp(el, parseInt(el.dataset.count), el.dataset.suffix || '');
            countObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));

// Nav menu dropdown
const navMenuToggle = document.getElementById('nav-menu-toggle');
const navMenuDropdown = document.getElementById('nav-menu-dropdown');

navMenuToggle?.addEventListener('click', e => {
    e.stopPropagation();
    navMenuDropdown.classList.toggle('open');
    navMenuToggle.classList.toggle('open');
});

document.addEventListener('click', () => {
    navMenuDropdown?.classList.remove('open');
    navMenuToggle?.classList.remove('open');
});

navMenuDropdown?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navMenuDropdown.classList.remove('open');
        navMenuToggle.classList.remove('open');
    });
});

// Hide header on scroll down / show on scroll up (mobile only) + Scroll-to-top button
const header = document.querySelector('header');
const scrollTopBtn = document.getElementById('scroll-top');
let lastScrollY = 0;

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

    if (isMobile && currentScrollY > 80) {
        if (currentScrollY > lastScrollY) {
            header.classList.add('header-hidden');
            navMenuDropdown?.classList.remove('open');
            navMenuToggle?.classList.remove('open');
        } else {
            header.classList.remove('header-hidden');
        }
    } else {
        header.classList.remove('header-hidden');
    }

    lastScrollY = currentScrollY;

    if (scrollTopBtn) {
        scrollTopBtn.classList.toggle('visible', currentScrollY > 300);
    }
}, { passive: true });

scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Contact links — assemble mailto at runtime so the address isn't in plain HTML
(function () {
    const u = atob('Y19taWhhaWw=');   // c_mihail
    const d = atob('aWNsb3VkLmNvbQ=='); // icloud.com
    const base = 'mailto:' + u + '@' + d;
    document.querySelectorAll('a[data-contact]').forEach(a => {
        const type = a.dataset.contact;
        if (type === 'demo') {
            a.href = base + '?subject=Demo%20session%20request&body=Hi%2C%0A%0AI%27d%20like%20to%20schedule%20a%20demo%20session%20for%20Appointments%20%26%20Reports.%0A%0AName%3A%20%0ABusiness%3A%20%0APhone%3A%20';
        } else if (type === 'website') {
            a.href = base + '?subject=Website%20collaboration%20inquiry&body=Hi%2C%0A%0AI%27d%20like%20to%20discuss%20a%20website%20project.%0A%0AName%3A%20%0ABusiness%3A%20%0AWebsite%3A%20';
        } else {
            a.href = base + '?subject=Appointments%20%26%20Reports%20%E2%80%93%20Contact&body=Hi%2C%0A%0A';
        }
    });
})();

// Smooth scroll for nav anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            e.preventDefault();
            const headerHeight = document.querySelector('header').offsetHeight;
            const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const faqItem = button.parentElement;
        const isActive = faqItem.classList.contains('active');

        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
            item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });

        if (!isActive) {
            faqItem.classList.add('active');
            button.setAttribute('aria-expanded', 'true');
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
let consent;
try { consent = localStorage.getItem('cookieConsent'); } catch (_) {}

if (consent === 'accepted') {
    loadGA();
} else if (!consent) {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'flex';
}

document.getElementById('cookie-accept')?.addEventListener('click', () => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch (_) {}
    document.getElementById('cookie-banner').style.display = 'none';
    loadGA();
});

document.getElementById('cookie-decline')?.addEventListener('click', () => {
    try { localStorage.setItem('cookieConsent', 'declined'); } catch (_) {}
    document.getElementById('cookie-banner').style.display = 'none';
});
