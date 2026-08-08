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
 * Obtiene URL de pruebas
 */
function getTestUrl() {
    const url = ScriptApp.getService().getUrl();
    return url + '?action=testConnection';
}