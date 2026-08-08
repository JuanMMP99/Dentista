# Guía de Configuración — CRM de Citas para Consultorio Dental

Esta guía documenta, paso a paso y desde cero, cómo se configuró el sistema completo: formulario público de citas + Google Sheets como base de datos + panel administrativo (CRM) en Google Apps Script, con URLs separadas, respaldos automáticos y exportación a PDF.

Está pensada para que puedas reproducir esta misma configuración en otro proyecto similar, o para que se la entregues a tu clienta como referencia de "qué hay detrás" de su sistema.

---

## Arquitectura general

```
┌─────────────────────┐         ┌──────────────────────────────┐
│   Landing pública    │  HTTP   │   Google Apps Script (Code.gs)│
│  (index.html, JS,    │ ──────► │                                │
│   CSS — hosting       │         │   Implementación A (pública)  │
│   estático aparte)   │         │   → API de citas               │
└─────────────────────┘         │                                │
                                  │   Implementación B (privada)  │
        ┌─────────────────────►  │   → Panel administrativo       │
        │   URL exclusiva         │      (Admin.html)              │
        │   para tu clienta        └───────────────┬────────────────┘
        │                                          │
                                                    ▼
                                  ┌──────────────────────────┐
                                  │   Google Sheet             │
                                  │   ├─ Hoja "Citas"          │
                                  │   └─ Hoja "Usuarios"        │
                                  │      (oculta, contraseñas  │
                                  │       con hash)             │
                                  └──────────────────────────┘
                                              │
                                              ▼
                                  ┌──────────────────────────┐
                                  │  Drive: carpeta de         │
                                  │  respaldos semanales .xlsx │
                                  └──────────────────────────┘
```

Piezas del sistema:
1. **Sitio estático** (`index.html`, `css/`, `js/`) — se sube a cualquier hosting (GitHub Pages, hosting compartido, Netlify, etc.). Apps Script **no** hostea esto.
2. **Backend en Google Apps Script** — un mismo proyecto de código, pero publicado como **dos implementaciones (deployments) distintas**, cada una con su propia URL:
   - **Implementación A (pública):** solo responde a la API de citas. Es la URL que usa `config.js`; nadie la visita a mano.
   - **Implementación B (panel):** dedicada exclusivamente a servir el panel administrativo. Es la única URL que se le entrega a tu clienta.

---

## 1. Crear el Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja de cálculo nueva.
2. Ponle un nombre reconocible, por ejemplo: **"C&H Consultorio Dental — Base de Datos"**.
3. No necesitas crear hojas ni columnas manualmente — el script las crea solo la primera vez que corre (tanto la hoja `Citas` como la hoja oculta `Usuarios`).

---

## 2. Crear el proyecto de Apps Script vinculado

1. Dentro de esa misma hoja de cálculo: menú **Extensiones > Apps Script**.
2. Esto abre el editor de Apps Script ya **vinculado** a tu hoja (importante: así `SpreadsheetApp.getActiveSpreadsheet()` en el código encuentra la hoja correcta automáticamente, sin necesidad de IDs).
3. Verás un archivo `Código.gs` por defecto — lo vamos a reemplazar completo en el siguiente paso.

---

## 3. Agregar los archivos de código

### 3.1 — Code.gs

1. Borra el contenido por defecto de `Código.gs` (o renómbralo a `Code.gs` si tu editor lo permite — el nombre exacto no es crítico, pero mantenlo consistente).
2. Pega el contenido completo del `Code.gs` de este proyecto.
3. Guarda con **Ctrl+S**.

Este archivo contiene:
- La **API pública** (`doGet`/`doPost`) que usa el formulario del sitio: crear citas, consultar horarios disponibles.
- Validaciones de seguridad: saneamiento contra inyección de fórmulas, límites de longitud, validación de teléfono, bloqueo de solicitudes duplicadas (anti-spam).
- El **módulo de administración**: autenticación, sesiones, CRUD de citas, historial de pacientes, dashboard de métricas.
- El **módulo de respaldo** semanal a Excel y **exportación a PDF** de citas individuales.
- La lógica que separa la URL pública de la URL del panel (ver paso 8).

### 3.2 — Admin.html

1. Menú **Archivo > Nuevo > Archivo HTML**.
2. Nómbralo exactamente **`Admin`** (sin extensión — Apps Script la agrega sola).
3. Pega el contenido completo del `Admin.html` de este proyecto.
4. Guarda con **Ctrl+S**.

Este archivo es el **frontend** del panel: login, dashboard, tabla de citas, formulario de agenda manual, historial de pacientes. Se comunica con `Code.gs` usando `google.script.run` (no hace peticiones `fetch` normales — es el mecanismo nativo de Apps Script para llamar funciones del servidor desde una página HTML servida por el mismo proyecto).

---

## 4. Cómo ejecutar una función manualmente (lo vas a hacer varias veces)

Varios pasos de esta guía (crear el primer usuario, instalar el respaldo, configurar la URL del panel) piden **correr una función una sola vez desde el editor**. Siempre es el mismo procedimiento:

1. Abre el archivo `Code.gs` en el editor.
2. En la barra superior, junto al botón ▶ **Ejecutar**, hay un menú desplegable con el nombre de una función (por defecto suele decir `doGet` o la última que corriste). Haz clic ahí y **selecciona exactamente la función que te pida cada paso** (por ejemplo `crearPrimerAdmin`).
3. Dale clic a ▶ **Ejecutar**.
4. La **primera vez** que una función necesita un permiso nuevo (acceso a la hoja de cálculo, a Drive, a Documentos, etc.), va a aparecer una ventana emergente pidiendo autorización. En esa ventana:
   - Elige tu cuenta de Google.
   - Si aparece la pantalla "Google no verificó esta app", haz clic en **Avanzado** (Advanced) y luego en **Ir a [nombre de tu proyecto] (no seguro)**. Es tu propio script, es completamente seguro aunque Google muestre esa advertencia por defecto.
   - Dale **Permitir/Allow a todo lo que te pida** — cada función nueva puede requerir permisos distintos (Sheets, Drive, Documentos), así que **acepta todo lo que aparezca en esa pantalla**, sin quitarle marcas a ningún permiso.
5. Cuando termine, revisa la parte inferior del editor: debe decir **"Ejecución completada"**. Puedes ver el detalle en **Ver > Registro** (o Ctrl+Enter).

Ten esto presente para los pasos 5, 6 y 8 de esta guía — cada uno te va a pedir seleccionar una función distinta y correrla así.

---

## 5. Configurar el primer usuario administrador

La hoja `Usuarios` (donde se guardan los accesos al panel) empieza vacía. Hay que sembrar el primer usuario manualmente, una sola vez:

1. Dentro de `Code.gs`, busca la función `crearPrimerAdmin()`.
2. Edita ahí mismo estos tres valores con los datos reales:
   ```javascript
   const nombre = 'Nombre de tu clienta';
   const email = 'correo-real@ejemplo.com';
   const passwordPlano = 'UnaContraseñaTemporal123';
   ```
3. Guarda (Ctrl+S).
4. Selecciona **`crearPrimerAdmin`** en el menú de funciones y ejecútala (ver paso 4 de esta guía si no recuerdas cómo).
5. Acepta todos los permisos que pida la ventana emergente (acceso a la hoja de cálculo).
6. Verifica en el registro de ejecución que diga algo como:
   ```
   Usuario administrador creado: correo-real@ejemplo.com
   ```

**Importante:** esta función está protegida para que solo funcione **una vez** (usa una bandera en `PropertiesService`). Si necesitas corregir un dato después (como pasó con el correo mal escrito), no la vuelvas a ejecutar — edita directamente la fila en la hoja `Usuarios` (ver sección de Mantenimiento más abajo).

---

## 6. Instalar el respaldo automático semanal

1. Selecciona **`instalarTriggerRespaldoSemanal`** en el menú de funciones y ejecútala.
2. Esto pedirá autorización adicional para **Drive y Documentos** (el respaldo genera un Excel en Drive, y el comprobante de citas genera un PDF vía Documentos). En la ventana emergente, **acepta/permite todos los permisos que aparezcan** — son los que necesitan estas dos funciones para trabajar.
3. Esto programa un disparador (**trigger**) que corre automáticamente **cada lunes alrededor de las 2:00 AM**, sin que nadie tenga que entrar manualmente.
4. Puedes verificar que quedó instalado en el menú lateral del editor: el ícono de reloj (⏰) **Disparadores** — deberías ver `backupCitasSemanal` programado semanalmente.

---

## 7. Publicar (Deploy) la implementación pública

1. Botón **Implementar** (arriba a la derecha) > **Nueva implementación**.
2. Tipo de implementación: **Aplicación web**.
3. Configuración recomendada:
   - **Ejecutar como:** Yo (tu cuenta, la dueña del proyecto) — así la API pública funciona para cualquier visitante sin pedirle permisos a él.
   - **Quién tiene acceso:** Cualquier usuario (Anyone) — necesario para que el formulario público funcione sin que el visitante inicie sesión.
4. Dale **Implementar**. Google te dará una **URL de Web App**:
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXXXX/exec
   ```
5. Esta es la **URL pública** — la usará únicamente el archivo `config.js` del sitio (paso 9). Nadie más debe conocerla ni visitarla directamente.

---

## 8. Separar la URL pública de la URL del panel administrativo

Por defecto, un mismo proyecto de Apps Script solo tiene una URL. Para que la URL del panel sea completamente distinta a la pública (y que nadie llegue a la pantalla de login del panel solo por conocer la URL pública), se crea una **segunda implementación** dedicada exclusivamente al panel.

1. **Crea la segunda implementación:** Implementar > Nueva implementación > tipo "Aplicación web".
   - **Ejecutar como:** Yo (igual que la pública).
   - **Quién tiene acceso:** **Cualquier usuario con cuenta de Google** (no "Cualquiera") — esto agrega una barrera extra de Google *antes* de que alguien llegue siquiera a la pantalla de login del panel.
   - Dale **Implementar**. Te va a dar una **URL nueva y distinta** a la pública — esta es la URL del panel.
2. **Guarda esa URL dentro del script:** en `Code.gs`, busca la función `configurarUrlAdmin()`, pega ahí la URL nueva donde dice `'PEGA_AQUI_TU_URL'`, guarda, selecciónala en el menú de funciones y ejecútala una vez (ver paso 4 de esta guía). Revisa el registro para confirmar el mensaje de éxito.
3. **Vuelve a implementar AMBAS implementaciones:** Implementar > Administrar implementaciones. Vas a ver las dos (pública y panel). Para **cada una**, dale al ícono de lápiz > **Nueva versión** > Implementar. Este paso es obligatorio — si no lo haces, la implementación pública sigue corriendo el código viejo, que sí dejaba pasar `?page=admin`.
4. **Verifica que quedó bien separado:**
   - Entra a la URL **pública** agregándole `?page=admin` al final → debe salir la respuesta normal de la API (JSON), **no** el panel.
   - Entra a la URL del **panel**, sin agregarle nada → debe cargar directo la pantalla de login.

A partir de aquí, la URL del panel es la única que le compartes a tu clienta (por WhatsApp o correo, una sola vez) — sugiérele guardarla como marcador o agregarla a la pantalla de inicio de su celular.

---

## 9. Conectar el sitio público con el backend

En el archivo `js/config.js` del sitio estático, pega la URL **pública** (la del paso 7, no la del panel) en:

```javascript
API_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXXX/exec',
```

El archivo `js/api.js` ya está armado para usar esa constante en todas las llamadas (`getCitas`, `crearCita`, `getHorariosDisponibles`), así que no hay que tocar nada más ahí.

---

## 10. Subir el sitio estático a hosting

El backend vive en Google, pero `index.html`, `css/` y `js/` son un sitio estático normal — necesitas subirlo a algún hosting (fuera de Apps Script). Algunas opciones típicas:
- GitHub Pages (gratis, bueno para sitios sencillos).
- Un hosting compartido tradicional (cPanel, etc.) si el cliente ya tiene dominio y hosting contratado.
- Netlify o Vercel (gratis, despliegue rápido arrastrando la carpeta).

No hay una preferencia técnica obligatoria aquí — cualquier hosting que sirva archivos estáticos funciona, ya que todo el JS hace peticiones a la URL de Apps Script vía `fetch`.

---

## 11. Verificación final (checklist)

- [ ] El formulario público (`index.html`) carga sucursales, servicios y horarios correctamente.
- [ ] Al agendar una cita de prueba, aparece una nueva fila en la hoja `Citas`.
- [ ] La URL **pública** + `?page=admin` NO muestra el panel (solo la respuesta normal de la API).
- [ ] La URL del **panel** carga directo la pantalla de login, sin necesitar `?page=admin`.
- [ ] Puedes iniciar sesión con el usuario creado en el paso 5.
- [ ] El Dashboard muestra números reales (no en cero, si ya hay citas de prueba).
- [ ] Puedes cambiar el estatus de una cita desde la pestaña Citas.
- [ ] Puedes agendar una cita manualmente desde la pestaña Agendar.
- [ ] El botón de PDF descarga un comprobante de una cita.
- [ ] El botón "Generar respaldo ahora" descarga un `.xlsx` Y crea el archivo en la carpeta de Drive "Respaldos CRM - Citas Dental".

---

## 12. Seguridad implementada (resumen)

| Mecanismo | Dónde | Qué evita |
|---|---|---|
| Dos implementaciones separadas (pública / panel) | `doGet()`, `configurarUrlAdmin()` | Que alguien llegue a la pantalla de login del panel solo por conocer la URL pública |
| Acceso restringido a "cuenta de Google" en la implementación del panel | Configuración del deployment B | Barrera de Google antes de siquiera cargar la pantalla de login |
| Saneamiento de campos (antepone `'` a valores que empiezan con `=`, `+`, `-`, `@`) | `sanitizeForSheet()` en Code.gs | Inyección de fórmulas al abrir la hoja en Excel/Sheets |
| Límites de longitud por campo | `FIELD_LIMITS` en Code.gs | Abuso de envío de texto masivo desde el formulario público |
| Validación de teléfono (10–15 dígitos) | `isValidPhone()` | Datos basura en la base |
| Bloqueo de solicitudes duplicadas (5 min) | `hasRecentDuplicateRequest()` | Spam / doble envío accidental |
| Honeypot invisible en el formulario | `index.html` / `scripts.js` | Bots simples que llenan todos los campos |
| Contraseñas con hash SHA-256 + salt individual | Hoja `Usuarios` (oculta) | Exposición de contraseñas en texto plano |
| Tokens de sesión temporales (6 h) vía `CacheService` | `validateToken_()` | Acceso sin sesión válida a las funciones del panel |
| Todas las funciones admin validan el token primero | `adminGetCitas`, `adminUpdateEstado`, etc. | Que alguien llame funciones del servidor desde la consola del navegador sin estar logueado |
| Hoja `Usuarios` oculta y excluida de los respaldos | `getUsersSheet_()`, `backupCitasSemanal()` | Que un respaldo compartido exponga contraseñas (aunque estén hasheadas) |
| Creación de nuevos usuarios admin requiere sesión de un admin existente | `crearUsuarioAdmin()` | Que cualquier visitante se cree una cuenta de administrador |

**Limitación conocida:** el inicio de sesión automático con cuenta de Google (`checkGoogleSession`) solo funciona de forma confiable si el despliegue se publica como "Ejecutar como: Usuario que accede" — lo cual típicamente requiere que quien entra tenga una cuenta de Google Workspace (no Gmail personal) o acceso directo al Sheet. Por eso el **login con correo y contraseña es el mecanismo principal**, y Google queda como acceso rápido opcional para más adelante.

---

## 13. Mantenimiento y tareas comunes

### Agregar o quitar una sucursal / servicio
Hay que actualizarlo en **dos lugares** (son entornos distintos, no se sincronizan solos):
1. `js/config.js` (sitio público) → arreglo `locations` o `services`.
2. `Code.gs` (backend) → constantes `SUCURSALES` y `SERVICIOS`, cerca del inicio del archivo.

Después de editar `Code.gs`, hay que volver a implementar **ambas** implementaciones (Nueva versión).

### Crear otro usuario administrador
Ya no se usa `crearPrimerAdmin` (solo corre una vez). En su lugar, esto se haría desde el panel llamando a `crearUsuarioAdmin(token, nombre, email, password, rol)` — actualmente no hay un botón en la interfaz para esto todavía; si se necesita, es una mejora futura sencilla de agregar a `Admin.html`.

### Cambiar una contraseña
Por ahora no hay pantalla de "cambiar contraseña" en el panel. La forma más directa es editar el hash desde cero:
1. Abre la hoja `Usuarios` (mostrar hoja oculta: ícono de lista junto a las pestañas de hojas).
2. Es más simple pedirle a un admin logueado que corra `crearUsuarioAdmin` con el mismo correo y la nueva contraseña (esto actualiza la fila existente en vez de crear una nueva).

### Ver o administrar los respaldos
Carpeta de Drive: **"Respaldos CRM - Citas Dental"**. Se crea sola la primera vez que se genera un respaldo. Se conservan automáticamente los últimos 12 (~3 meses); los más antiguos se eliminan solos.

### Después de cualquier cambio en Code.gs o Admin.html
Siempre: **Implementar > Administrar implementaciones > lápiz > Nueva versión > Implementar**, para **cada** implementación que exista (pública y panel). Si no haces esto, los cambios quedan guardados en el editor pero las URLs siguen sirviendo la versión anterior.

---

## 14. Solución de problemas comunes

**"No tienes permiso para llamar a DriveApp / DocumentApp..."**
Significa que el proyecto necesita autorizar un permiso nuevo (agregado por una función que no existía antes). Ejecuta manualmente desde el editor la función que use ese servicio (ver paso 4 de esta guía), acepta todos los permisos en la ventana emergente, y vuelve a intentarlo desde el panel.

**El panel carga pero no puedo iniciar sesión con nada**
Revisa que `crearPrimerAdmin` sí haya corrido exitosamente (registro de ejecución) y que el correo esté escrito correctamente en la hoja `Usuarios`.

**La URL pública + `?page=admin` sigue mostrando el panel**
Te faltó el paso 8.3: volver a implementar (Nueva versión) la implementación **pública** después de agregar la verificación por URL. El código viejo no tiene esa protección.

**Hice cambios y no se reflejan en el sitio**
Casi siempre es que falta el paso de "Nueva versión" en Implementar — y si tienes dos implementaciones, revisa que lo hiciste en la que corresponde (o en ambas, si el cambio afecta a las dos).

**El formulario público da error de CORS**
Verifica que `API_URL` en `config.js` sea exactamente la URL `/exec` (no `/dev`) de la implementación pública, y que ese despliegue tenga "Quién tiene acceso: Cualquier usuario".

**Las citas no se filtran bien por sucursal en el panel**
Revisa que el nombre de la sucursal en `Code.gs` (`SUCURSALES`) sea *idéntico*, letra por letra, al de `config.js` — la comparación en varias funciones es sensible a que los textos coincidan.

---

*Documento generado para el proyecto de C&H Consultorio Dental — última actualización de la configuración incluye: formulario en wizard de 3 pasos, panel administrativo completo (dashboard, citas, agenda manual, pacientes), exportación de citas a PDF, respaldo semanal automático a Excel, y separación de URL pública / URL del panel en dos implementaciones distintas.*