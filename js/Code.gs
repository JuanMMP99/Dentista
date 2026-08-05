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

/**
 * Maneja las solicitudes GET
 */
function doGet(e) {
    try {
        // Verificar si hay parámetros
        if (!e || !e.parameter) {
            return buildResponse({ 
                error: 'Solicitud inválida. Se requieren parámetros.',
                help: 'Usa ?action=getCitas&fecha=YYYY-MM-DD&sucursal=Nombre'
            }, false);
        }

        const action = e.parameter.action;
        
        // Si no hay acción especificada, devolver ayuda
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
        // Verificar que haya datos
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
    
    // Validar parámetros
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
    
    // Validar parámetros
    if (!fecha) {
        return buildResponse({ error: 'Se requiere el parámetro "fecha"' }, false);
    }
    if (!sucursal) {
        return buildResponse({ error: 'Se requiere el parámetro "sucursal"' }, false);
    }
    
    const citasOcupadas = getCitasFromSheet(fecha, sucursal);
    const horariosOcupados = citasOcupadas.map(c => c.hora);
    
    const horariosDisponibles = TIME_SLOTS.filter(
        hora => !horariosOcupados.includes(hora)
    );
    
    return buildResponse({
        fecha: fecha,
        sucursal: sucursal,
        disponibles: horariosDisponibles,
        ocupados: horariosOcupados
    }, true);
}

/**
 * Crea una nueva cita
 */
function handleCrearCita(data) {
    // Validar datos requeridos
    const required = ['paciente', 'telefono', 'sucursal', 'servicio', 'fecha', 'hora'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
        return buildResponse({ 
            error: 'Faltan campos requeridos',
            missing: missing,
            required: required
        }, false);
    }
    
    const { paciente, telefono, sucursal, servicio, fecha, hora, notas, estado } = data;
    
    // Validar que no haya duplicado
    const citasExistentes = getCitasFromSheet(fecha, sucursal);
    if (citasExistentes.some(c => c.hora === hora)) {
        return buildResponse({ 
            error: 'Este horario ya está ocupado',
            fecha: fecha,
            sucursal: sucursal,
            hora: hora
        }, false);
    }
    
    // Guardar cita
    const sheet = getSheet();
    const nextRow = sheet.getLastRow() + 1;
    
    const rowData = [
        paciente,
        telefono,
        sucursal,
        servicio,
        fecha,
        hora,
        notas || '',
        estado || 'Pendiente',
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
            fecha,
            hora,
            notas: notas || '',
            estado: estado || 'Pendiente'
        }
    }, true);
}

/**
 * Obtiene las citas de la hoja de cálculo
 */
function getCitasFromSheet(fecha, sucursal) {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) return [];
    
    // Estructura: [Paciente, Teléfono, Sucursal, Servicio, Fecha, Hora, Notas, Estado, Timestamp, UUID]
    const citas = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // Saltar filas vacías
        
        const fechaCita = row[4]; // Columna E (índice 4)
        const sucursalCita = row[2]; // Columna C (índice 2)
        
        if (fechaCita === fecha && sucursalCita === sucursal) {
            citas.push({
                paciente: row[0] || '',
                telefono: row[1] || '',
                sucursal: row[2] || '',
                servicio: row[3] || '',
                fecha: row[4] || '',
                hora: row[5] || '',
                notas: row[6] || '',
                estado: row[7] || 'Pendiente'
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
        // Crear encabezados
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
 * Ejecutar manualmente desde el editor de Apps Script
 */
function testConnection() {
    try {
        // Verificar que la hoja exista
        const sheet = getSheet();
        const lastRow = sheet.getLastRow();
        
        Logger.log('✅ Conexión exitosa a la hoja de cálculo');
        Logger.log(`📊 Citas registradas: ${lastRow - 1}`);
        
        // Retornar información
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
 * Limpia citas antiguas (opcional)
 * Ejecutar manualmente desde el editor de Apps Script
 */
function cleanOldAppointments() {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const rowsToDelete = [];
    
    for (let i = data.length - 1; i >= 1; i--) {
        const fechaStr = data[i][4]; // Columna Fecha
        if (fechaStr) {
            const fecha = new Date(fechaStr + 'T00:00:00');
            if (fecha < today) {
                rowsToDelete.push(i + 1);
            }
        }
    }
    
    // Eliminar filas de atrás hacia adelante
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
 * Función para probar la API desde el navegador
 * Copia esta URL después de desplegar: 
 * https://script.google.com/macros/s/TU_ID/exec?action=testConnection
 */
function getTestUrl() {
    const url = ScriptApp.getService().getUrl();
    return url + '?action=testConnection';
}