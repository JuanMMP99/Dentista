/**
 * ARCHIVO DE CONFIGURACIÓN CENTRALIZADO (CONFIG.JS)
 */
const CLINIC_CONFIG = {
    // Info General
    brandName: "C&H Consultorio Dental",
    whatsappNumber: "529513298029", // Formato internacional limpio para APIs
    phoneDisplay: "+52 951 329 8029",
    email: "contacto@chconsultoriodental.com",
    address: "Magdalena Ocotlán, 71529 Magdalena Ocotlán, Oax.",
    openingHours: "Lun - Vie: 9:00 AM - 7:00 PM | Sáb: 9:00 AM - 2:00 PM",
    topPromoText: "Atención dental personalizada y profesional - ¡Agenda tu cita!",
    
    // Sucursales / Ubicaciones
    locations: [
        {
            id: "sucursal-1",
            name: "Sucursal Principal (Magdalena Ocotlán)",
            address: "Magdalena Ocotlán, 71529 Magdalena Ocotlán, Oax.",
            mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3821.4022882815266!2d-96.70966062508141!3d16.706767584068917!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85c743468b75df0f%3A0xcf3cd33842a30382!2sC%26H%20Dental!5e0!3m2!1ses!2smx!4v1785783472413!5m2!1ses!2smx"
        },
        {
            id: "sucursal-2",
            name: "Sucursal San Antonino Castillo Velasco",
            address: "Hidalgo 23, 2da Secc, 71520 San Antonino Castillo Velasco, Oax.",
            mapEmbed: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3819.491026514602!2d-96.68339230120182!3d16.801979487771188!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85c740a04432c7b1%3A0x98457af1f3b4f699!2sHidalgo%2023%2C%202da%20Secc%2C%2071520%20San%20Antonino%20Castillo%20Velasco%2C%20Oax.!5e0!3m2!1ses!2smx!4v1785783061990!5m2!1ses!2smx"
        },
        {
            id: "sucursal-3",
            name: "Sucursal San Jerónimo Taviche (Dentifarmacia)",
            address: "Supermanzana Ocotlan, 71545 San Jerónimo Taviche, Oax.",
            mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3821.26206113676!2d-96.5957799250812!3d16.71377108406313!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85c747c4038e7b65%3A0xe1740fa50a0d61e!2sDENTIFARMACIA!5e0!3m2!1ses!2smx!4v1785783110041!5m2!1ses!2smx"
        }
    ],

    // SEO & Redes
    websiteUrl: "https://midominio.com",
    seoDescription: "Atención odontológica integral, estética dental y cuidado profesional en C&H Consultorio Dental.",
    socialLinks: {
        facebook: "https://www.facebook.com/share/15U7MNqDGC/",
        instagram: "",
        twitter: ""
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
        { number: "10+", label: "Años de Experiencia" },
        { number: "3", label: "Sucursales a tu Servicio" },
        { number: "+1K", label: "Pacientes Satisfechos" },
        { number: "100%", label: "Higiene & Seguridad" }
    ],

    // Servicios Dentales
    services: [
        {
            title: "Odontología Estética",
            description: "Transforma tu sonrisa con nuestros tratamientos cosméticos avanzados.",
            image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=500&q=80"
        },
        {
            title: "Limpieza y Prevención",
            description: "Tratamientos profilácticos para mantener la salud de tus encías y dientes.",
            image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=500&q=80"
        },
        {
            title: "Ortodoncia",
            description: "Alineación dental con técnicas modernas adaptadas a cada paciente.",
            image: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=500&q=80"
        },
        {
            title: "Blanqueamiento",
            description: "Aclara el tono de tus dientes de forma segura, rápida y efectiva.",
            image: "https://images.unsplash.com/photo-1571772996211-2f02c9727629?auto=format&fit=crop&w=500&q=80"
        }
    ],

    // Características
    features: [
        { icon: "bi-person-check", title: "Atención Individualizada", desc: "Un especialista dedicado a tu tratamiento de principio a fin." },
        { icon: "bi-cpu", title: "Tecnología Avanzada", desc: "Equipamiento de última generación para diagnósticos precisos." },
        { icon: "bi-heart", title: "Trato Cálido y Humano", desc: "Tratamientos diseñados para minimizar molestias e incomodidad." },
        { icon: "bi-shield-check", title: "Máxima Higiene", desc: "Protocolos rigurosos de esterilización en cada consulta." }
    ],

    // Atención Unipersonal (Un solo especialista)
    doctors: [
        { 
            name: "Especialista C&H Dental", 
            role: "Cirujano Dentista / Especialista Bucal", 
            image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=500&q=80" 
        }
    ],

    // Testimonio Destacado
    testimonial: {
        quote: "C&H Consultorio Dental transformó por completo mi sonrisa. La atención es muy atenta y los resultados superaron mis expectativas.",
        author: "Paciente Satisfecho",
        role: "Atención Dental Integral"
    }
};