/**
 * ==========================================================================
 * LÓGICA DE RENDERIZADO Y FUNCIONALIDADES INTERACTIVAS (SCRIPTS.JS)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Poblado de Información General
    populateGeneralInfo();

    // 2. Renderizado de Componentes Dinámicos
    renderStats();
    renderServices();
    renderFeatures();
    renderDoctors();
    renderSocialLinks();

    // 3. Formulario WhatsApp
    initAppointmentForm();

    // 4. Inicializar ScrollReveal
    initScrollReveal();
});

/* --- POBLADO DE INFORMACIÓN GENERAL Y SEO --- */
function populateGeneralInfo() {
    // SEO
    document.title = `${CLINIC_CONFIG.brandName} | Consultorio Dental y Odontología Especializada`;
    document.getElementById('seo-title').innerText = `${CLINIC_CONFIG.brandName} | Consultorio Dental`;
    document.getElementById('seo-desc').setAttribute('content', CLINIC_CONFIG.seoDescription);
    document.getElementById('seo-author').setAttribute('content', CLINIC_CONFIG.brandName);
    
    document.getElementById('og-title').setAttribute('content', `${CLINIC_CONFIG.brandName} | Cuidado Dental Especializado`);
    document.getElementById('og-desc').setAttribute('content', CLINIC_CONFIG.seoDescription);
    document.getElementById('og-url').setAttribute('content', CLINIC_CONFIG.websiteUrl);

    // Schema JSON-LD
    const schemaObj = {
        "@context": "https://schema.org",
        "@type": "Dentist",
        "name": CLINIC_CONFIG.brandName,
        "telephone": CLINIC_CONFIG.phoneDisplay,
        "email": CLINIC_CONFIG.email,
        "address": CLINIC_CONFIG.address,
        "openingHours": CLINIC_CONFIG.openingHours
    };
    document.getElementById('schema-json').textContent = JSON.stringify(schemaObj);

    // Marca y textos repetidos
    document.querySelectorAll('.data-brand-name').forEach(el => el.innerText = CLINIC_CONFIG.brandName);
    document.querySelectorAll('.data-promo').forEach(el => el.innerText = CLINIC_CONFIG.topPromoText);
    document.querySelectorAll('.data-phone').forEach(el => el.innerText = CLINIC_CONFIG.phoneDisplay);
    document.querySelectorAll('.data-address').forEach(el => el.innerText = CLINIC_CONFIG.address);
    document.querySelectorAll('.data-hours').forEach(el => el.innerText = CLINIC_CONFIG.openingHours);

    // Hero section
    document.querySelector('.data-hero-subtitle').innerText = CLINIC_CONFIG.hero.subtitle;
    document.querySelector('.data-hero-title').innerHTML = CLINIC_CONFIG.hero.title;
    document.querySelector('.data-hero-desc').innerText = CLINIC_CONFIG.hero.description;
    document.querySelector('.data-stat-satisfaction').innerText = CLINIC_CONFIG.hero.satisfactionRate;

    // Testimonio
    document.querySelector('.data-testimonial-quote').innerText = `"${CLINIC_CONFIG.testimonial.quote}"`;
    document.querySelector('.data-testimonial-author').innerText = CLINIC_CONFIG.testimonial.author;
    document.querySelector('.data-testimonial-role').innerText = CLINIC_CONFIG.testimonial.role;

    // Enlaces a WhatsApp generados
    const waUrl = `https://wa.me/${CLINIC_CONFIG.whatsappNumber}?text=${encodeURIComponent("Hola, me gustaría agendar una consulta")}`;
    document.querySelectorAll('.wa-link-btn').forEach(btn => btn.setAttribute('href', waUrl));

    // Año Footer
    document.getElementById('current-year').innerText = new Date().getFullYear();
}

/* --- RENDERIZAR ESTADÍSTICAS --- */
function renderStats() {
    const container = document.getElementById('stats-container');
    container.innerHTML = CLINIC_CONFIG.stats.map(stat => `
        <div class="col-6 col-md-3">
            <div class="stat-number">${stat.number}</div>
            <p class="stat-label">${stat.label}</p>
        </div>
    `).join('');
}

/* --- RENDERIZAR SERVICIOS --- */
function renderServices() {
    const container = document.getElementById('services-container');
    const footerList = document.getElementById('footer-services-list');
    const formSelect = document.getElementById('formService');

    container.innerHTML = CLINIC_CONFIG.services.map(service => {
        const waMsg = encodeURIComponent(`Hola, deseo información sobre ${service.title}`);
        return `
            <div class="col-md-6 col-lg-3">
                <div class="service-card">
                    <img src="${service.image}" alt="${service.title}" class="service-img">
                    <h3 class="service-title">${service.title}</h3>
                    <p class="text-muted small">${service.description}</p>
                    <a href="https://wa.me/${CLINIC_CONFIG.whatsappNumber}?text=${waMsg}" target="_blank" class="text-decoration-none fw-bold small" style="color: var(--primary-color);">
                        Más Información <i class="bi bi-arrow-right"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');

    // Footer Lista
    footerList.innerHTML = CLINIC_CONFIG.services.map(s => `
        <li class="mb-2"><a href="#servicios">${s.title}</a></li>
    `).join('');

    // Form Select
    formSelect.innerHTML = CLINIC_CONFIG.services.map(s => `
        <option value="${s.title}">${s.title}</option>
    `).join('');
}

/* --- RENDERIZAR CARACTERÍSTICAS --- */
function renderFeatures() {
    const container = document.getElementById('features-container');
    container.innerHTML = CLINIC_CONFIG.features.map(f => `
        <div class="col-md-6 col-lg-3">
            <div class="feature-card-white">
                <div class="feature-icon-box"><i class="bi ${f.icon}"></i></div>
                <h4 class="h6 fw-bold">${f.title}</h4>
                <p class="text-muted extra-small mb-0">${f.desc}</p>
            </div>
        </div>
    `).join('');
}

/* --- RENDERIZAR DOCTORES --- */
function renderDoctors() {
    const container = document.getElementById('doctors-container');
    container.innerHTML = CLINIC_CONFIG.doctors.map(d => `
        <div class="col-sm-6 col-lg-3">
            <div class="doctor-card text-center">
                <img src="${d.image}" alt="${d.name}" class="doctor-img">
                <div class="p-3">
                    <h3 class="h6 fw-bold mb-1">${d.name}</h3>
                    <p class="text-muted small mb-0">${d.role}</p>
                </div>
            </div>
        </div>
    `).join('');
}

/* --- RENDERIZAR REDES SOCIALES --- */
function renderSocialLinks() {
    const container = document.getElementById('social-links-container');
    const links = CLINIC_CONFIG.socialLinks;
    container.innerHTML = `
        ${links.facebook ? `<a href="${links.facebook}" target="_blank" aria-label="Facebook"><i class="bi bi-facebook"></i></a>` : ''}
        ${links.instagram ? `<a href="${links.instagram}" target="_blank" aria-label="Instagram"><i class="bi bi-instagram"></i></a>` : ''}
        ${links.twitter ? `<a href="${links.twitter}" target="_blank" aria-label="Twitter"><i class="bi bi-twitter-x"></i></a>` : ''}
    `;
}

/* --- TOGGLE WHATSAPP POPUP WIDGET --- */
function toggleWhatsApp() {
    const popup = document.getElementById('waPopup');
    popup.style.display = (popup.style.display === 'flex') ? 'none' : 'flex';
}

/* --- FORMULARIO DE CITAS A WHATSAPP --- */
function initAppointmentForm() {
    const form = document.getElementById('appointmentForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('formName').value;
        const phone = document.getElementById('formPhone').value;
        const service = document.getElementById('formService').value;
        const message = document.getElementById('formMessage').value;

        const text = `Hola, mi nombre es ${name}. Mi número es ${phone}. Estoy interesado en el servicio de ${service}. ${message ? 'Nota: ' + message : ''}`;
        const encodedText = encodeURIComponent(text);

        window.open(`https://wa.me/${CLINIC_CONFIG.whatsappNumber}?text=${encodedText}`, '_blank');
    });
}

/* --- SCROLL REVEAL ANIMATIONS --- */
function initScrollReveal() {
    if (typeof ScrollReveal !== 'undefined') {
        ScrollReveal().reveal('.hero-title, .subtitle-script', { delay: 200, origin: 'top', distance: '30px', duration: 800 });
        ScrollReveal().reveal('.service-card', { delay: 200, interval: 100, origin: 'bottom', distance: '30px', duration: 800 });
        ScrollReveal().reveal('.doctor-card', { delay: 200, interval: 100, origin: 'bottom', distance: '30px', duration: 800 });
        ScrollReveal().reveal('.feature-teal-bg', { delay: 200, origin: 'bottom', distance: '30px', duration: 800 });
        ScrollReveal().reveal('.cta-box', { delay: 200, origin: 'bottom', distance: '30px', duration: 800 });
    }
}
