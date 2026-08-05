/**
 * API Client para Google Apps Script
 */
const API = {
    async fetch(endpoint, params = {}) {
        // Construir la Query String correctamente
        const searchParams = new URLSearchParams({ action: endpoint, ...params });
        const url = `${CLINIC_CONFIG.API_URL}?${searchParams.toString()}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow'
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.data?.error || data.message || 'Error en el servidor');
            }

            return data.data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async post(endpoint, payload) {
        try {
            const response = await fetch(CLINIC_CONFIG.API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Requerido por Apps Script para evitar bloqueos de CORS pre-flight
                },
                body: JSON.stringify({
                    action: endpoint,
                    data: payload
                })
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.data?.error || data.message || 'Error en el servidor');
            }

            return data.data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Métodos específicos corregidos
    async getCitas(fecha, sucursal) {
        return this.fetch('getCitas', { fecha, sucursal });
    },

    async crearCita(citaData) {
        return this.post('crearCita', citaData);
    },

    async getHorariosDisponibles(fecha, sucursal) {
        return this.fetch('getHorariosDisponibles', { fecha, sucursal });
    }
};