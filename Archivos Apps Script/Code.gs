/**
 * CRM de Citas - Google Apps Script
 * Sistema de gestión de citas con Google Sheets
 */

const SHEET_NAME = 'Citas';

// Configuración de horarios
const TIME_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30'
];

// Límites de longitud para evitar abuso desde el formulario público
const FIELD_LIMITS = {
    paciente: 100,
    telefono: 20,
    sucursal: 150,
    servicio: 150,
    notas: 500
};

// Ventana de tiempo (minutos) para bloquear solicitudes duplicadas del mismo teléfono
const RATE_LIMIT_MINUTES = 5;

/* ==========================================================================
   MÓDULO DE ADMINISTRACIÓN (PANEL PRIVADO)
   ========================================================================== */
const USERS_SHEET_NAME = 'Usuarios';
const SESSION_DURATION_SECONDS = 21600; // 6 horas (máximo permitido por CacheService)
const ESTADOS_VALIDOS = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada', 'No asistió'];

// Espejo de las sucursales y servicios definidos en js/config.js del sitio público.
// Si agregas/quitas una sucursal o servicio allá, actualiza también esta lista.
const SUCURSALES = [
    'Sucursal Principal (Magdalena Ocotlán)',
    'Sucursal San Antonino Castillo Velasco',
    'Sucursal San Jerónimo Taviche (Dentifarmacia)'
];

const SERVICIOS = [
    'Odontología Estética',
    'Limpieza y Prevención',
    'Ortodoncia',
    'Blanqueamiento'
];

// Datos de marca para el comprobante en PDF (espejo de brandName/phoneDisplay en config.js)
const BRAND_NAME = 'C&H Consultorio Dental';
const BRAND_PHONE = '+52 951 329 8029';

// Respaldo semanal de la hoja de Citas
const BACKUP_FOLDER_NAME = 'Respaldos CRM - Citas Dental';
const MAX_BACKUPS_TO_KEEP = 12; // ~3 meses de respaldos semanales

/**
 * Sanea un valor antes de escribirlo en la hoja:
 * - Convierte a texto y recorta espacios
 * - Antepone un apóstrofe si el valor empieza con =, +, -, @ para evitar
 *   inyección de fórmulas (CSV/formula injection) al abrir la hoja en Excel/Sheets
 * - Trunca a una longitud máxima
 */
function sanitizeForSheet(value, maxLength) {
    if (value === null || value === undefined) return '';
    let str = String(value).trim();
    if (/^[=+\-@]/.test(str)) {
        str = "'" + str;
    }
    if (maxLength && str.length > maxLength) {
        str = str.substring(0, maxLength);
    }
    return str;
}

/**
 * Valida que un teléfono tenga entre 10 y 15 dígitos (solo números)
 */
function isValidPhone(telefono) {
    const digits = String(telefono || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

/**
 * Revisa si ya existe una solicitud reciente del mismo teléfono
 * (protección básica anti-spam / doble envío accidental)
 */
function hasRecentDuplicateRequest(telefono) {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const digits = String(telefono || '').replace(/\D/g, '');
    const cutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000);

    for (let i = values.length - 1; i >= 1; i--) {
        const rowPhoneDigits = String(values[i][1] || '').replace(/\D/g, '');
        const rowTimestamp = values[i][8];
        if (rowPhoneDigits && rowPhoneDigits === digits && rowTimestamp) {
            const ts = new Date(rowTimestamp);
            if (!isNaN(ts.getTime()) && ts > cutoff) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Normaliza cualquier valor de fecha al formato YYYY-MM-DD
 */
function normalizeDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    const str = String(val).trim();
    if (str.includes('T')) {
        return str.split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    return str;
}

/**
 * Normaliza cualquier valor de hora al formato HH:mm (ej: "9:00" -> "09:00")
 */
function normalizeTime(val) {
    if (!val) return '';
    if (val instanceof Date) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
    }
    let str = String(val).trim();
    const parts = str.split(':');
    if (parts.length >= 2) {
        let h = parts[0].padStart(2, '0');
        let m = parts[1].padStart(2, '0');
        return `${h}:${m}`;
    }
    return str;
}

/**
 * Maneja las solicitudes GET
 */
function doGet(e) {
    try {
        // Esta implementación (deployment) puede estar dedicada exclusivamente al panel
        // administrativo. Si la URL desde la que se ejecuta coincide con la URL guardada
        // como "implementación de administración", siempre se sirve el panel — sin
        // importar qué parámetros traiga la petición. Cualquier otra implementación
        // (por ejemplo la pública, usada por el formulario de citas) NUNCA sirve el panel,
        // así conozcan o no el parámetro "?page=admin".
        const adminDeploymentUrl = PropertiesService.getScriptProperties().getProperty('ADMIN_DEPLOYMENT_URL');
        const currentUrl = ScriptApp.getService().getUrl();

        if (adminDeploymentUrl && currentUrl === adminDeploymentUrl) {
            return HtmlService.createHtmlOutputFromFile('Admin')
                .setTitle('Panel Administrativo')
                .addMetaTag('viewport', 'width=device-width, initial-scale=1')
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }

        if (!e || !e.parameter) {
            return buildResponse({ 
                error: 'Solicitud inválida. Se requieren parámetros.',
                help: 'Usa ?action=getCitas&fecha=YYYY-MM-DD&sucursal=Nombre'
            }, false);
        }

        const action = e.parameter.action;
        
        if (!action) {
            return buildResponse({ 
                message: 'API de Citas funcionando correctamente',
                actions: ['getCitas', 'getHorariosDisponibles', 'testConnection']
            }, true);
        }
        
        switch(action) {
            case 'getCitas':
                return handleGetCitas(e);
            case 'getHorariosDisponibles':
                return handleGetHorariosDisponibles(e);
            case 'testConnection':
                return buildResponse({ message: 'Conexión exitosa' }, true);
            default:
                return buildResponse({ 
                    error: 'Acción no válida',
                    actions: ['getCitas', 'getHorariosDisponibles', 'testConnection']
                }, false);
        }
    } catch (error) {
        console.error('Error en doGet:', error);
        return buildResponse({ 
            error: error.toString(),
            stack: error.stack
        }, false);
    }
}

/**
 * Maneja las solicitudes POST
 */
function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return buildResponse({ 
                error: 'Solicitud POST inválida. Se requiere JSON en el cuerpo.'
            }, false);
        }

        const request = JSON.parse(e.postData.contents);
        const action = request.action;
        const data = request.data;

        if (!action) {
            return buildResponse({ 
                error: 'Se requiere el campo "action" en la solicitud'
            }, false);
        }

        switch(action) {
            case 'crearCita':
                return handleCrearCita(data);
            default:
                return buildResponse({ 
                    error: 'Acción POST no válida',
                    actions: ['crearCita']
                }, false);
        }
    } catch (error) {
        console.error('Error en doPost:', error);
        return buildResponse({ 
            error: error.toString(),
            stack: error.stack
        }, false);
    }
}

/**
 * Obtiene las citas para una fecha y sucursal específicas
 */
function handleGetCitas(e) {
    const fecha = e.parameter.fecha;
    const sucursal = e.parameter.sucursal;
    
    if (!fecha) {
        return buildResponse({ error: 'Se requiere el parámetro "fecha"' }, false);
    }
    if (!sucursal) {
        return buildResponse({ error: 'Se requiere el parámetro "sucursal"' }, false);
    }
    
    const citas = getCitasFromSheet(fecha, sucursal);
    return buildResponse(citas, true);
}

/**
 * Obtiene los horarios disponibles para una fecha y sucursal
 */
function handleGetHorariosDisponibles(e) {
    const fecha = e.parameter.fecha;
    const sucursal = e.parameter.sucursal;
    
    if (!fecha) {
        return buildResponse({ error: 'Se requiere el parámetro "fecha"' }, false);
    }
    if (!sucursal) {
        return buildResponse({ error: 'Se requiere el parámetro "sucursal"' }, false);
    }
    
    const citasOcupadas = getCitasFromSheet(fecha, sucursal);
    const horariosOcupados = citasOcupadas.map(c => normalizeTime(c.hora));
    
    const horariosDisponibles = TIME_SLOTS.filter(
        hora => !horariosOcupados.includes(normalizeTime(hora))
    );
    
    return buildResponse({
        fecha: normalizeDate(fecha),
        sucursal: sucursal,
        disponibles: horariosDisponibles,
        ocupados: horariosOcupados
    }, true);
}

/**
 * Crea una nueva cita
 */
function handleCrearCita(data) {
    const required = ['paciente', 'telefono', 'sucursal', 'servicio', 'fecha', 'hora'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
        return buildResponse({ 
            error: 'Faltan campos requeridos',
            missing: missing,
            required: required
        }, false);
    }
    
    // Sanear y truncar cada campo antes de usarlo (evita inyección de fórmulas y abuso de longitud)
    const paciente = sanitizeForSheet(data.paciente, FIELD_LIMITS.paciente);
    const telefono = sanitizeForSheet(data.telefono, FIELD_LIMITS.telefono);
    const sucursal = sanitizeForSheet(data.sucursal, FIELD_LIMITS.sucursal);
    const servicio = sanitizeForSheet(data.servicio, FIELD_LIMITS.servicio);
    const notas = sanitizeForSheet(data.notas, FIELD_LIMITS.notas);
    const estado = sanitizeForSheet(data.estado) || 'Pendiente';
    const fecha = data.fecha;
    const hora = data.hora;

    if (!isValidPhone(telefono)) {
        return buildResponse({ error: 'El teléfono debe tener entre 10 y 15 dígitos' }, false);
    }

    const fechaNorm = normalizeDate(fecha);
    const horaNorm = normalizeTime(hora);

    // Protección anti-spam: bloquear si el mismo teléfono ya generó una solicitud hace poco
    if (hasRecentDuplicateRequest(telefono)) {
        return buildResponse({
            error: 'Ya recibimos una solicitud reciente con este teléfono. Espera unos minutos antes de intentar de nuevo.'
        }, false);
    }

    // Validar que no haya duplicado de horario
    const citasExistentes = getCitasFromSheet(fechaNorm, sucursal);
    if (citasExistentes.some(c => normalizeTime(c.hora) === horaNorm)) {
        return buildResponse({ 
            error: 'Este horario ya está ocupado para la sucursal seleccionada',
            fecha: fechaNorm,
            sucursal: sucursal,
            hora: horaNorm
        }, false);
    }
    
    // Guardar cita
    const sheet = getSheet();
    const nextRow = sheet.getLastRow() + 1;
    
    const rowData = [
        paciente,
        "'" + telefono, // Anteponer apóstrofe para forzar formato texto
        sucursal,
        servicio,
        fechaNorm,
        horaNorm,
        notas,
        estado,
        new Date().toISOString(),
        Utilities.getUuid()
    ];
    
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
    
    return buildResponse({
        success: true,
        message: 'Cita agendada correctamente',
        data: {
            paciente,
            telefono,
            sucursal,
            servicio,
            fecha: fechaNorm,
            hora: horaNorm,
            notas,
            estado
        }
    }, true);
}

/**
 * Obtiene las citas de la hoja de cálculo con comparación normalizada
 */
function getCitasFromSheet(fecha, sucursal) {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const displayValues = sheet.getDataRange().getDisplayValues();
    
    if (values.length < 2) return [];
    
    const targetFecha = normalizeDate(fecha);
    const targetSucursal = String(sucursal).trim().toLowerCase();
    
    const citas = [];
    
    for (let i = 1; i < values.length; i++) {
        const rowVal = values[i];
        const rowDisp = displayValues[i];
        
        if (!rowVal[0] && !rowDisp[0]) continue; // Saltar filas vacías
        
        const cellFecha = normalizeDate(rowVal[4] || rowDisp[4]);
        const cellSucursal = String(rowVal[2] || rowDisp[2]).trim().toLowerCase();
        
        if (cellFecha === targetFecha && cellSucursal === targetSucursal) {
            citas.push({
                paciente: String(rowDisp[0] || ''),
                telefono: String(rowDisp[1] || ''),
                sucursal: String(rowDisp[2] || ''),
                servicio: String(rowDisp[3] || ''),
                fecha: cellFecha,
                hora: normalizeTime(rowVal[5] || rowDisp[5]),
                notas: String(rowDisp[6] || ''),
                estado: String(rowDisp[7] || 'Pendiente')
            });
        }
    }
    
    return citas;
}

/**
 * Obtiene o crea la hoja de citas
 */
function getSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        const headers = [
            'Paciente',
            'Teléfono',
            'Sucursal',
            'Servicio',
            'Fecha',
            'Hora',
            'Notas',
            'Estado',
            'Timestamp',
            'UUID'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
    }
    
    return sheet;
}

/**
 * Construye la respuesta JSON
 */
function buildResponse(data, success = true) {
    return ContentService
        .createTextOutput(JSON.stringify({
            status: success ? 'success' : 'error',
            data: data
        }))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Función de prueba para verificar la conexión
 */
function testConnection() {
    try {
        const sheet = getSheet();
        const lastRow = sheet.getLastRow();
        
        Logger.log('✅ Conexión exitosa a la hoja de cálculo');
        Logger.log(`📊 Citas registradas: ${lastRow - 1}`);
        
        return buildResponse({ 
            message: 'Conexión exitosa',
            citasRegistradas: lastRow - 1,
            sheetName: SHEET_NAME
        }, true);
    } catch (error) {
        Logger.log('❌ Error:', error);
        return buildResponse({ 
            error: error.toString()
        }, false);
    }
}

/**
 * Limpia citas antiguas
 */
function cleanOldAppointments() {
    const sheet = getSheet();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const displayValues = dataRange.getDisplayValues();
    
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    const rowsToDelete = [];
    
    for (let i = values.length - 1; i >= 1; i--) {
        const fechaVal = values[i][4] || displayValues[i][4];
        if (fechaVal) {
            const fechaNorm = normalizeDate(fechaVal);
            if (fechaNorm && fechaNorm < todayStr) {
                rowsToDelete.push(i + 1);
            }
        }
    }
    
    rowsToDelete.sort((a, b) => b - a);
    rowsToDelete.forEach(row => sheet.deleteRow(row));
    
    const message = `✅ Se eliminaron ${rowsToDelete.length} citas antiguas.`;
    Logger.log(message);
    
    return buildResponse({
        message: message,
        eliminadas: rowsToDelete.length
    }, true);
}

/**
 * Configura cuál URL de despliegue (deployment) queda dedicada al panel administrativo.
 * Ejecútala UNA VEZ manualmente desde el editor, después de crear la segunda implementación,
 * pegando su URL completa dentro de la función antes de correrla.
 */
function configurarUrlAdmin() {
    // 🔧 EDITA ESTE VALOR ANTES DE EJECUTAR: pega aquí la URL de tu implementación
    // dedicada al panel (la segunda que crees, distinta de la de la API pública).
    const urlDelPanelAdmin = 'https://script.google.com/macros/s/PEGA_AQUI_TU_URL/exec';

    PropertiesService.getScriptProperties().setProperty('ADMIN_DEPLOYMENT_URL', urlDelPanelAdmin.trim());
    Logger.log('✅ URL del panel administrativo configurada: ' + urlDelPanelAdmin.trim());
}

/**
 * Obtiene URL de pruebas
 */
function getTestUrl() {
    const url = ScriptApp.getService().getUrl();
    return url + '?action=testConnection';
}

/* ==========================================================================
   AUTENTICACIÓN Y SESIONES DEL PANEL ADMINISTRATIVO
   ========================================================================== */

/**
 * Obtiene (o crea) la hoja oculta de usuarios administrativos.
 * Nunca se expone vía la API pública; solo se usa dentro de este módulo.
 */
function getUsersSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(USERS_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(USERS_SHEET_NAME);
        const headers = ['Nombre', 'Email', 'PasswordHash', 'Salt', 'Rol', 'Activo', 'FechaCreacion'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        sheet.hideSheet();
    }

    return sheet;
}

function generarSalt_() {
    return Utilities.getUuid();
}

function hashPassword_(password, salt) {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + String(salt), Utilities.Charset.UTF_8);
    return Utilities.base64Encode(raw);
}

function findUserByEmail_(email) {
    const sheet = getUsersSheet_();
    const values = sheet.getDataRange().getValues();
    const target = String(email || '').trim().toLowerCase();

    for (let i = 1; i < values.length; i++) {
        const rowEmail = String(values[i][1] || '').trim().toLowerCase();
        if (rowEmail && rowEmail === target) {
            return {
                rowIndex: i + 1,
                nombre: values[i][0],
                email: values[i][1],
                passwordHash: values[i][2],
                salt: values[i][3],
                rol: values[i][4],
                activo: values[i][5] === true || values[i][5] === 'TRUE'
            };
        }
    }
    return null;
}

function crearOActualizarUsuario_(nombre, email, passwordPlano, rol, activo) {
    const sheet = getUsersSheet_();
    const salt = generarSalt_();
    const hash = hashPassword_(passwordPlano, salt);
    const existente = findUserByEmail_(email);

    if (existente) {
        sheet.getRange(existente.rowIndex, 1, 1, 6).setValues([[nombre, email, hash, salt, rol, activo]]);
    } else {
        sheet.appendRow([nombre, email, hash, salt, rol, activo, new Date().toISOString()]);
    }
}

/**
 * Configuración inicial: crea el primer usuario administrador.
 * Solo funciona UNA vez (protegido por una bandera en Propiedades del Script).
 * Ejecútala manualmente desde el editor de Apps Script (menú Ejecutar > crearPrimerAdmin),
 * después de escribir el nombre, correo y contraseña reales aquí abajo.
 */
function crearPrimerAdmin() {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('SETUP_COMPLETE') === 'true') {
        throw new Error('La configuración inicial ya se completó. Usa el panel para crear más usuarios.');
    }

    // 🔧 EDITA ESTOS TRES VALORES ANTES DE EJECUTAR:
    const nombre = 'Nombre de tu clienta';
    const email = 'correo@ejemplo.com';
    const passwordPlano = 'CambiaEstaContraseña123';

    crearOActualizarUsuario_(nombre, email, passwordPlano, 'admin', true);
    props.setProperty('SETUP_COMPLETE', 'true');
    Logger.log('Usuario administrador creado: ' + email + ' — ¡cambia la contraseña por defecto desde el panel!');
}

/**
 * Crea o actualiza usuarios adicionales del panel. Requiere sesión de un admin existente.
 */
function crearUsuarioAdmin(token, nombre, email, passwordPlano, rol) {
    const session = validateToken_(token);
    if (session.rol !== 'admin') {
        throw new Error('No tienes permisos para crear usuarios');
    }
    if (!nombre || !email || !passwordPlano) {
        throw new Error('Nombre, correo y contraseña son obligatorios');
    }
    const rolFinal = rol === 'admin' ? 'admin' : 'staff';
    crearOActualizarUsuario_(nombre.trim(), email.trim(), passwordPlano, rolFinal, true);
    return { success: true };
}

function createSessionToken_(email, nombre, rol) {
    const token = Utilities.getUuid();
    const cache = CacheService.getScriptCache();
    cache.put('session_' + token, JSON.stringify({ email, nombre, rol }), SESSION_DURATION_SECONDS);
    return token;
}

/**
 * Valida un token de sesión. Lanza un error si no es válido o expiró.
 * Todas las funciones del panel que exponen o modifican datos deben llamarla primero.
 */
function validateToken_(token) {
    if (!token) {
        throw new Error('Sesión no válida. Inicia sesión nuevamente.');
    }
    const cache = CacheService.getScriptCache();
    const payload = cache.get('session_' + token);
    if (!payload) {
        throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    }
    return JSON.parse(payload);
}

/**
 * Inicio de sesión con correo y contraseña.
 */
function loginWithPassword(email, password) {
    const user = findUserByEmail_(email);
    if (!user || !user.activo) {
        throw new Error('Correo o contraseña incorrectos');
    }
    const hash = hashPassword_(password, user.salt);
    if (hash !== user.passwordHash) {
        throw new Error('Correo o contraseña incorrectos');
    }
    const token = createSessionToken_(user.email, user.nombre, user.rol);
    return { token: token, nombre: user.nombre, email: user.email, rol: user.rol };
}

/**
 * Intento de inicio de sesión automático con la cuenta de Google activa.
 * Solo funciona si el despliegue se publicó como "Ejecutar como: Usuario que accede"
 * y esa persona ya está autorizada en la hoja de Usuarios. Si no aplica, el panel
 * simplemente muestra el formulario de correo y contraseña.
 */
function checkGoogleSession() {
    try {
        const email = Session.getActiveUser().getEmail();
        if (!email) return { authenticated: false };

        const user = findUserByEmail_(email);
        if (user && user.activo) {
            const token = createSessionToken_(user.email, user.nombre, user.rol);
            return { authenticated: true, token: token, nombre: user.nombre, email: user.email };
        }
        return { authenticated: false };
    } catch (err) {
        return { authenticated: false };
    }
}

function logout(token) {
    if (token) {
        CacheService.getScriptCache().remove('session_' + token);
    }
    return true;
}

/**
 * Catálogos (sucursales, servicios, estados y horarios) para poblar el panel.
 */
function getConfigListas(token) {
    validateToken_(token);
    return {
        sucursales: SUCURSALES,
        servicios: SERVICIOS,
        estados: ESTADOS_VALIDOS,
        horarios: TIME_SLOTS
    };
}

/* ==========================================================================
   CRUD DE CITAS PARA EL PANEL (requiere sesión válida)
   ========================================================================== */

function getCitaRowByUuid_(uuid) {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
        if (values[i][9] && String(values[i][9]) === String(uuid)) {
            return { rowIndex: i + 1, row: values[i] };
        }
    }
    return null;
}

/**
 * Devuelve citas con filtros opcionales (fecha, sucursal, estado, búsqueda por nombre/teléfono).
 */
function adminGetCitas(token, filtros) {
    validateToken_(token);
    filtros = filtros || {};

    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const displayValues = sheet.getDataRange().getDisplayValues();
    const citas = [];

    for (let i = 1; i < values.length; i++) {
        const rowVal = values[i];
        const rowDisp = displayValues[i];
        if (!rowVal[9]) continue; // fila sin UUID = vacía

        const cita = {
            uuid: String(rowVal[9]),
            paciente: String(rowDisp[0] || ''),
            telefono: String(rowDisp[1] || ''),
            sucursal: String(rowDisp[2] || ''),
            servicio: String(rowDisp[3] || ''),
            fecha: normalizeDate(rowVal[4] || rowDisp[4]),
            hora: normalizeTime(rowVal[5] || rowDisp[5]),
            notas: String(rowDisp[6] || ''),
            estado: String(rowDisp[7] || 'Pendiente')
        };

        if (filtros.fecha && cita.fecha !== normalizeDate(filtros.fecha)) continue;
        if (filtros.sucursal && cita.sucursal.toLowerCase() !== String(filtros.sucursal).toLowerCase()) continue;
        if (filtros.estado && cita.estado.toLowerCase() !== String(filtros.estado).toLowerCase()) continue;
        if (filtros.busqueda) {
            const q = String(filtros.busqueda).toLowerCase();
            if (!cita.paciente.toLowerCase().includes(q) && !cita.telefono.includes(q)) continue;
        }

        citas.push(cita);
    }

    citas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    return citas;
}

/**
 * Cambia el estatus de una cita (Pendiente / Confirmada / Cancelada / Completada / No asistió).
 */
function adminUpdateEstado(token, uuid, nuevoEstado) {
    validateToken_(token);
    if (ESTADOS_VALIDOS.indexOf(nuevoEstado) === -1) {
        throw new Error('Estado no válido');
    }
    const found = getCitaRowByUuid_(uuid);
    if (!found) throw new Error('No se encontró la cita');

    getSheet().getRange(found.rowIndex, 8).setValue(nuevoEstado); // columna H = Estado
    return { success: true, uuid: uuid, estado: nuevoEstado };
}

/**
 * Agenda una cita manualmente desde el panel (la clienta atendiendo una llamada, por ejemplo).
 * Por defecto respeta el mismo control de horarios ocupados que el formulario público;
 * si se necesita forzar un traslape (caso excepcional) se puede pasar { forzar: true }.
 */
function adminCrearCita(token, citaData) {
    validateToken_(token);

    const required = ['paciente', 'telefono', 'sucursal', 'servicio', 'fecha', 'hora'];
    const missing = required.filter(f => !citaData[f]);
    if (missing.length > 0) {
        throw new Error('Faltan campos: ' + missing.join(', '));
    }

    const paciente = sanitizeForSheet(citaData.paciente, FIELD_LIMITS.paciente);
    const telefono = sanitizeForSheet(citaData.telefono, FIELD_LIMITS.telefono);
    const sucursal = sanitizeForSheet(citaData.sucursal, FIELD_LIMITS.sucursal);
    const servicio = sanitizeForSheet(citaData.servicio, FIELD_LIMITS.servicio);
    const notas = sanitizeForSheet(citaData.notas, FIELD_LIMITS.notas);
    const estado = ESTADOS_VALIDOS.indexOf(citaData.estado) !== -1 ? citaData.estado : 'Pendiente';

    if (!isValidPhone(telefono)) {
        throw new Error('Teléfono inválido (debe tener entre 10 y 15 dígitos)');
    }

    const fechaNorm = normalizeDate(citaData.fecha);
    const horaNorm = normalizeTime(citaData.hora);

    if (!citaData.forzar) {
        const existentes = getCitasFromSheet(fechaNorm, sucursal);
        if (existentes.some(c => normalizeTime(c.hora) === horaNorm)) {
            throw new Error('Ese horario ya está ocupado en esta sucursal');
        }
    }

    const sheet = getSheet();
    const nextRow = sheet.getLastRow() + 1;
    const rowData = [paciente, "'" + telefono, sucursal, servicio, fechaNorm, horaNorm, notas, estado, new Date().toISOString(), Utilities.getUuid()];
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    return { success: true, uuid: rowData[9] };
}

/**
 * Elimina una cita por error de captura. Para cancelaciones normales usa adminUpdateEstado.
 */
function adminEliminarCita(token, uuid) {
    validateToken_(token);
    const found = getCitaRowByUuid_(uuid);
    if (!found) throw new Error('No se encontró la cita');
    getSheet().deleteRow(found.rowIndex);
    return { success: true };
}

/* ==========================================================================
   HISTORIAL DE PACIENTES (agregado desde la hoja de Citas)
   ========================================================================== */
function adminGetPacientes(token) {
    validateToken_(token);

    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const displayValues = sheet.getDataRange().getDisplayValues();
    const mapa = {};

    for (let i = 1; i < values.length; i++) {
        const rowVal = values[i];
        const rowDisp = displayValues[i];
        if (!rowVal[9]) continue;

        const telefono = String(rowDisp[1] || '').trim();
        if (!telefono) continue;

        const fecha = normalizeDate(rowVal[4] || rowDisp[4]);
        const nombre = String(rowDisp[0] || '');
        const nota = String(rowDisp[6] || '').trim();

        if (!mapa[telefono]) {
            mapa[telefono] = { telefono: telefono, paciente: nombre, totalCitas: 0, ultimaFecha: fecha, sucursales: {}, notas: [] };
        }

        const p = mapa[telefono];
        p.totalCitas += 1;
        if (nombre) p.paciente = nombre; // usa el nombre capturado más recientemente
        if (fecha > p.ultimaFecha) p.ultimaFecha = fecha;
        if (rowDisp[2]) p.sucursales[String(rowDisp[2])] = true;
        if (nota) p.notas.push({ fecha: fecha, nota: nota });
    }

    return Object.keys(mapa).map((tel) => {
        const p = mapa[tel];
        return {
            telefono: p.telefono,
            paciente: p.paciente,
            totalCitas: p.totalCitas,
            ultimaFecha: p.ultimaFecha,
            sucursales: Object.keys(p.sucursales),
            notas: p.notas.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)
        };
    }).sort((a, b) => b.ultimaFecha.localeCompare(a.ultimaFecha));
}

/* ==========================================================================
   DASHBOARD DE MÉTRICAS
   ========================================================================== */
function adminGetDashboard(token) {
    validateToken_(token);

    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    const displayValues = sheet.getDataRange().getDisplayValues();
    const tz = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    const hoy = new Date(todayStr + 'T00:00:00');
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const inicioSemanaStr = Utilities.formatDate(inicioSemana, tz, 'yyyy-MM-dd');

    const porEstado = {};
    const porSucursal = {};
    let total = 0;
    let citasHoy = 0;
    let citasSemana = 0;

    for (let i = 1; i < values.length; i++) {
        const rowVal = values[i];
        const rowDisp = displayValues[i];
        if (!rowVal[9]) continue;

        total += 1;

        const estado = String(rowDisp[7] || 'Pendiente');
        porEstado[estado] = (porEstado[estado] || 0) + 1;

        const sucursal = String(rowDisp[2] || '');
        porSucursal[sucursal] = (porSucursal[sucursal] || 0) + 1;

        const fecha = normalizeDate(rowVal[4] || rowDisp[4]);
        if (fecha === todayStr) citasHoy += 1;
        if (fecha >= inicioSemanaStr) citasSemana += 1;
    }

    return { total, citasHoy, citasSemana, porEstado, porSucursal };
}

/* ==========================================================================
   EXPORTAR COMPROBANTE DE CITA A PDF
   ========================================================================== */

/**
 * Genera un PDF con los datos de una cita y lo devuelve en base64
 * (se crea un Google Doc temporal solo para el proceso y se elimina después).
 */
function adminExportCitaPDF(token, uuid) {
    validateToken_(token);

    const found = getCitaRowByUuid_(uuid);
    if (!found) throw new Error('No se encontró la cita');

    const displayRow = getSheet().getRange(found.rowIndex, 1, 1, 10).getDisplayValues()[0];
    const cita = {
        paciente: displayRow[0] || 'Sin nombre',
        telefono: displayRow[1] || '',
        sucursal: displayRow[2] || '',
        servicio: displayRow[3] || '',
        fecha: normalizeDate(displayRow[4]),
        hora: normalizeTime(displayRow[5]),
        notas: displayRow[6] || '—',
        estado: displayRow[7] || 'Pendiente'
    };

    const doc = DocumentApp.create('Comprobante de Cita - ' + cita.paciente + ' - ' + cita.fecha);
    const body = doc.getBody();
    body.setMarginTop(50).setMarginBottom(50).setMarginLeft(50).setMarginRight(50);

    body.appendParagraph(BRAND_NAME).setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph('Comprobante de Cita').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendHorizontalRule();

    const filas = [
        ['Paciente', cita.paciente],
        ['Teléfono', cita.telefono],
        ['Sucursal', cita.sucursal],
        ['Servicio', cita.servicio],
        ['Fecha', cita.fecha],
        ['Hora', cita.hora],
        ['Estatus', cita.estado],
        ['Notas', cita.notas]
    ];

    const table = body.appendTable(filas);
    for (let i = 0; i < filas.length; i++) {
        const labelCell = table.getRow(i).getCell(0);
        labelCell.editAsText().setBold(true);
        labelCell.setWidth(120);
    }

    body.appendParagraph(' ');
    body.appendParagraph(BRAND_PHONE).setFontSize(9);
    body.appendParagraph('Generado el ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
        .setItalic(true)
        .setFontSize(9);

    doc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());

    // El documento temporal ya no se necesita: solo sirvió para generar el PDF
    DriveApp.getFileById(doc.getId()).setTrashed(true);

    const nombreArchivo = 'Cita_' + cita.paciente.replace(/[^a-zA-Z0-9]+/g, '_') + '_' + cita.fecha + '.pdf';

    return {
        base64: base64,
        filename: nombreArchivo,
        mimeType: 'application/pdf'
    };
}

/* ==========================================================================
   RESPALDO SEMANAL DE LA HOJA DE CITAS A EXCEL (.xlsx)
   ========================================================================== */

function getOrCreateBackupFolder_() {
    const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder(BACKUP_FOLDER_NAME);
}

function limpiarRespaldosAntiguos_(folder) {
    const archivos = [];
    const it = folder.getFilesByType(MimeType.MICROSOFT_EXCEL);
    while (it.hasNext()) archivos.push(it.next());

    archivos.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());

    for (let i = MAX_BACKUPS_TO_KEEP; i < archivos.length; i++) {
        archivos[i].setTrashed(true);
    }
}

/**
 * Exporta SOLO la hoja de Citas (nunca la hoja de Usuarios) a un archivo .xlsx
 * dentro de una carpeta de Drive dedicada. Pensada para correr automáticamente
 * cada semana mediante un disparador de tiempo (ver instalarTriggerRespaldoSemanal).
 */
function backupCitasSemanal() {
    const sourceSheet = getSheet();

    // Se crea una hoja de cálculo temporal con una copia de SOLO la hoja de Citas,
    // para que el respaldo nunca incluya la hoja oculta de Usuarios (contraseñas).
    const tempSS = SpreadsheetApp.create('Respaldo temporal - Citas - ' + new Date().toISOString());
    const copiaCitas = sourceSheet.copyTo(tempSS);
    copiaCitas.setName('Citas');

    const hojaPorDefecto = tempSS.getSheets().find(s => s.getSheetId() !== copiaCitas.getSheetId());
    if (hojaPorDefecto) tempSS.deleteSheet(hojaPorDefecto);

    SpreadsheetApp.flush();

    const url = 'https://docs.google.com/spreadsheets/d/' + tempSS.getId() + '/export?format=xlsx';
    const response = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });

    const nombreArchivo = 'Citas_Respaldo_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.xlsx';
    const blob = response.getBlob().setName(nombreArchivo);

    const folder = getOrCreateBackupFolder_();
    const file = folder.createFile(blob);

    // La hoja de cálculo temporal ya cumplió su función (solo servía para exportar)
    DriveApp.getFileById(tempSS.getId()).setTrashed(true);

    const props = PropertiesService.getScriptProperties();
    props.setProperty('LAST_BACKUP_DATE', new Date().toISOString());
    props.setProperty('LAST_BACKUP_URL', file.getUrl());

    limpiarRespaldosAntiguos_(folder);

    // Se incluye el contenido en base64 para que, cuando se genera manualmente desde
    // el panel, el navegador pueda además descargarlo directo a la computadora
    // (el respaldo automático semanal solo lo usa para guardar en Drive, sin descarga).
    const base64 = Utilities.base64Encode(blob.getBytes());

    return {
        fileId: file.getId(),
        fileName: file.getName(),
        url: file.getUrl(),
        base64: base64,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

/**
 * Instala el disparador semanal (cada lunes ~2:00 AM). Ejecútala UNA VEZ manualmente
 * desde el editor de Apps Script (menú Ejecutar > instalarTriggerRespaldoSemanal).
 */
function instalarTriggerRespaldoSemanal() {
    ScriptApp.getProjectTriggers().forEach((t) => {
        if (t.getHandlerFunction() === 'backupCitasSemanal') ScriptApp.deleteTrigger(t);
    });

    ScriptApp.newTrigger('backupCitasSemanal')
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.MONDAY)
        .atHour(2)
        .create();

    Logger.log('✅ Respaldo automático instalado: cada lunes alrededor de las 2:00 AM.');
}

/**
 * Info del último respaldo, para mostrar en el panel.
 */
function adminGetBackupInfo(token) {
    validateToken_(token);
    const props = PropertiesService.getScriptProperties();
    return {
        lastBackupDate: props.getProperty('LAST_BACKUP_DATE') || null,
        lastBackupUrl: props.getProperty('LAST_BACKUP_URL') || null
    };
}

/**
 * Permite generar un respaldo manualmente desde el panel (además del automático semanal).
 */
function adminForzarRespaldo(token) {
    validateToken_(token);
    return backupCitasSemanal();
}