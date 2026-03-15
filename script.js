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

// Hamburger Menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');

hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
});

navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
    });
});

// Hide header on scroll down, show on scroll up (mobile only)
const header = document.querySelector('header');
let lastScrollY = 0;

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const isMobile = window.innerWidth < 768;

    if (isMobile && currentScrollY > 80) {
        if (currentScrollY > lastScrollY) {
            // scrolling down — hide header and close menu
            header.classList.add('header-hidden');
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        } else {
            // scrolling up — show header
            header.classList.remove('header-hidden');
        }
    } else {
        header.classList.remove('header-hidden');
    }

    lastScrollY = currentScrollY;
}, { passive: true });

// Scroll to Top
const scrollTopBtn = document.getElementById('scroll-top');

window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        scrollTopBtn.classList.add('visible');
    } else {
        scrollTopBtn.classList.remove('visible');
    }
}, { passive: true });

scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

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
