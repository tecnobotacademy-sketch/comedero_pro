// ==========================================
// CLIENTE JAVASCRIPT REST API (GITHUB PAGES)
// Comedero Automático Pro para Mascotas
// ==========================================

let deviceIp = "192.168.4.1";
let isOnline = false;
let pollTimer = null;

// Elementos DOM
const connBadge = document.getElementById('connBadge');
const connStatusText = document.getElementById('connStatusText');
const deviceIpInput = document.getElementById('deviceIpInput');
const btnConnectIp = document.getElementById('btnConnectIp');

const headerPetName = document.getElementById('headerPetName');
const valCurrentTime = document.getElementById('valCurrentTime');
const valCurrentDate = document.getElementById('valCurrentDate');
const valNextSchedule = document.getElementById('valNextSchedule');
const valTotalFeeds = document.getElementById('valTotalFeeds');

const tagRtc = document.getElementById('tagRtc');
const tagOled = document.getElementById('tagOled');
const tagWifi = document.getElementById('tagWifi');
const tagMotor = document.getElementById('tagMotor');

const manualPortions = document.getElementById('manualPortions');
const btnFeedNow = document.getElementById('btnFeedNow');
const feedProgressContainer = document.getElementById('feedProgressContainer');
const feedProgressFill = document.getElementById('feedProgressFill');
const feedProgressText = document.getElementById('feedProgressText');

const schedulesContainer = document.getElementById('schedulesContainer');
const btnRefreshSchedules = document.getElementById('btnRefreshSchedules');
const btnSyncTime = document.getElementById('btnSyncTime');

const wifiForm = document.getElementById('wifiForm');
const btnScanWiFi = document.getElementById('btnScanWiFi');
const wifiSsidSelect = document.getElementById('wifiSsidSelect');
const configForm = document.getElementById('configForm');
const speedInput = document.getElementById('speedInput');
const speedValueLabel = document.getElementById('speedValueLabel');
const historyTableBody = document.getElementById('historyTableBody');
const toast = document.getElementById('toast');

// Actualizar etiqueta del slider en tiempo real
if (speedInput && speedValueLabel) {
    speedInput.addEventListener('input', (e) => {
        speedValueLabel.textContent = `${e.target.value}ms/paso`;
    });
}

// Utilitario de Notificaciones Toast
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// Obtener URL Base de la API REST
function getBaseUrl() {
    let ip = deviceIpInput.value.trim();
    if (!ip.startsWith('http://') && !ip.startsWith('https://')) {
        ip = 'http://' + ip;
    }
    return ip;
}

// Actualizar Indicador de Conexión
function setOnlineStatus(online) {
    isOnline = online;
    if (online) {
        connBadge.className = 'connection-badge online';
        connStatusText.textContent = 'ONLINE';
    } else {
        connBadge.className = 'connection-badge offline';
        connStatusText.textContent = 'DESCONECTADO';
    }
}

// Polling de Estado del Sistema (/api/status)
async function fetchStatus() {
    try {
        const response = await fetch(`${getBaseUrl()}/api/status`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error('Respuesta HTTP no OK');
        const data = await response.json();

        setOnlineStatus(true);

        // Actualizar UI
        headerPetName.textContent = data.petName || "Comedero Mascota";
        valCurrentTime.textContent = data.currentTime || "--:--:--";
        valCurrentDate.textContent = data.currentDate || "----/--/--";
        valNextSchedule.textContent = data.nextSchedule || "--:--";
        valTotalFeeds.textContent = data.totalFeeds || "0";

        tagRtc.textContent = data.rtcOK ? "RTC: OK" : "RTC: ERR";
        tagRtc.style.borderColor = data.rtcOK ? "#10b981" : "#ef4444";

        tagOled.textContent = data.oledOK ? "OLED: OK" : "OLED: ERR";
        tagWifi.textContent = data.wifiConnected ? "Wi-Fi: STA" : "Wi-Fi: AP";

        if (data.motorBusy) {
            tagMotor.textContent = "Motor: DISPENSANDO";
            tagMotor.style.borderColor = "#f59e0b";
            feedProgressContainer.classList.remove('hidden');
            let pct = data.feedingProgress || 0;
            feedProgressFill.style.width = `${pct}%`;
            feedProgressText.textContent = `${pct}%`;
        } else {
            tagMotor.textContent = "Motor: LISTO";
            tagMotor.style.borderColor = "#10b981";
            feedProgressContainer.classList.add('hidden');
        }

    } catch (err) {
        setOnlineStatus(false);
    }
}

// Obtener Horarios (/api/schedules)
async function fetchSchedules() {
    try {
        const response = await fetch(`${getBaseUrl()}/api/schedules`);
        if (!response.ok) return;
        const schedules = await response.json();

        schedulesContainer.innerHTML = '';
        schedules.forEach(sch => {
            const timeVal = `${String(sch.hour).padStart(2, '0')}:${String(sch.minute).padStart(2, '0')}`;
            const item = document.createElement('div');
            item.className = 'schedule-item';
            item.innerHTML = `
                <div class="schedule-info">
                    <input type="time" class="schedule-time-input" value="${timeVal}" id="schTime_${sch.id}">
                    <div class="portion-selector">
                        <label>Porciones:</label>
                        <select id="schPortions_${sch.id}">
                            ${[1,2,3,4,5,6,7,8,9,10].map(p => `<option value="${p}" ${p === sch.portions ? 'selected' : ''}>${p}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="schedule-controls">
                    <label class="switch">
                        <input type="checkbox" id="schActive_${sch.id}" ${sch.active ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-sm btn-primary" onclick="saveScheduleItem(${sch.id})">Guardar</button>
                </div>
            `;
            schedulesContainer.appendChild(item);
        });
    } catch (err) {
        showToast("Error al cargar horarios", true);
    }
}

// Guardar Horario Individual
window.saveScheduleItem = async function(id) {
    const timeVal = document.getElementById(`schTime_${id}`).value;
    const portions = parseInt(document.getElementById(`schPortions_${id}`).value);
    const active = document.getElementById(`schActive_${id}`).checked;

    if (!timeVal) return;
    const [hour, minute] = timeVal.split(':').map(Number);

    try {
        const response = await fetch(`${getBaseUrl()}/api/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, hour, minute, portions, active })
        });
        if (response.ok) {
            showToast(`Horario #${id + 1} guardado correctamente`);
            fetchStatus();
        } else {
            showToast("Error al guardar el horario", true);
        }
    } catch (err) {
        showToast("Error de conexión", true);
    }
};

// Solicitud de Alimentación Manual (/api/feed)
btnFeedNow.addEventListener('click', async () => {
    const portions = parseInt(manualPortions.value);
    try {
        const response = await fetch(`${getBaseUrl()}/api/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portions })
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`¡Iniciado dispensado manual de ${portions} porción(es)!`);
            fetchStatus();
        } else {
            showToast(result.error || "No se pudo iniciar dispensado", true);
        }
    } catch (err) {
        showToast("Error de comunicación con el ESP32", true);
    }
});

// Sincronización de Hora del Celular (/api/time)
btnSyncTime.addEventListener('click', async () => {
    const now = new Date();
    const payload = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds()
    };

    try {
        const response = await fetch(`${getBaseUrl()}/api/time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast("¡Hora RTC del ESP32 sincronizada!");
            fetchStatus();
        } else {
            showToast("Error al sincronizar la hora", true);
        }
    } catch (err) {
        showToast("Error de conexión", true);
    }
});

// Escanear Redes Wi-Fi (/api/wifi/scan)
btnScanWiFi.addEventListener('click', async () => {
    btnScanWiFi.disabled = true;
    btnScanWiFi.textContent = '⏳ Escaneando redes... (Toma unos segundos)';
    wifiSsidSelect.innerHTML = '<option value="">-- Escaneando... --</option>';

    try {
        const response = await fetch(`${getBaseUrl()}/api/wifi/scan`);
        if (!response.ok) throw new Error('Error en escaneo');
        const networks = await response.json();

        wifiSsidSelect.innerHTML = '<option value="">-- Selecciona una red --</option>';
        if (networks.length === 0) {
            wifiSsidSelect.innerHTML = '<option value="">-- No se encontraron redes --</option>';
        } else {
            networks.forEach(net => {
                const lock = net.secure ? '🔒' : '🔓';
                const opt = document.createElement('option');
                opt.value = net.ssid;
                opt.textContent = `${lock} ${net.ssid} (${net.rssi} dBm)`;
                wifiSsidSelect.appendChild(opt);
            });
        }
        showToast(`Escaneo completo: ${networks.length} redes encontradas.`);
    } catch (err) {
        showToast("Error al escanear redes", true);
        wifiSsidSelect.innerHTML = '<option value="">-- Error al escanear --</option>';
    } finally {
        btnScanWiFi.disabled = false;
        btnScanWiFi.textContent = '🔍 Escanear Redes Disponibles';
    }
});

// Al seleccionar una red del dropdown, pasarlo al input
wifiSsidSelect.addEventListener('change', (e) => {
    if (e.target.value) {
        document.getElementById('wifiSsid').value = e.target.value;
    }
});

// Guardar Configuración Wi-Fi (/api/wifi)
wifiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ssid = document.getElementById('wifiSsid').value.trim();
    const password = document.getElementById('wifiPass').value.trim();

    if (!ssid) {
        showToast("Ingresa el SSID de la red Wi-Fi", true);
        return;
    }

    try {
        const response = await fetch(`${getBaseUrl()}/api/wifi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssid, password })
        });
        if (response.ok) {
            showToast("Credenciales guardadas. ESP32 intentará conectarse.");
        } else {
            showToast("Error al guardar Wi-Fi", true);
        }
    } catch (err) {
        showToast("Error de conexión", true);
    }
});

// Guardar Ajustes Generales (/api/config)
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const petName = document.getElementById('petNameInput').value.trim();
    const stepsPerPortion = parseInt(document.getElementById('stepsInput').value);
    const motorSpeedMs = parseInt(speedInput.value);

    const payload = {};
    if (petName) payload.petName = petName;
    if (!isNaN(stepsPerPortion)) payload.stepsPerPortion = stepsPerPortion;
    if (!isNaN(motorSpeedMs)) payload.motorSpeedMs = motorSpeedMs;

    try {
        const response = await fetch(`${getBaseUrl()}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast("Ajustes guardados correctamente");
            fetchStatus();
        } else {
            showToast("Error al guardar ajustes", true);
        }
    } catch (err) {
        showToast("Error de conexión", true);
    }
});

// Cargar Historial (/api/history)
async function fetchHistory() {
    try {
        const response = await fetch(`${getBaseUrl()}/api/history`);
        if (!response.ok) return;
        const history = await response.json();

        historyTableBody.innerHTML = '';
        if (history.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Sin alimentaciones aún</td></tr>';
            return;
        }

        history.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.timestamp}</td>
                <td>${item.portions} porción(es)</td>
                <td><span class="tag">${item.type}</span></td>
            `;
            historyTableBody.appendChild(tr);
        });
    } catch (err) {}
}

// Cargar Configuración Inicial del Dispositivo
async function fetchDeviceConfig() {
    try {
        const response = await fetch(`${getBaseUrl()}/api/config`);
        if (!response.ok) return;
        const cfg = await response.json();
        if (cfg.petName) document.getElementById('petNameInput').value = cfg.petName;
        if (cfg.stepsPerPortion) document.getElementById('stepsInput').value = cfg.stepsPerPortion;
        if (cfg.motorSpeedMs && speedInput) {
            speedInput.value = cfg.motorSpeedMs;
            if (speedValueLabel) speedValueLabel.textContent = `${cfg.motorSpeedMs}ms/paso`;
        }
        if (cfg.wifiSsid) document.getElementById('wifiSsid').value = cfg.wifiSsid;
    } catch (err) {}
}

// Botones e Inicialización
btnConnectIp.addEventListener('click', () => {
    fetchStatus();
    fetchSchedules();
    fetchHistory();
    fetchDeviceConfig();
});

btnRefreshSchedules.addEventListener('click', fetchSchedules);

// Inicio de Polling
fetchStatus();
fetchSchedules();
fetchHistory();
fetchDeviceConfig();

setInterval(fetchStatus, 2000);
setInterval(fetchHistory, 10000);
