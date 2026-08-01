/**
 * ==========================================================================
 * ARCHIVO DE CONFIGURACIÓN CENTRALIZADO (CONFIG.JS)
 * ==========================================================================
 * Edita los valores de este archivo para cambiar la información del sitio
 * sin necesidad de tocar la estructura HTML o los estilos CSS.
 */

const CLINIC_CONFIG = {
    // Info General
    brandName: "MiCare+",
    whatsappNumber: "529511234567", // Número sin espacios ni código '+' (Ej: 529511234567)
    phoneDisplay: "+52 951 123 4567",
    email: "contacto@micare.com",
    address: "Av. Principal #123, Col. Centro, Oaxaca, México",
    openingHours: "Lun - Vie: 9:00 AM - 7:00 PM | Sáb: 9:00 AM - 2:00 PM",
    topPromoText: "Especial Nuevo Paciente: 20% de descuento en tu primera consulta - ¡Agenda Hoy!",
    
    // SEO & Redes
    websiteUrl: "https://midominio.com",
    seoDescription: "Atención odontológica integral, estética dental, implantes y ortodoncia con tecnología avanzada en Oaxaca. Agenda tu cita.",
    socialLinks: {
        facebook: "https://facebook.com",
        instagram: "https://instagram.com",
        twitter: "https://x.com"
    },

    // Textos Principales
    hero: {
        subtitle: "Sonrisa Saludable",
        title: "Confianza en ti,<br>Atención Experta para cada Sonrisa",
        description: "Combinamos tecnología avanzada con un trato humano y delicado para brindarte una experiencia dental cómoda y de alta calidad.",
        satisfactionRate: "98%"
    },

    // Estadísticas del contador
    stats: [
        { number: "15+", label: "Años de Experiencia" },
        { number: "100+", label: "Dentistas Especialistas" },
        { number: "20K+", label: "Pacientes Felices" },
        { number: "24/7", label: "Atención de Urgencias" }
    ],

    // Lista de Servicios Dentales
    services: [
        {
            title: "Odontología Estética",
            description: "Transforma tu sonrisa con nuestros tratamientos cosméticos avanzados.",
            image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=500&q=80"
        },
        {
            title: "Implantes Dentales",
            description: "Soluciones permanentes y duraderas para dientes perdidos con aspecto natural.",
            image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=500&q=80"
        },
        {
            title: "Ortodoncia",
            description: "Alinea tus dientes con soluciones modernas e invisibles para todas las edades.",
            image: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=500&q=80"
        },
        {
            title: "Blanqueamiento",
            description: "Aclara el tono de tus dientes de forma segura, rápida y efectiva.",
            image: "https://images.unsplash.com/photo-1571772996211-2f02c9727629?auto=format&fit=crop&w=500&q=80"
        }
    ],

    // Características "¿Por qué elegirnos?"
    features: [
        { icon: "bi-cpu", title: "Tecnología Avanzada", desc: "Equipamiento de última generación para diagnósticos precisos." },
        { icon: "bi-person-badge", title: "Equipo Experto", desc: "Profesionales altamente capacitados y certificados." },
        { icon: "bi-heart", title: "Máximo Confort", desc: "Tratamientos diseñados para minimizar molestias e incomodidad." },
        { icon: "bi-shield-check", title: "Atención Accesible", desc: "Planes de pago flexibles y facilidades de financiamiento." }
    ],

    // Equipo Médico (Doctores)
    doctors: [
        { name: "Dra. Sarah Johnson", role: "Directora Dental", image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=500&q=80" },
        { name: "Dr. Michael Chen", role: "Ortodoncista", image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=500&q=80" },
        { name: "Dra. Emily Rodríguez", role: "Dentista Cosmética", image: "https://images.unsplash.com/photo-1594824813572-980757d5440d?auto=format&fit=crop&w=500&q=80" },
        { name: "Dr. James Wilson", role: "Cirujano Oral", image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=500&q=80" }
    ],

    // Testimonio Destacado
    testimonial: {
        quote: "MiCare+ transformó por completo mi sonrisa y mi confianza. El equipo médico es increíblemente atento y los resultados superaron mis expectativas.",
        author: "Jessica Miller",
        role: "Paciente satisfecha"
    }
};
