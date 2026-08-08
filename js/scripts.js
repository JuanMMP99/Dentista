/**
 * ==========================================================================
 * LÓGICA DE RENDERIZADO Y FUNCIONALIDADES INTERACTIVAS (SCRIPTS.JS)
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Poblado de Información General
    populateGeneralInfo();

    // 2. Renderizado de Componentes Dinámicos
    renderStats();
    renderServices();
    renderFeatures();
    renderDoctors();
    renderSocialLinks();
    renderLocations();

    // 3. Inicializar Sistema de Agenda
    initAppointmentSystem();

    // 4. Inicializar ScrollReveal
    initScrollReveal();
});

/* --- SISTEMA DE AGENDA DE CITAS --- */
function initAppointmentSystem() {
    const form = document.getElementById('appointmentForm');
    
    // Agregar campos de fecha y hora si no existen
    addDateTimeFields();
    
    // Obtener referencias a los campos
    const dateInput = document.getElementById('formDate');
    const timeSelect = document.getElementById('formTime');
    const locationSelect = document.getElementById('formLocation');
    
    if (!dateInput || !timeSelect) {
        console.error('No se encontraron los campos de fecha y hora');
        return;
    }

    // Configurar fecha mínima = hoy
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateInput.setAttribute('min', todayStr);
    dateInput.value = todayStr;

    // Evento para verificar disponibilidad al cambiar fecha o sucursal
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            validateAndCheckAvailability();
        });
    }

    if (locationSelect) {
        locationSelect.addEventListener('change', () => {
            validateAndCheckAvailability();
        });
    }

    // Submit del formulario
    form.addEventListener('submit', handleAppointmentSubmit);

    // Verificar disponibilidad inicial
    setTimeout(validateAndCheckAvailability, 500);
}

function addDateTimeFields() {
    const form = document.getElementById('appointmentForm');
    
    // Verificar si ya existen los campos
    if (document.getElementById('formDate')) return;

    // Encontrar el campo de servicio para insertar después
    const serviceField = document.getElementById('formService');
    const locationField = document.getElementById('formLocation');
    
    if (!serviceField || !locationField) {
        console.error('No se encontraron los campos necesarios');
        return;
    }

    // Crear contenedor para fecha y hora
    const dateTimeContainer = document.createElement('div');
    dateTimeContainer.className = 'row g-3 mb-3';
    dateTimeContainer.innerHTML = `
        <div class="col-md-6">
            <label class="form-label small fw-bold">Fecha de la Cita *</label>
            <input type="date" class="form-control" id="formDate" required />
            <div id="dateValidationMsg" class="small text-muted mt-1"></div>
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">Hora de la Cita *</label>
            <select class="form-select" id="formTime" required>
                <option value="">-- Seleccionar hora --</option>
            </select>
            <div id="timeValidationMsg" class="small text-muted mt-1"></div>
        </div>
    `;

    // Insertar después del campo de ubicación
    if (locationField.parentNode) {
        locationField.parentNode.insertBefore(dateTimeContainer, locationField.nextSibling);
    }

    // Agregar campo de disponibilidad
    const availabilityDiv = document.createElement('div');
    availabilityDiv.className = 'mb-3';
    availabilityDiv.innerHTML = `
        <div id="availabilityMessage" class="small"></div>
    `;
    
    const timeContainer = dateTimeContainer.querySelector('.col-md-6:last-child');
    if (timeContainer) {
        timeContainer.appendChild(availabilityDiv.querySelector('#availabilityMessage'));
    }
}

function validateAndCheckAvailability() {
    const dateInput = document.getElementById('formDate');
    const timeSelect = document.getElementById('formTime');
    const locationSelect = document.getElementById('formLocation');
    const dateValidationMsg = document.getElementById('dateValidationMsg');
    const availabilityMsg = document.getElementById('availabilityMessage');

    if (!dateInput || !timeSelect || !locationSelect) return;

    const fecha = dateInput.value;
    const sucursal = locationSelect.value;

    // Validar fecha
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const selectedDate = new Date(fecha + 'T00:00:00');

    if (!fecha) {
        if (dateValidationMsg) {
            dateValidationMsg.innerHTML = '<span class="text-warning">⚠️ Selecciona una fecha</span>';
        }
        timeSelect.innerHTML = '<option value="">-- Seleccionar hora --</option>';
        if (availabilityMsg) availabilityMsg.innerHTML = '';
        return;
    }

    // Validar que la fecha no sea anterior a hoy
    if (selectedDate < new Date(todayStr + 'T00:00:00')) {
        if (dateValidationMsg) {
            dateValidationMsg.innerHTML = '<span class="text-danger">❌ No se pueden agendar citas en fechas pasadas</span>';
        }
        timeSelect.innerHTML = '<option value="">-- Seleccionar hora --</option>';
        if (availabilityMsg) availabilityMsg.innerHTML = '';
        return;
    }

    if (dateValidationMsg) {
        dateValidationMsg.innerHTML = '<span class="text-success">✅ Fecha válida</span>';
    }

    if (!sucursal) {
        if (availabilityMsg) {
            availabilityMsg.innerHTML = '<span class="text-warning">⚠️ Selecciona una sucursal</span>';
        }
        timeSelect.innerHTML = '<option value="">-- Seleccionar hora --</option>';
        return;
    }

    // Verificar disponibilidad
    checkAvailability();
}

// Función auxiliar para asegurarnos de que la hora siempre tenga 2 dígitos en la hora (ej: "9:00" -> "09:00")
function normalizeTimeStr(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return timeStr.trim();
}

async function checkAvailability() {
    const dateInput = document.getElementById('formDate');
    const locationSelect = document.getElementById('formLocation');
    const timeSelect = document.getElementById('formTime');
    const availabilityMsg = document.getElementById('availabilityMessage');

    if (!dateInput || !locationSelect || !timeSelect) return;

    const fecha = dateInput.value;
    const sucursal = locationSelect.value;

    if (!fecha || !sucursal) {
        timeSelect.innerHTML = '<option value="">-- Seleccionar hora --</option>';
        if (availabilityMsg) {
            availabilityMsg.innerHTML = '<span class="text-muted">Selecciona fecha y sucursal</span>';
        }
        return;
    }

    try {
        const ocupados = await API.getCitas(fecha, sucursal);
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const isToday = fecha === todayStr;
        
        // Normalizamos todas las horas recibidas de la API a formato "HH:mm"
        const horariosOcupados = ocupados.map(c => normalizeTimeStr(c.hora));
        
        // Filtramos sobre la lista global de horarios de la clínica
        let horariosDisponibles = CLINIC_CONFIG.timeSlots.filter(
            hora => !horariosOcupados.includes(normalizeTimeStr(hora))
        );

        // Si es el día de hoy, descardamos horas que ya pasaron
        if (isToday) {
            horariosDisponibles = horariosDisponibles.filter(hora => {
                const [h, m] = hora.split(':').map(Number);
                const horaDate = new Date();
                horaDate.setHours(h, m, 0, 0);
                return horaDate > now;
            });
        }

        timeSelect.innerHTML = '<option value="">-- Seleccionar hora --</option>';
        
        if (horariosDisponibles.length === 0) {
            let mensaje = 'No hay horarios disponibles para esta fecha y sucursal.';
            if (isToday) {
                mensaje = 'No hay horarios disponibles para el resto del día de hoy.';
            }
            timeSelect.innerHTML += `<option value="" disabled>${mensaje}</option>`;
            if (availabilityMsg) {
                availabilityMsg.innerHTML = `
                    <span class="text-danger">
                        <i class="bi bi-exclamation-circle"></i> 
                        ${mensaje}
                    </span>
                `;
            }
            return;
        }

        horariosDisponibles.forEach(hora => {
            const option = document.createElement('option');
            option.value = hora;
            option.textContent = hora;
            timeSelect.appendChild(option);
        });

        if (availabilityMsg) {
            const mensaje = isToday ? 
                `✅ ${horariosDisponibles.length} horarios disponibles para hoy` :
                `✅ ${horariosDisponibles.length} horarios disponibles`;
            availabilityMsg.innerHTML = `
                <span class="text-success">
                    <i class="bi bi-check-circle"></i> 
                    ${mensaje}
                </span>
            `;
        }

    } catch (error) {
        console.error('Error al verificar disponibilidad:', error);
        if (availabilityMsg) {
            availabilityMsg.innerHTML = `
                <span class="text-danger">
                    <i class="bi bi-exclamation-triangle"></i> 
                    Error al verificar disponibilidad. Intenta de nuevo.
                </span>
            `;
        }
    }
}

async function handleAppointmentSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const submitSpinner = document.getElementById('submitSpinner');
    const submitText = document.getElementById('submitText');

    const name = document.getElementById('formName').value.trim();
    const phone = document.getElementById('formPhone').value.trim();
    const location = document.getElementById('formLocation').value;
    const service = document.getElementById('formService').value;
    const date = document.getElementById('formDate').value;
    const time = document.getElementById('formTime').value;
    const message = document.getElementById('formMessage').value.trim();

    // 1. Validaciones locales previas al envío
    const errors = [];
    if (!name) errors.push('Nombre completo');
    if (!phone) errors.push('Teléfono');
    if (!location) errors.push('Sucursal');
    if (!service) errors.push('Servicio');
    if (!date) errors.push('Fecha');
    if (!time) errors.push('Hora');

    if (errors.length > 0) {
        showNotification(`Por favor completa: ${errors.join(', ')}`, 'warning');
        return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const selectedDate = new Date(date + 'T00:00:00');

    if (selectedDate < new Date(todayStr + 'T00:00:00')) {
        showNotification('No se pueden agendar citas en fechas pasadas', 'error');
        return;
    }

    if (date === todayStr) {
        const now = new Date();
        const [h, m] = time.split(':').map(Number);
        const horaDate = new Date();
        horaDate.setHours(h, m, 0, 0);
        
        if (horaDate <= now) {
            showNotification('No se pueden agendar citas en horarios pasados', 'error');
            validateAndCheckAvailability();
            return;
        }
    }

    // 2. Activar Estado de Carga (Loading State)
    if (submitBtn) submitBtn.disabled = true;
    if (submitSpinner) submitSpinner.classList.remove('d-none');
    if (submitText) submitText.innerText = 'Agendando cita...';

    try {
        // Verificar disponibilidad
        const ocupados = await API.getCitas(date, location);
        if (ocupados.some(c => c.hora === time)) {
            showNotification('Este horario ya no está disponible. Por favor selecciona otro.', 'error');
            validateAndCheckAvailability();
            return;
        }

        // Crear cita
        const citaData = {
            paciente: name,
            telefono: phone,
            sucursal: location,
            servicio: service,
            fecha: date,
            hora: time,
            notas: message,
            estado: 'Pendiente'
        };

        await API.crearCita(citaData);

        // Notificación y reseteo
        showNotification('¡Cita agendada exitosamente! Te esperamos.', 'success');
        document.getElementById('appointmentForm').reset();
        
        const todayStr2 = new Date().toISOString().split('T')[0];
        document.getElementById('formDate').value = todayStr2;

        validateAndCheckAvailability();
        sendWhatsAppConfirmation(name, phone, location, service, date, time);

    } catch (error) {
        console.error('Error al agendar cita:', error);
        showNotification('Error al agendar la cita: ' + error.message, 'error');
    } finally {
        // 3. Restaurar el Botón (Se ejecuta siempre, haya éxito o error)
        if (submitBtn) submitBtn.disabled = false;
        if (submitSpinner) submitSpinner.classList.add('d-none');
        if (submitText) submitText.innerText = 'Enviar Mensaje por WhatsApp';
    }
}

function sendWhatsAppConfirmation(name, phone, location, service, date, time) {
    const message = `Hola, soy ${name}. Mi número es ${phone}. 
He agendado una cita para el día ${date} a las ${time} en ${location} 
para el servicio de ${service}. Confirmación desde la web.`;

    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${CLINIC_CONFIG.whatsappNumber}?text=${encodedMessage}`;
    
    // Abrir WhatsApp en nueva pestaña
    window.open(waUrl, '_blank');
}

/* --- SISTEMA DE NOTIFICACIONES --- */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer') || createNotificationContainer();
    
    const colors = {
        success: 'bg-success text-white',
        error: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        info: 'bg-info text-white'
    };

    const notification = document.createElement('div');
    notification.className = `alert ${colors[type] || colors.info} alert-dismissible fade show`;
    notification.role = 'alert';
    notification.style.cssText = `
        animation: slideInRight 0.3s ease;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    container.appendChild(notification);

    // Auto cerrar después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    document.body.appendChild(container);

    // Agregar estilos de animación
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
    `;
    document.head.appendChild(style);

    return container;
}

/* --- RENDERIZADO Y MANEJO DE SUCURSALES Y MAPA --- */
function renderLocations() {
    const locationsContainer = document.getElementById("locations-list-container");
    const formLocationSelect = document.getElementById("formLocation");
    const mapTabsContainer = document.getElementById("map-tabs-container");
    const mapIframe = document.getElementById("interactiveMap");

    if (!CLINIC_CONFIG.locations || CLINIC_CONFIG.locations.length === 0) return;

    // 1. Lista de ubicaciones en la sección de contacto
    locationsContainer.innerHTML = CLINIC_CONFIG.locations
        .map(
            (loc) => `
                <div class="mb-2">
                    <strong>${loc.name}:</strong>
                    <p class="text-muted small mb-0">${loc.address}</p>
                </div>
            `
        )
        .join("");

    // 2. Opciones del Formulario
    formLocationSelect.innerHTML = `
        <option value="">-- Seleccionar Sucursal --</option>
        ${CLINIC_CONFIG.locations
            .map(
                (loc) => `
                    <option value="${loc.name}">${loc.name}</option>
                `
            )
            .join("")}
    `;

    // 3. Botones para cambiar de mapa dinámicamente
    mapTabsContainer.innerHTML = CLINIC_CONFIG.locations
        .map(
            (loc, index) => `
                <button type="button" class="btn btn-outline-secondary btn-sm map-tab-btn ${index === 0 ? "active" : ""}" data-map-url="${loc.mapEmbed}">
                    ${loc.name}
                </button>
            `
        )
        .join("");

    // Inicializar iframe con el primer mapa
    if (CLINIC_CONFIG.locations.length > 0) {
        mapIframe.src = CLINIC_CONFIG.locations[0].mapEmbed;
    }

    // Listener para cambiar el mapa al hacer clic en los botones
    const tabs = mapTabsContainer.querySelectorAll(".map-tab-btn");
    tabs.forEach((tab) => {
        tab.addEventListener("click", function () {
            tabs.forEach((t) => t.classList.remove("active"));
            this.classList.add("active");
            mapIframe.src = this.getAttribute("data-map-url");
        });
    });
}

/* --- POBLADO DE INFORMACIÓN GENERAL Y SEO --- */
function populateGeneralInfo() {
    // SEO
    document.title = `${CLINIC_CONFIG.brandName} | Consultorio Dental y Odontología Especializada`;
    document.getElementById("seo-title").innerText =
        `${CLINIC_CONFIG.brandName} | Consultorio Dental`;
    document
        .getElementById("seo-desc")
        .setAttribute("content", CLINIC_CONFIG.seoDescription);
    document
        .getElementById("seo-author")
        .setAttribute("content", CLINIC_CONFIG.brandName);

    document
        .getElementById("og-title")
        .setAttribute(
            "content",
            `${CLINIC_CONFIG.brandName} | Cuidado Dental Especializado`
        );
    document
        .getElementById("og-desc")
        .setAttribute("content", CLINIC_CONFIG.seoDescription);
    document
        .getElementById("og-url")
        .setAttribute("content", CLINIC_CONFIG.websiteUrl);

    // Schema JSON-LD
    const schemaObj = {
        "@context": "https://schema.org",
        "@type": "Dentist",
        name: CLINIC_CONFIG.brandName,
        telephone: CLINIC_CONFIG.phoneDisplay,
        email: CLINIC_CONFIG.email,
        address: CLINIC_CONFIG.address,
        openingHours: CLINIC_CONFIG.openingHours,
    };
    document.getElementById("schema-json").textContent =
        JSON.stringify(schemaObj);

    // Marca y textos repetidos
    document
        .querySelectorAll(".data-brand-name")
        .forEach((el) => (el.innerText = CLINIC_CONFIG.brandName));
    document
        .querySelectorAll(".data-promo")
        .forEach((el) => (el.innerText = CLINIC_CONFIG.topPromoText));
    document
        .querySelectorAll(".data-phone")
        .forEach((el) => (el.innerText = CLINIC_CONFIG.phoneDisplay));
    document
        .querySelectorAll(".data-address")
        .forEach((el) => (el.innerText = CLINIC_CONFIG.address));
    document
        .querySelectorAll(".data-hours")
        .forEach((el) => (el.innerText = CLINIC_CONFIG.openingHours));

    // Hero section
    document.querySelector(".data-hero-subtitle").innerText =
        CLINIC_CONFIG.hero.subtitle;
    document.querySelector(".data-hero-title").innerHTML =
        CLINIC_CONFIG.hero.title;
    document.querySelector(".data-hero-desc").innerText =
        CLINIC_CONFIG.hero.description;
    document.querySelector(".data-stat-satisfaction").innerText =
        CLINIC_CONFIG.hero.satisfactionRate;

    // Testimonio
    document.querySelector(".data-testimonial-quote").innerText =
        `"${CLINIC_CONFIG.testimonial.quote}"`;
    document.querySelector(".data-testimonial-author").innerText =
        CLINIC_CONFIG.testimonial.author;
    document.querySelector(".data-testimonial-role").innerText =
        CLINIC_CONFIG.testimonial.role;

    // Enlaces a WhatsApp generados
    const waUrl = `https://wa.me/${CLINIC_CONFIG.whatsappNumber}?text=${encodeURIComponent("Hola, me gustaría agendar una consulta")}`;
    document
        .querySelectorAll(".wa-link-btn")
        .forEach((btn) => btn.setAttribute("href", waUrl));

    // Año Footer
    document.getElementById("current-year").innerText = new Date().getFullYear();
}

/* --- RENDERIZAR ESTADÍSTICAS --- */
function renderStats() {
    const container = document.getElementById("stats-container");
    container.innerHTML = CLINIC_CONFIG.stats
        .map(
            (stat) => `
                <div class="col-6 col-md-3">
                    <div class="stat-number">${stat.number}</div>
                    <p class="stat-label">${stat.label}</p>
                </div>
            `
        )
        .join("");
}

/* --- RENDERIZAR SERVICIOS --- */
function renderServices() {
    const container = document.getElementById("services-container");
    const footerList = document.getElementById("footer-services-list");
    const formSelect = document.getElementById("formService");

    container.innerHTML = CLINIC_CONFIG.services
        .map((service) => {
            const waMsg = encodeURIComponent(
                `Hola, deseo información sobre ${service.title}`
            );
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
        })
        .join("");

    // Footer Lista
    footerList.innerHTML = CLINIC_CONFIG.services
        .map(
            (s) => `
                <li class="mb-2"><a href="#servicios">${s.title}</a></li>
            `
        )
        .join("");

    // Form Select
    formSelect.innerHTML = `
        <option value="">-- Seleccionar Servicio --</option>
        ${CLINIC_CONFIG.services
            .map(
                (s) => `
                    <option value="${s.title}">${s.title}</option>
                `
            )
            .join("")}
    `;
}

/* --- RENDERIZAR CARACTERÍSTICAS --- */
function renderFeatures() {
    const container = document.getElementById("features-container");
    container.innerHTML = CLINIC_CONFIG.features
        .map(
            (f) => `
                <div class="col-md-6 col-lg-3">
                    <div class="feature-card-white">
                        <div class="feature-icon-box"><i class="bi ${f.icon}"></i></div>
                        <h4 class="h6 fw-bold">${f.title}</h4>
                        <p class="text-muted extra-small mb-0">${f.desc}</p>
                    </div>
                </div>
            `
        )
        .join("");
}

/* --- RENDERIZAR DOCTORES --- */
function renderDoctors() {
    const container = document.getElementById("doctors-container");

    // Si solo hay un especialista, centramos el contenedor
    const justifyClass =
        CLINIC_CONFIG.doctors.length === 1 ? "justify-content-center" : "";
    container.className = `row g-4 ${justifyClass}`;

    container.innerHTML = CLINIC_CONFIG.doctors
        .map(
            (d) => `
                <div class="col-sm-8 col-md-6 col-lg-4">
                    <div class="doctor-card text-center p-3 shadow-sm">
                        <img src="${d.image}" alt="${d.name}" class="doctor-img rounded-3">
                        <div class="pt-3">
                            <h3 class="h5 fw-bold mb-1">${d.name}</h3>
                            <p class="text-muted small mb-0">${d.role}</p>
                        </div>
                    </div>
                </div>
            `
        )
        .join("");
}

/* --- RENDERIZAR REDES SOCIALES --- */
function renderSocialLinks() {
    const container = document.getElementById("social-links-container");
    const links = CLINIC_CONFIG.socialLinks;
    container.innerHTML = `
        ${links.facebook ? `<a href="${links.facebook}" target="_blank" aria-label="Facebook"><i class="bi bi-facebook"></i></a>` : ""}
        ${links.instagram ? `<a href="${links.instagram}" target="_blank" aria-label="Instagram"><i class="bi bi-instagram"></i></a>` : ""}
        ${links.twitter ? `<a href="${links.twitter}" target="_blank" aria-label="Twitter"><i class="bi bi-twitter-x"></i></a>` : ""}
    `;
}

/* --- TOGGLE WHATSAPP POPUP WIDGET --- */
function toggleWhatsApp() {
    const popup = document.getElementById("waPopup");
    popup.style.display = popup.style.display === "flex" ? "none" : "flex";
}

/* --- SCROLL REVEAL ANIMATIONS --- */
function initScrollReveal() {
    if (typeof ScrollReveal !== "undefined") {
        ScrollReveal().reveal(".hero-title, .subtitle-script", {
            delay: 200,
            origin: "top",
            distance: "30px",
            duration: 800,
        });
        ScrollReveal().reveal(".service-card", {
            delay: 200,
            interval: 100,
            origin: "bottom",
            distance: "30px",
            duration: 800,
        });
        ScrollReveal().reveal(".doctor-card", {
            delay: 200,
            interval: 100,
            origin: "bottom",
            distance: "30px",
            duration: 800,
        });
        ScrollReveal().reveal(".feature-teal-bg", {
            delay: 200,
            origin: "bottom",
            distance: "30px",
            duration: 800,
        });
        ScrollReveal().reveal(".cta-box", {
            delay: 200,
            origin: "bottom",
            distance: "30px",
            duration: 800,
        });
    }
}