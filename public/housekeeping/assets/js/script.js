// Header scroll effect
const header = document.getElementById('header');
let lastKnownScrollY = window.scrollY;
if (header) {
    window.addEventListener('scroll', () => {
        lastKnownScrollY = window.scrollY;
        header.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
}

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
let pageScrollY = 0;

function setPageScrollLocked(isLocked) {
    document.body.classList.toggle('nav-open', isLocked);
    header?.classList.toggle('nav-open', isLocked);

    if (isLocked) {
        pageScrollY = lastKnownScrollY || window.scrollY;
        document.body.style.top = `-${pageScrollY}px`;
    } else {
        const restoreY = pageScrollY;
        document.body.style.top = '';
        if (restoreY) window.scrollTo({ top: restoreY, behavior: 'auto' });
        lastKnownScrollY = restoreY || window.scrollY;
        pageScrollY = 0;
    }
}

if (menuToggle && navMenu) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-controls', 'navMenu');

    menuToggle.addEventListener('click', () => {
        const isOpen = !navMenu.classList.contains('active');
        menuToggle.classList.toggle('active', isOpen);
        navMenu.classList.toggle('active', isOpen);
        menuToggle.setAttribute('aria-expanded', String(isOpen));
        setPageScrollLocked(isOpen);
    });
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        menuToggle?.classList.remove('active');
        navMenu?.classList.remove('active');
        menuToggle?.setAttribute('aria-expanded', 'false');
        setPageScrollLocked(false);
    });
});

document.addEventListener('click', (e) => {
    if (navMenu && menuToggle && !navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        setPageScrollLocked(false);
    }
});

function closeMobileMenu() {
    menuToggle?.classList.remove('active');
    navMenu?.classList.remove('active');
    menuToggle?.setAttribute('aria-expanded', 'false');
    setPageScrollLocked(false);
}

window.addEventListener('pageshow', closeMobileMenu);
window.addEventListener('orientationchange', closeMobileMenu);
window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && navMenu?.classList.contains('active')) {
        closeMobileMenu();
    }
});

// Escape closes menu
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu?.classList.contains('active')) {
        closeMobileMenu();
    }
});

// Lang switcher: click toggle (works with hover + reliable on touch)
document.querySelectorAll('.lang-switch').forEach(ls => {
    const current = ls.querySelector('.lang-current');
    if (!current) return;
    current.addEventListener('click', (e) => {
        e.stopPropagation();
        ls.classList.toggle('open');
    });
});

// Close lang dropdown on outside click
document.addEventListener('click', (e) => {
    document.querySelectorAll('.lang-switch.open').forEach(ls => {
        if (!ls.contains(e.target)) ls.classList.remove('open');
    });
});

// Scroll reveal
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const top = target.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// Hero reveal on load
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('visible'));
    }, 150);
});

// ============================================
// STICKY BOTTOM BAR
// ============================================
const stickyBar = document.getElementById('sticky-bar');
const stickyClose = document.getElementById('stickyClose');
let stickyDismissed = false;

window.addEventListener('scroll', () => {
    if (!stickyBar || stickyDismissed) return;
    const scrollPct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    if (scrollPct > 0.35) {
        stickyBar.classList.add('visible');
    }
}, { passive: true });

stickyClose?.addEventListener('click', () => {
    stickyBar?.classList.remove('visible');
    stickyDismissed = true;
});

// ============================================
// EXIT INTENT POPUP
// ============================================
const exitPopup = document.getElementById('exit-popup');
const exitClose = document.getElementById('exitClose');
const exitOverlay = document.getElementById('exitOverlay');
const exitDismiss = document.getElementById('exitDismiss');
let exitShown = false;

function showExitPopup() {
    if (!exitPopup || exitShown) return;
    exitShown = true;
    exitPopup.classList.add('visible');
}

function hideExitPopup() {
    exitPopup?.classList.remove('visible');
    if (!navMenu?.classList.contains('active')) {
        setPageScrollLocked(false);
    }
}

// Desktop: mouse leaves viewport top
document.addEventListener('mouseleave', (e) => {
    if (window.innerWidth >= 1024 && window.scrollY > 400 && e.clientY < 0) {
        showExitPopup();
    }
});

// Avoid interrupting mobile scrolling with an automatic modal.

exitClose?.addEventListener('click', hideExitPopup);
exitOverlay?.addEventListener('click', hideExitPopup);
exitDismiss?.addEventListener('click', hideExitPopup);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideExitPopup();
});

// ============================================
// SOCIAL PROOF POPUP
// ============================================
const spPopup = document.getElementById('social-proof');
const spMsg = document.getElementById('spMsg');
const spClose = document.getElementById('spClose');

const spNotifications = [
    'Marco V. da Sirmione ha richiesto un preventivo PREMIUM',
    'Alessandra M. da Bellagio ha affidato la sua villa',
    'Roberto F. da Milano ha scelto il piano ELITE',
    'Chiara B. da Desenzano ha richiesto la gestione completa',
    'Luca T. da Cernobbio ha richiesto un preventivo SIGNATURE',
    'Giulia R. da Gardone Riviera ha scelto il piano PREMIUM',
    'Andrea C. da Como ha richiesto i servizi extra',
    'Federica S. da Malcesine ha affidato il suo appartamento',
    'Davide P. da Porta Nuova (MI) ha scelto il piano ELITE',
    'Sofia L. da Salò ha richiesto un preventivo PREMIUM',
    'Giorgio M. da Varenna ha affidato la sua proprietà',
    'Elena B. da City Life (MI) ha scelto la gestione completa',
    'Matteo F. da Bardolino ha richiesto il piano SIGNATURE',
    'Valentina C. da Menaggio ha scelto il piano PREMIUM',
    'Riccardo A. da Navigli (MI) ha affidato il suo immobile',
];

let spIndex = Math.floor(Math.random() * spNotifications.length);

function showSocialProof() {
    if (!spPopup || !spMsg) return;
    spMsg.textContent = spNotifications[spIndex % spNotifications.length];
    spIndex++;
    spPopup.classList.add('visible');
    setTimeout(() => spPopup.classList.remove('visible'), 6000);
}

function scheduleSocialProof() {
    const delay = (Math.floor(Math.random() * 3) + 4) * 60 * 1000; // 4–6 min
    setTimeout(() => {
        showSocialProof();
        scheduleSocialProof();
    }, delay);
}

spClose?.addEventListener('click', () => spPopup?.classList.remove('visible'));

// First show after 45 seconds
setTimeout(() => {
    showSocialProof();
    scheduleSocialProof();
}, 45000);

// Back to Top
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    }, { passive: true });
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
