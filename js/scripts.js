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
    renderTestimonials();
    renderFAQ();

    // 3. Inicializar Sistema de Agenda
    initAppointmentSystem();

    // 4. Inicializar ScrollReveal
    initScrollReveal();
});

/* --- SISTEMA DE AGENDA DE CITAS (WIZARD DE 3 PASOS) --- */
let currentBookingStep = 1;

function initAppointmentSystem() {
    const form = document.getElementById('appointmentForm');
    const dateInput = document.getElementById('formDate');
    const locationSelect = document.getElementById('formLocation');
    const phoneInput = document.getElementById('formPhone');

    if (!form || !dateInput) {
        console.error('No se encontró el formulario de citas');
        return;
    }

    // Configurar fecha mínima = hoy
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateInput.setAttribute('min', todayStr);
    dateInput.value = todayStr;

    // Navegación del wizard
    form.querySelectorAll('[data-next]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = parseInt(btn.getAttribute('data-next'), 10);
            if (validateBookingStep(currentBookingStep)) {
                goToBookingStep(next);
            }
        });
    });

    form.querySelectorAll('[data-prev]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const prev = parseInt(btn.getAttribute('data-prev'), 10);
            goToBookingStep(prev);
        });
    });

    // Verificar disponibilidad al cambiar fecha
    dateInput.addEventListener('change', validateAndCheckAvailability);

    // Si cambia la sucursal, refrescamos disponibilidad (por si el usuario regresó al paso 1)
    if (locationSelect) {
        locationSelect.addEventListener('change', () => {
            if (currentBookingStep === 2) validateAndCheckAvailability();
        });
    }

    // Validación de teléfono en tiempo real
    if (phoneInput) {
        phoneInput.addEventListener('input', validatePhoneField);
    }

    // Submit del formulario (paso 3)
    form.addEventListener('submit', handleAppointmentSubmit);
}

function goToBookingStep(step) {
    const form = document.getElementById('appointmentForm');
    currentBookingStep = step;

    // Mostrar/ocultar paneles
    form.querySelectorAll('.booking-panel').forEach((panel) => {
        panel.classList.toggle('d-none', parseInt(panel.getAttribute('data-panel'), 10) !== step);
    });

    // Actualizar indicador de pasos
    document.querySelectorAll('#bookingSteps .booking-step').forEach((el) => {
        const indicatorStep = parseInt(el.getAttribute('data-step-indicator'), 10);
        el.classList.toggle('active', indicatorStep === step);
        el.classList.toggle('completed', indicatorStep < step);
    });

    if (step === 2) {
        validateAndCheckAvailability();
    }

    if (step === 3) {
        renderBookingSummary();
    }

    // Llevar el foco al inicio del formulario para accesibilidad
    const cardTop = document.getElementById('bookingSteps');
    if (cardTop) cardTop.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function validateBookingStep(step) {
    if (step === 1) {
        const location = document.getElementById('formLocation').value;
        const service = document.getElementById('formService').value;
        if (!location || !service) {
            showNotification('Selecciona sucursal y servicio para continuar', 'warning');
            return false;
        }
        return true;
    }

    if (step === 2) {
        const date = document.getElementById('formDate').value;
        const time = document.getElementById('formTime').value;
        if (!date) {
            showNotification('Selecciona una fecha', 'warning');
            return false;
        }
        if (!time) {
            showNotification('Selecciona un horario disponible', 'warning');
            return false;
        }
        return true;
    }

    return true;
}

function validatePhoneField() {
    const phoneInput = document.getElementById('formPhone');
    const msg = document.getElementById('phoneValidationMsg');
    const digits = phoneInput.value.replace(/\D/g, '');

    if (!digits) {
        if (msg) msg.innerHTML = '';
        return false;
    }

    if (digits.length !== 10) {
        if (msg) msg.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-circle"></i> Ingresa un número a 10 dígitos</span>';
        return false;
    }

    if (msg) msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Número válido</span>';
    return true;
}

function validateAndCheckAvailability() {
    const dateInput = document.getElementById('formDate');
    const locationSelect = document.getElementById('formLocation');
    const dateValidationMsg = document.getElementById('dateValidationMsg');
    const availabilityMsg = document.getElementById('availabilityMessage');
    const slotGrid = document.getElementById('timeSlotGrid');
    const timeField = document.getElementById('formTime');

    if (!dateInput || !locationSelect) return;

    const fecha = dateInput.value;
    const sucursal = locationSelect.value;

    // Validar fecha
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const selectedDate = new Date(fecha + 'T00:00:00');

    if (!fecha) {
        if (dateValidationMsg) dateValidationMsg.innerHTML = '<span class="text-warning">⚠️ Selecciona una fecha</span>';
        if (slotGrid) slotGrid.innerHTML = '';
        if (timeField) timeField.value = '';
        if (availabilityMsg) availabilityMsg.innerHTML = '';
        return;
    }

    // Validar que la fecha no sea anterior a hoy
    if (selectedDate < new Date(todayStr + 'T00:00:00')) {
        if (dateValidationMsg) dateValidationMsg.innerHTML = '<span class="text-danger">❌ No se pueden agendar citas en fechas pasadas</span>';
        if (slotGrid) slotGrid.innerHTML = '';
        if (timeField) timeField.value = '';
        if (availabilityMsg) availabilityMsg.innerHTML = '';
        return;
    }

    if (dateValidationMsg) dateValidationMsg.innerHTML = '<span class="text-success">✅ Fecha válida</span>';

    if (!sucursal) {
        if (availabilityMsg) availabilityMsg.innerHTML = '<span class="text-warning">⚠️ Selecciona una sucursal en el paso 1</span>';
        if (slotGrid) slotGrid.innerHTML = '';
        if (timeField) timeField.value = '';
        return;
    }

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
    const slotGrid = document.getElementById('timeSlotGrid');
    const timeField = document.getElementById('formTime');
    const availabilityMsg = document.getElementById('availabilityMessage');

    if (!dateInput || !locationSelect || !slotGrid || !timeField) return;

    const fecha = dateInput.value;
    const sucursal = locationSelect.value;

    if (!fecha || !sucursal) {
        slotGrid.innerHTML = '';
        timeField.value = '';
        if (availabilityMsg) {
            availabilityMsg.innerHTML = '<span class="text-muted">Selecciona fecha y sucursal</span>';
        }
        return;
    }

    // Estado de carga mientras se consulta el Sheet
    slotGrid.innerHTML = '<span class="text-muted small"><i class="bi bi-arrow-repeat"></i> Cargando horarios...</span>';
    timeField.value = '';

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

        slotGrid.innerHTML = '';

        if (horariosDisponibles.length === 0) {
            let mensaje = 'No hay horarios disponibles para esta fecha y sucursal.';
            if (isToday) {
                mensaje = 'No hay horarios disponibles para el resto del día de hoy.';
            }
            slotGrid.innerHTML = `<span class="text-muted small">${mensaje}</span>`;
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

        // Agrupar horarios en Mañana / Tarde para facilitar la lectura visual
        const manana = horariosDisponibles.filter(h => parseInt(h.split(':')[0], 10) < 13);
        const tarde = horariosDisponibles.filter(h => parseInt(h.split(':')[0], 10) >= 13);

        const buildGroup = (label, horas) => {
            if (horas.length === 0) return '';
            return `
                <div class="time-slot-group">
                    <span class="time-slot-group-label">${label}</span>
                    <div class="time-slot-buttons">
                        ${horas.map(h => `<button type="button" class="time-slot-btn" data-time="${h}">${h}</button>`).join('')}
                    </div>
                </div>
            `;
        };

        slotGrid.innerHTML = buildGroup('Mañana', manana) + buildGroup('Tarde', tarde);

        slotGrid.querySelectorAll('.time-slot-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                slotGrid.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                timeField.value = btn.getAttribute('data-time');
            });
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

    // Honeypot anti-spam: si un bot llenó este campo invisible, abortamos en silencio
    const honeypot = document.getElementById('formWebsite');
    if (honeypot && honeypot.value.trim() !== '') {
        return;
    }

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
    if (!name || name.length < 3) errors.push('Nombre completo');
    if (!validatePhoneField()) errors.push('Teléfono (10 dígitos)');
    if (!location) errors.push('Sucursal');
    if (!service) errors.push('Servicio');
    if (!date) errors.push('Fecha');
    if (!time) errors.push('Hora');

    if (errors.length > 0) {
        showNotification(`Por favor revisa: ${errors.join(', ')}`, 'warning');
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
        sendWhatsAppConfirmation(name, phone, location, service, date, time);

        document.getElementById('appointmentForm').reset();
        const todayStr2 = new Date().toISOString().split('T')[0];
        document.getElementById('formDate').value = todayStr2;
        document.getElementById('timeSlotGrid').innerHTML = '';

        goToBookingStep(1);

    } catch (error) {
        console.error('Error al agendar cita:', error);
        showNotification('Error al agendar la cita: ' + error.message, 'error');
    } finally {
        // 3. Restaurar el Botón (Se ejecuta siempre, haya éxito o error)
        if (submitBtn) submitBtn.disabled = false;
        if (submitSpinner) submitSpinner.classList.add('d-none');
        if (submitText) submitText.innerText = 'Confirmar Cita';
    }
}

/* --- RESUMEN DE LA CITA (PASO 3 DEL WIZARD) --- */
function renderBookingSummary() {
    const summaryEl = document.getElementById('bookingSummary');
    if (!summaryEl) return;

    const location = document.getElementById('formLocation').value;
    const service = document.getElementById('formService').value;
    const date = document.getElementById('formDate').value;
    const time = document.getElementById('formTime').value;

    const dateFormatted = date
        ? new Date(date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        : '';

    summaryEl.innerHTML = `
        <div class="booking-summary-title"><i class="bi bi-clipboard-check"></i> Resumen de tu cita</div>
        <ul class="booking-summary-list">
            <li><i class="bi bi-geo-alt"></i> ${location || '—'}</li>
            <li><i class="bi bi-stars"></i> ${service || '—'}</li>
            <li><i class="bi bi-calendar-event"></i> ${dateFormatted || '—'}</li>
            <li><i class="bi bi-clock"></i> ${time || '—'}</li>
        </ul>
    `;
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

/* --- RENDERIZAR TESTIMONIOS (CARRUSEL AUTOMÁTICO) --- */
let testimonialIndex = 0;
let testimonialInterval = null;

function renderTestimonials() {
    const container = document.getElementById('testimonials-container');
    const dotsContainer = document.getElementById('testimonials-dots');
    const items = CLINIC_CONFIG.testimonials;

    if (!container || !items || items.length === 0) return;

    function paintTestimonial() {
        const t = items[testimonialIndex];
        container.innerHTML = `
            <div class="text-warning mb-3">
                ${'<i class="bi bi-star-fill"></i>'.repeat(5)}
            </div>
            <p class="fs-5 fst-italic mb-4">"${t.quote}"</p>
            <h4 class="h6 fw-bold mb-0">${t.author}</h4>
            <small class="text-muted">${t.role}</small>
        `;

        if (dotsContainer) {
            dotsContainer.innerHTML = items
                .map((_, i) => `<button type="button" class="testimonial-dot ${i === testimonialIndex ? 'active' : ''}" data-index="${i}" aria-label="Ver testimonio ${i + 1}"></button>`)
                .join('');

            dotsContainer.querySelectorAll('.testimonial-dot').forEach((dot) => {
                dot.addEventListener('click', () => {
                    testimonialIndex = parseInt(dot.getAttribute('data-index'), 10);
                    paintTestimonial();
                    restartTestimonialInterval();
                });
            });
        }
    }

    function restartTestimonialInterval() {
        if (testimonialInterval) clearInterval(testimonialInterval);
        if (items.length > 1) {
            testimonialInterval = setInterval(() => {
                testimonialIndex = (testimonialIndex + 1) % items.length;
                paintTestimonial();
            }, 6000);
        }
    }

    paintTestimonial();
    restartTestimonialInterval();
}

/* --- RENDERIZAR PREGUNTAS FRECUENTES (ACORDEÓN) --- */
function renderFAQ() {
    const container = document.getElementById('faqAccordion');
    if (!container || !CLINIC_CONFIG.faqs) return;

    container.innerHTML = CLINIC_CONFIG.faqs
        .map(
            (faq, i) => `
                <div class="accordion-item faq-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${i === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse${i}">
                            ${faq.q}
                        </button>
                    </h2>
                    <div id="faqCollapse${i}" class="accordion-collapse collapse ${i === 0 ? 'show' : ''}" data-bs-parent="#faqAccordion">
                        <div class="accordion-body text-muted">${faq.a}</div>
                    </div>
                </div>
            `
        )
        .join('');
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