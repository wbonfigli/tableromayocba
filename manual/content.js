/**
 * content.js — Manual Sistema Mayo
 * -----------------------------------------------------------------
 * Cada módulo tiene: id, categoria, nombre, estado (activo|parcial|pendiente),
 * resumen (una línea para la tarjeta del home), tecnico y operativo.
 *
 * "pendiente: true" en tecnico/operativo significa que ese lado del
 * módulo todavía no tiene información confirmada — se muestra un
 * aviso en vez de inventar procedimientos. Para completarlo, pasarle
 * a Claude el código real (Código.gs + Index.html) del módulo, igual
 * que se hizo con RG-CA-03 y NC.
 *
 * Última revisión: 12/08/2026.
 */

const CONTENIDO = {
  categorias: [
    "Infraestructura y Seguridad",
    "Referencia de Datos",
    "Ejecución en Planta",
    "Calidad",
    "RRHH",
    "Planificación y Logística",
    "Pendientes de Documentar"
  ],

  modulos: [
    // =================================================================
    // INFRAESTRUCTURA Y SEGURIDAD
    // =================================================================
    {
      id: "authlib",
      categoria: "Infraestructura y Seguridad",
      nombre: "AuthLib — Autenticación y Permisos",
      estado: "activo",
      resumen: "La librería de login y permisos que comparten los 6 proyectos del sistema. Tocarla mal rompe todo a la vez.",
      tecnico: {
        intro: "Proyecto de Apps Script <b>independiente</b>, vinculado como librería (nombre <code>AuthLib</code>) en Cubas, TIEMPOS, F-CA-26, RG-CA-02, RG-CA-03 y Gestión de NC. Además tiene su propio deployment como Web App, que expone acciones vía JSONP (<code>?accion=login&callback=...</code>) para el login del Tablero general — dos formas de usar el mismo código: como librería (dentro de cada proyecto) y como servicio HTTP propio (para el hub, que es HTML estático sin backend).",
        bloques: [
          {
            titulo: "Base de datos (planilla Control_de_Accesos)",
            texto: "ID configurado en <code>CONFIG.ID_PLANILLA</code>. Cuatro hojas: <b>Usuarios</b>, <b>Modulos</b>, <b>Accesos</b>, <b>Sesiones</b> — más una quinta, <b>Perfiles</b>, para permisos por sección dentro de un módulo (formato largo: Perfil | Modulo | Seccion | Nivel)."
          },
          {
            titulo: "Contraseñas — nunca en texto plano",
            texto: "Cada password se guarda como <code>salt$hash</code> en una sola celda (columna E de Usuarios). El hash es SHA-256 de <code>salt + \"::\" + password</code>. <code>_verificarPassword()</code> separa el salt guardado, recalcula, y compara. Un usuario nuevo empieza con la columna E vacía — no tiene contraseña hasta que use \"Olvidé mi contraseña\", que en este caso actúa como alta inicial (mismo flujo para primera vez y para reset)."
          },
          {
            titulo: "login(email, password)",
            texto: "Valida usuario activo (columna D = \"SI\") y contraseña. Si es correcto, genera un token (<code>Utilities.getUuid()</code>), lo guarda en Sesiones con expiración a <code>CONFIG.MINUTOS_DURACION_SESION</code> (480 min = 8 horas), y devuelve <code>{status, token, email, nombre, rol, expira}</code>."
          },
          {
            titulo: "Niveles de acceso: lectura / edicion / admin",
            texto: "Jerarquía numérica (<code>NIVELES_ORDEN</code>: lectura=1, edición=2, admin=3). La columna Nivel de Accesos puede tener directamente uno de esos tres valores, o el <b>alias de un perfil</b> (ej. \"rrhh\", \"calidad\") que se resuelve después contra la hoja Perfiles para saber el nivel real en cada sección. Retrocompatibilidad: si Permitido=SI pero la celda Nivel está vacía (filas viejas, de antes de que existiera esta columna), se asume <code>lectura</code> — nunca más que eso por seguridad."
          },
          {
            titulo: "validarAccion(token, moduloKey, nivelMinimo)",
            texto: "La función que <b>cierra la puerta de verdad</b> — se llama al principio de cada función de escritura del lado servidor (nunca confiar en que el botón esté oculto en pantalla). Valida sesión + nivel mínimo en un solo paso."
          },
          {
            titulo: "validarAccionSeccion(token, moduloKey, seccion, nivelMinimo)",
            texto: "Variante para permisos más finos dentro de un mismo módulo (usada por RRHH). Un nivel <code>oculto</code> en Perfiles nunca alcanza ningún mínimo — ni siquiera lectura."
          },
          {
            titulo: "Recuperación de contraseña / alta inicial",
            texto: "<code>generarTokenRecuperacion(email)</code> genera un código de 6 dígitos (vence en 30 min), lo guarda en Usuarios (columnas F/G) y lo manda por <code>MailApp</code>. <code>resetearContrasenaConToken(email, token, passwordNueva)</code> lo valida y llama a <code>fijarContrasena()</code>. Por seguridad, si el email no existe el mensaje es igual de genérico (\"si está registrado, vas a recibir un correo\") — no revela qué emails están dados de alta."
          },
          {
            titulo: "WebApp.gs — router HTTP/JSONP",
            texto: "Archivo aparte dentro del mismo proyecto AuthLib (no reemplaza a la librería, la complementa). Tiene su <b>propio deployment como Web App</b> (\"Ejecutar como: yo\", \"Cualquier usuario\"), con una URL <code>/exec</code> distinta del ID de biblioteca. El Hub (HTML estático en GitHub Pages, sin backend propio) lo llama vía JSONP — mismo truco que usa el botón de KPIs en Cubas: <code>&lt;script src=\"...&callback=nombreFn\"&gt;</code>, para esquivar problemas de CORS con Apps Script."
          },
          {
            titulo: "Acciones disponibles en WebApp.gs",
            tabla: [
              ["login", "email, password", "Devuelve token + nombre + rol + <code>modulos</code> (array de ModuloKeys permitidos), para armar el Hub dinámicamente"],
              ["modulosPermitidos", "token", "Valida sesión y devuelve la misma lista de módulos permitidos, sin volver a loguear — se puede llamar desde cualquier pantalla que ya tenga un token válido"],
              ["solicitarToken", "email", "Alta inicial / \"Olvidé mi contraseña\" — genera y manda el código de 6 dígitos"],
              ["resetPassword", "email, token, password", "Confirma el código y fija la contraseña"],
              ["logout", "token", "Cierra la sesión"]
            ]
          },
          {
            titulo: "Rol informativo vs. permiso real",
            texto: "La columna Rol de Usuarios (validada con lista fija: admin, rrhh, calidad, produccion, gerencia, oficina, operario, panol) es <b>solo informativa</b> — el control de acceso real siempre pasa por la hoja Accesos, nunca por este campo. Está explícitamente anotado así en la celda C2 de Usuarios."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Dar de alta un usuario nuevo", texto: "Agregar una fila en la hoja Usuarios (Email, Nombre, Rol, Activo=SI), sin tocar la columna de contraseña — queda vacía a propósito." },
          { titulo: "El usuario fija su contraseña", texto: "Usa \"Olvidé mi contraseña\" en el login del Tablero con su email — le llega un código de 6 dígitos por correo, con el que fija su contraseña por primera vez." },
          { titulo: "Dar permisos de módulo", texto: "Agregar una fila en la hoja Accesos: Email, ModuloKey (ej. \"controles-calidad\", \"nc\", \"rrhh-presentismo\"), Permitido=SI, y el Nivel (lectura / edicion / admin, o el alias de un perfil si ese módulo usa permisos por sección)." },
          { titulo: "Sacar o bajar un permiso", texto: "Cambiar Permitido a NO, o borrar la fila. No hace falta tocar código en ningún proyecto." },
          { titulo: "Desactivar un usuario", texto: "Cambiar la columna Activo a NO en Usuarios — bloquea el login inmediatamente, sin borrar su historial." }
        ]
      }
    },


    // =================================================================
    // REFERENCIA DE DATOS
    // =================================================================
    {
      id: "tareas-2026",
      categoria: "Referencia de Datos",
      nombre: "TAREAS 2026",
      estado: "activo",
      resumen: "La planilla que atraviesa casi todo el sistema — OT, OC, Modelo, Cod. Tarea.",
      tecnico: {
        intro: "No es una 'app' con interfaz propia — es la base de datos central que consultan y escriben Tablero de Producción, RG-CA-03, Carga de Tiempos y el dashboard/KPIs del hub. Entender su estructura es la base para entender casi todo lo demás.",
        bloques: [
          {
            titulo: "Identificación",
            texto: "ID de spreadsheet: <code>1HFBUjxS_fwq8yqrMs0ImobyK2uo-SEaTvAAQgwCJK4o</code>. Es un archivo Drive propio, separado de la planilla TIEMPOS (<code>1uzR_76G7d-rA_ExzPq_l6Rgcfq3fnCInoe0ziNZMrw8</code>) — son dos archivos distintos, aunque comparten conceptos (OT, Cod. Tarea)."
          },
          {
            titulo: "Estructura de columnas",
            tabla: [
              ["A", "OC", "Nº de orden de compra"],
              ["B", "Cant", "Cantidad de cubas del pedido"],
              ["C", "Modelo Cuba", "Modelo a fabricar"],
              ["D", "Cod Tarea", "Código de la operación (rango 5001–5905, varía por modelo)"],
              ["E", "Tarea", "Descripción de la operación"],
              ["F", "Material a utilizar", "Detalle de insumos para esa tarea"],
              ["G–I", "(sin header)", "3 columnas vacías — no tocar, no eliminar"],
              ["J", "Tiempo unit", "Tiempo estándar unitario"],
              ["K", "Tiempo total", "Tiempo estándar total"],
              ["L", "Operario", "Quién ejecutó la tarea (histórico)"],
              ["M", "TIME STAMP", "Fecha/hora de carga"],
              ["N", "OT", "Nº de Orden de Trabajo — solo se escribe en la <b>primera fila del bloque</b>"],
              ["O", "Nº de Cuba", "Nº de serie o rango (ej. \"110494 A 110495\", o varios con \"Y\") — también solo en la primera fila del bloque"],
              ["P", "Completado", "\"X\" cuando la tarea está terminada"],
              ["Q", "Tiempo", "Marca de control de tiempo tomado"],
              ["R", "Calidad", "Marca de control de calidad realizado"],
              ["S", "Procedimiento", "Usado por RG-CA-03: acá quedan los Nº de Serie controlados (separados por coma)"],
              ["T", "En Proceso", "Agregada para el Tablero de Producción: orden dada a planta, aún sin completar"],
              ["U", "Fecha de Proceso", ""],
              ["V", "Operario asignando", "Operario asignado a la tarea — RG-CA-03 lo usa para precargar el control"],
              ["W", "Baja", ""]
            ]
          },
          {
            titulo: "El concepto de \"bloque\"",
            texto: "Una misma OT agrupa varias tareas (varias filas). El Nº de OT y el Nº de Cuba <b>solo se escriben en la primera fila del bloque</b> — las filas siguientes de esa misma OT dejan esas columnas en blanco. Cualquier función que busque por OT tiene que \"caminar\" el bloque hacia abajo hasta encontrar la próxima fila con OT no vacía, no buscar coincidencia exacta fila por fila (este fue un bug real detectado y corregido en RG-CA-03 — ver esa página)."
          },
          {
            titulo: "Formato del Nº de Cuba (columna O)",
            texto: "Puede ser: un valor único (<code>110284</code>), un rango (<code>110494 A 110495</code>), o varios rangos/valores combinados con \"Y\" (<code>111321 A 111334 Y 111435 A 111440</code>). El separador de rango es siempre <code>\" A \"</code> (con espacios, mayúscula) y el separador entre segmentos es siempre <code>\" Y \"</code>. Este dato es el que corrobora RG-CA-03 contra la planilla Cubas para saber cuáles números de serie pertenecen a esa tanda puntual."
          }
        ]
      },
      operativo: { pendiente: true, nota: "Esta planilla se edita indirectamente desde otros módulos (Generación de OTs, Carga de Tiempos, RG-CA-03) — no tiene una interfaz de carga manual propia documentada." }
    },

    {
      id: "tiempos-operarios",
      categoria: "Referencia de Datos",
      nombre: "TIEMPOS + OPERARIOS",
      estado: "activo",
      resumen: "Base de datos de fichadas por tarea y padrón de operarios de planta.",
      tecnico: {
        intro: "Spreadsheet ID <code>1uzR_76G7d-rA_ExzPq_l6Rgcfq3fnCInoe0ziNZMrw8</code>, título \"TIEMPOS\". Dos hojas: TIEMPOS (fichadas) y OPERARIOS (padrón, sincronizado desde RRHH — Legajos).",
        bloques: [
          {
            titulo: "Hoja TIEMPOS",
            tabla: [
              ["A", "Modelo", ""],
              ["B", "Código de tareas", "Cod. Tarea"],
              ["C", "Cantidad", ""],
              ["D", "Operario", "Formato <code>legajo - Apellido, Nombre</code>"],
              ["E", "OT", ""],
              ["F", "Etapa", "Número de etapa dentro de la tarea (para tareas multi-etapa)"],
              ["G", "Fecha inicio", ""],
              ["H / I", "Inicio hora / minutos", "24h"],
              ["J / K", "Fin hora / minutos", "24h"],
              ["L", "Tiempo parada", "Minutos"],
              ["M", "Observaciones", ""]
            ]
          },
          {
            titulo: "Filas separadoras",
            texto: "Cada tarea puede ocupar varias filas (una por etapa/jornada), cerrada con una <b>fila separadora marcada con \"x\"</b> en la columna D (Operario). El backend de Carga de Tiempos usa esa \"x\" para saber dónde termina un bloque y recalcular O:V (Parcial, Total, Unitario, Standard, Diferencia, Desviación) — función <code>recalcularBloqueDesdeFila()</code>, en la librería TIEMPOSLib."
          },
          {
            titulo: "Hoja OPERARIOS (columnas B–E)",
            texto: "Auto-sincronizada desde RRHH — Legajos vía <code>sincronizarOperariosActivos_()</code>, que escribe <b>solo</b> las columnas B–E. La columna A es usada por una aplicación de unificación de nombres aparte y nunca debe tocarse desde otro módulo."
          }
        ]
      },
      operativo: { pendiente: true, nota: "Esta planilla se alimenta desde Carga de Tiempos y desde RRHH — no tiene carga manual directa." }
    },

    // =================================================================
    // EJECUCIÓN EN PLANTA
    // =================================================================
    {
      id: "carga-tiempos",
      categoria: "Ejecución en Planta",
      nombre: "Carga de Tiempos",
      estado: "activo",
      resumen: "Fichado en piso: soldadura, pintura, armado — un operario carga inicio/fin por etapa.",
      tecnico: {
        intro: "Deployment de Apps Script independiente (no pasa por el router <code>?v=</code> del hub principal). Permiso AuthLib: <code>\"carga-tiempos\"</code>. URL de deploy: <code>AKfycbzPjSuqeHEKWWM9Bma55GwzvkVlENhJ3MFki_XzFIHh4v4qm8PlOjJt40GJszuAcOQEag/exec</code>.",
        bloques: [
          {
            titulo: "Función clave: buscarDatosOT(otBuscada)",
            texto: "Busca la OT en TAREAS (con cache de 6h del ID de spreadsheet por año — soporta 2023 a 2026), usando <code>Range.createTextFinder()</code> en vez de <code>getValues()</code>+loop (regla de rendimiento del sistema para hojas grandes). Camina el bloque de filas (ver página TAREAS 2026) y cruza cada tarea contra TIEMPOS para determinar su estado: <code>NUEVO</code>, <code>P</code> (parcial abierto), <code>CONTINUAR_ETAPA</code>, o <code>X</code> (cerrado)."
          },
          {
            titulo: "OT en blanco / reparación",
            texto: "Si una fila de TAREAS no tiene Cod. Tarea (fila en blanco), se marca <code>esReparacion: true</code> y el formulario pide completar Modelo, Cód. Tarea, Cantidad y <b>Nº de Serie de Cuba</b> a mano — ese dato se escribe en TAREAS, columna \"Nº de Cuba\", exclusivamente cuando es reparación."
          },
          {
            titulo: "Función clave: registrarFila(datos)",
            texto: "Escribe la fila en TIEMPOS (o inserta en medio del bloque si hay que continuar una etapa). Al cerrar la última etapa (agrega fila separadora \"x\"), llama <b>siempre</b> a <code>recalcularBloqueDesdeFila(filaCierreX)</code> — este paso es obligatorio en los 3 puntos de cierre de tarea del código; si se omite, las columnas O:V quedan sin calcular (bug histórico ya corregido)."
          },
          {
            titulo: "Vínculo con TAREAS",
            texto: "Al cerrar una tarea, marca \"X\" en la columna Completado de TAREAS. Si era reparación, además vuelca Modelo/Cód.Tarea/Cantidad/Nº de Cuba en la fila física de TAREAS correspondiente."
          },
          {
            titulo: "Regla de oro del sistema",
            texto: "<b>Nunca</b> reconstruir <code>registrarFila</code> ni <code>buscarDatosOT</code> de memoria — pedir siempre el código real pegado en el mismo mensaje antes de modificarlas. Precedente: se reconstruyó una vez sin el llamado a <code>recalcularBloqueDesdeFila()</code> y rompió las columnas O:V."
          },
          {
            titulo: "Seguridad — ahora a la par de Cubas (token + nivel + candado real)",
            texto: "El <code>doGet</code> ahora inyecta <code>token</code> y <code>nivel</code> (<code>AuthLib.obtenerNivel(email, \"carga-tiempos\") || 'lectura'</code>) directamente en el HTML generado, interpolándolos en el propio template literal de <code>generarInterfaz(token, nivel)</code> — como el HTML de este módulo se arma como string de JS server-side (no con <code>createTemplateFromFile</code>), no hace falta la sintaxis <code>&lt;?= ?&gt;</code>/<code>&lt;?!= ?&gt;</code> de Apps Script ni sus problemas de escapado; se interpola directo con <code>${'{'}variable{'}'}</code>. <b>Candado real del lado del servidor</b>: <code>registrarFila</code> ahora empieza con <code>AuthLib.validarAccion(datos.token, \"carga-tiempos\", \"edicion\")</code> — si el nivel no alcanza, corta antes de tocar la planilla, igual que en Cubas. Antes de esto, el bloqueo de \"solo lectura\" era únicamente del lado del cliente (un simple <code>alert()</code>) y no protegía nada real."
          },
          {
            titulo: "Bug corregido — mensaje de éxito falso ante error",
            texto: "El cliente distinguía solo dos casos en la respuesta de <code>registrarFila</code>: contiene \"SIGUIENTE\" (sigue a la próxima etapa) o cualquier otra cosa (mostraba \"✅ FINALIZADA CON ÉXITO\"). Como <code>registrarFila</code> ya devolvía <code>\"ERROR: \" + e.message</code> desde su <code>catch</code> original (y ahora también desde el candado nuevo), un error cualquiera —de permisos o de otro tipo— caía en el <code>else</code> y el usuario veía la pantalla de éxito en vez del error real. Se agregó un chequeo explícito de <code>res.indexOf(\"ERROR\") === 0</code> antes de esa rama, más un <code>withFailureHandler</code> que faltaba (si se corta la conexión, el botón se reactiva con un aviso en vez de quedar trabado en \"Guardando...\" para siempre)."
          },
          {
            titulo: "Botón Manual",
            texto: "Agregado en el header, con el link armado del lado servidor (<code>urlManual</code> interpolado igual que token/nivel) — abre <code>manual/?token=...</code>, con auto-desbloqueo de Técnico si esa sesión tiene el módulo <code>manual-tecnico</code> habilitado en Accesos."
          },
          {
            titulo: "TIEMPOSLib — biblioteca compartida (mismo patrón que AuthLib)",
            texto: "Proyecto de Apps Script <b>independiente</b>, vinculado como librería (identificador <code>TIEMPOSLib</code>) en el proyecto \"Carga de Tiempos\" y potencialmente en otros. Vive en el archivo <code>RecalculoTiempos_v2.gs</code>. Expone: <code>recalcularTiempos()</code>, <code>recalcularBloqueDesdeFila(filaCierreX)</code>, <code>construirMapaConsolidado_()</code>, <code>aplicarFormatoDesviacion_(hoja)</code>."
          },
          {
            titulo: "Columnas O:V — qué calcula cada una",
            tabla: [
              ["O", "PARCIAL", "fin − inicio − TDESC (col. N) − tiempo parada"],
              ["P", "TOTAL", "acumulado de PARCIAL dentro de la misma tarea (se resetea en etapa 1)"],
              ["Q", "TIEMPO UNITARIO", "TOTAL / CANTIDAD — solo se calcula en la última etapa de la tarea"],
              ["R", "TIEMPO STANDARD", "lookup contra la hoja \"Consolidado\" por clave Modelo+CódTarea concatenados"],
              ["S", "DIFERENCIA", "TIEMPO UNITARIO − TIEMPO STANDARD"],
              ["T", "DIFERENCIA TOTAL", "DIFERENCIA × CANTIDAD"],
              ["U", "DESVIACIÓN %", "(TIEMPO UNITARIO / TIEMPO STANDARD) − 1"],
              ["V", "AÑO", "año de la Fecha Inicio"]
            ]
          },
          {
            titulo: "construirMapaConsolidado_() — de dónde sale el Tiempo Estándar",
            texto: "Lee la hoja \"Consolidado\" de la planilla <code>1Lxm3W4-DomhcS-P9uEmGxuEJ07hYTaxml3Kx79Gljbw</code> (ID_CONSOLIDADO) y arma un mapa en memoria <code>{Modelo+CódTarea: tiempoEstándar}</code> — reemplaza lo que antes eran 7 fórmulas LOOKUP distintas contra un Excel externo (ya no hace falta distinguir por familia, el código combinado ya es único). Se cachea 6 horas en trozos (mismo patrón <code>cachePutChunked_</code>/<code>cacheGetChunked_</code> que ya vimos en el Tablero de Producción)."
          },
          {
            titulo: "recalcularTiempos() — recálculo de la hoja completa",
            texto: "Recorre TIEMPOS de punta a punta, fila por fila, acumulando PARCIAL dentro de cada bloque de tarea (identifica el cierre de bloque mirando si la fila siguiente es separadora \"x\" o el final de la hoja). Se usa para control general o después de correcciones dispersas — es la opción \"pesada\", <code>recalcularBloqueDesdeFila()</code> es la liviana para un cierre puntual."
          },
          {
            titulo: "aplicarFormatoDesviacion_(hoja) — semáforo real",
            texto: "Formatea la columna U como porcentaje y aplica 3 reglas de formato condicional sobre un rango fijo (fila 2 a 100.000, para no tener que reaplicar nunca más): <b>verde</b> si Desviación &lt; −5% (terminó por debajo del estándar), <b>amarillo</b> si está entre −5% y 5% inclusive (dentro de tolerancia), <b>rojo</b> si es mayor a 5% (por encima del estándar). También fija la columna Q (Tiempo Unitario) con un decimal fijo."
          },
          {
            titulo: "Menú manual (MenuManualTiempos.gs)",
            texto: "Agrega un menú \"Tiempos\" en la hoja de cálculo con dos opciones: <b>\"Recalcular TODA la hoja\"</b> (llama a <code>TIEMPOSLib.recalcularTiempos()</code>) y <b>\"Recalcular solo la tarea de la celda seleccionada\"</b> — busca hacia abajo desde la celda activa la fila de cierre \"x\" más cercana y llama a <code>TIEMPOSLib.recalcularBloqueDesdeFila()</code> solo para ese bloque."
          },
          {
            titulo: "Trigger automático onEdit (OnEditTiempos.gs)",
            texto: "Función <code>alEditarTiempos(e)</code>, trigger simple (se activa solo por el nombre, no hace falta instalarlo a mano). Si alguien corrige manualmente una celda en columnas A:N de TIEMPOS, busca la fila de cierre de esa tarea y recalcula automáticamente ese bloque. <b>Se auto-desactiva para pegados masivos</b>: si el rango editado supera 25 filas, no hace nada y deja el log \"usar menú manual\" — para evitar timeouts al pegar cientos de filas de una vez."
          },
          {
            titulo: "Por qué el menú y el trigger NO necesitan el candado de AuthLib",
            texto: "El menú de Sheets, el trigger <code>onEdit</code> y el script de normalización corren en un contexto de seguridad completamente distinto al de la Web App: no hay sesión web ni token de por medio, se disparan porque quien los usa ya tiene permiso de <b>edición nativo de Google Sheets</b> sobre la planilla. Pedirles un token sería no solo redundante sino imposible — un click en un menú de Sheets no tiene ningún token que pasar. El único punto de entrada real desde la web, con un origen potencialmente no confiable del otro lado, es <code>registrarFila</code> — por eso es la única función de este módulo que necesita <code>AuthLib.validarAccion()</code>."
          },
          {
            titulo: "Herramienta de mantenimiento: normalización de operarios",
            texto: "Script aparte (no forma parte del uso diario) para unificar el campo Operario al formato <code>\"legajo - Apellido, Nombre\"</code> en TIEMPOS y en el histórico 2024-2025, cruzando contra RRHH — Legajos como fuente maestra. Resuelve por apellido normalizado (sin tildes, sin comas sueltas) y, si hay más de un candidato con el mismo apellido, intenta desambiguar por la primera palabra del nombre. Corre siempre primero en modo <b>DRY RUN</b> (solo genera una hoja de log <code>Migracion_Operarios_Log</code> con el resultado propuesto para cada fila — OK / AMBIGUO / SIN_MATCH — sin escribir nada), y recién con una segunda función <code>EJECUTAR_..._APLICAR()</code> se vuelca lo resuelto como \"OK\" a la hoja real. Los casos AMBIGUO o SIN_MATCH quedan para revisión manual, nunca se aplican solos."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Ingresar la OT", texto: "Escribir el N° de OT y confirmar. Si tiene varias tareas pendientes, aparece una tabla para elegir cuál cargar." },
          { titulo: "Si ves el aviso \"Modo solo lectura\"", texto: "Podés buscar y ver datos, pero el botón Guardar está bloqueado — significa que tu nivel de acceso en Accesos no llega a \"edición\" para este módulo. Pedile a un administrador que lo revise." },
          { titulo: "Completar Modelo, Cód. Tarea, Cantidad y Operario", texto: "Se autocompletan si la OT existe en TAREAS. El Operario se elige de una lista (viene de RRHH — Legajos, solo activos)." },
          { titulo: "Cargar horarios", texto: "Fecha, hora y minutos de inicio y fin. Si la tarea tiene más de una etapa, marcar cuántas etapas totales tiene." },
          { titulo: "Marcar Parcial si no se termina hoy", texto: "El checkbox \"Guardar como PARCIAL\" deja la tarea abierta para continuar otro día, sin cerrar el bloque." },
          { titulo: "Guardar", texto: "Al cerrar la última etapa, el sistema calcula solo el tiempo total y lo compara contra el estándar — no hace falta hacer nada más, el semáforo de colores (verde/amarillo/rojo según desviación) se aplica automáticamente." },
          { titulo: "Si corregís algo a mano en la hoja TIEMPOS", texto: "Una corrección puntual (por ejemplo, un horario mal cargado) se recalcula sola apenas guardás el cambio — no hace falta hacer nada más. Solo si pegás muchas filas de golpe (más de 25), usá el menú \"Tiempos → Recalcular TODA la hoja\" desde la planilla." },
          { titulo: "Recalcular manualmente si hace falta", texto: "Desde el menú \"Tiempos\" de la hoja de cálculo: \"Recalcular solo la tarea de la celda seleccionada\" (parate en cualquier celda de esa tarea) o \"Recalcular TODA la hoja\" para un control general." }
        ]
      }
    },

    // =================================================================
    // CALIDAD
    // =================================================================
    {
      id: "rg-ca-03",
      categoria: "Calidad",
      nombre: "RG-CA-03 · Conformidad de Productos",
      estado: "activo",
      resumen: "Control de calidad por operación, con trazabilidad por Nº de Serie y vínculo automático a NC.",
      tecnico: {
        intro: "Permiso AuthLib: <code>\"controles-calidad\"</code>. Vincula tres fuentes: TAREAS 2026 (qué controlar), Cubas (qué números de serie existen realmente) y RRHH — Legajos (quién controla).",
        bloques: [
          {
            titulo: "Flujo de datos",
            texto: "1) Se busca la OT en TAREAS 2026 (con el mismo \"caminado de bloque\" que Carga de Tiempos). 2) Para la tarea elegida, se toma OC + Modelo + el rango de Nº de Cuba de esa fila (heredado de la primera fila del bloque si la fila específica lo tiene vacío — todas las tareas de un bloque son sobre la misma pieza física). 3) Se consulta la hoja Cubas (columnas B=Orden/OC, C=Modelo, F=serie) filtrando por OC+Modelo, y se cruza contra el rango de Nº de Cuba para mostrar solo los números que pertenecen a esa tanda puntual."
          },
          {
            titulo: "Trazabilidad unitaria",
            texto: "Se genera <b>un registro por cada Nº de Serie</b> confirmado (no un registro por lote) — esto permite después cruzar Registro, NC y Control de Tiempos por número de serie individual."
          },
          {
            titulo: "Columnas de la hoja Registro",
            tabla: [
              ["A", "N° Control", "Autoincremental, formato C-NNNN"],
              ["B", "N° OT", ""],
              ["C", "Orden de Compra", ""],
              ["D", "Código de Operación", ""],
              ["E", "Descripción de Operación", ""],
              ["F", "Fecha de Control", ""],
              ["G", "Operario", ""],
              ["H", "N° Serie", "Clave de trazabilidad"],
              ["I", "OK / NOK", ""],
              ["J", "N° NC", "Se completa manualmente después de generar la NC (ver más abajo)"],
              ["K", "Observaciones", "Incluye el detalle de los parámetros NOK, generado automáticamente"],
              ["L", "Controló", "Personal de oficina (legajo 800–999) que hizo el control"],
              ["M", "Modelo", ""]
            ]
          },
          {
            titulo: "Pauta de control (hoja Parametros)",
            texto: "Agrupada por Cód. de Operación (columna A). Si una operación no tiene pauta cargada, el sistema no bloquea el control — muestra un aviso y deja elegir el dictamen (CONFORME/DEFECTO) manualmente."
          },
          {
            titulo: "Integración con NC — cómo funciona el vínculo",
            texto: "Cuando el dictamen es NOK, RG-CA-03 <b>no crea la NC directamente</b> — arma un <b>link de precarga</b> al formulario NUEVO de NC (no al de edición, que bloquea campos — ver el porqué en el bloque siguiente) con Modelo, Nº de Serie, OT, OC, Responsable y el Detalle del defecto ya cargados por parámetros de URL. Se abre en una pestaña nueva. El inspector completa ahí Inspector/Línea de Producto/Cód. Operación/Codificación (los datos que RG-CA-03 no puede saber) y guarda con el flujo normal de NC."
          },
          {
            titulo: "Por qué no hay creación automática por atrás",
            texto: "Se probó primero un <code>doPost</code> que creaba la NC directo desde RG-CA-03 sin abrir ninguna pantalla — pero eso generaba NC con Inspector/Línea de Producto/Codificación <b>vacíos para siempre</b>, porque el modo Edición de NC bloquea a propósito esos campos (está pensado solo para cargar causa/acción/disposición después, no para completar altas — ver el módulo NC). El diseño actual evita ese problema de raíz: como la creación pasa siempre por el formulario NUEVO (nunca por edición), todos los campos quedan editables en el momento, y no queda nada pendiente de forma estructural."
          },
          {
            titulo: "Cómo se cierra el círculo — los 3 pasos exactos",
            texto: "<b>Paso 1</b>: en RG-CA-03, al confirmar un registro NOK, aparece un botón \"Completar NC\" por cada pieza — lo abre en pestaña nueva, ya precargado. <b>Paso 2</b>: en esa pestaña de NC, el inspector completa lo que falta y aprieta Guardar — NC le devuelve el número de NC recién creado (por ejemplo, \"N° Asignado: 1476\"). <b>Paso 3</b>: el inspector vuelve a la pestaña de RG-CA-03 (sigue abierta, no hace falta recargar nada), y en el banner amarillo \"NC pendientes\" de esa misma pieza pega el número que le dio NC y aprieta \"Guardar N°\" — recién ahí la columna J de Registro queda completa y esa pieza sale del banner de pendientes. <b>Mientras no se hace el paso 3, el registro queda visible en el banner</b> — es la señal de que todavía falta cerrar ese círculo."
          },
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Buscar la OT", texto: "Escribir el N° de OT y apretar Buscar. Aparecen todas las tareas de esa OT (incluidas las que comparten bloque)." },
          { titulo: "Elegir la operación a controlar", texto: "Cada tarjeta muestra si ya tiene control registrado o no." },
          { titulo: "Confirmar Orden de Compra, Modelo y Operario", texto: "Vienen precargados. El Operario se puede cambiar si difirió del que aparece asignado." },
          { titulo: "Tildar los números de serie controlados", texto: "Aparece la lista real de series de esa tanda (desde Cubas). Si la pieza no tiene número identificado (fondos, herrajes), se puede anotar manualmente." },
          { titulo: "Completar la pauta de control", texto: "Marcar CONFORME o DEFECTO en cada parámetro. Si falta alguno, seguir; si no hay pauta cargada para esa operación, elegir el dictamen manualmente." },
          { titulo: "Elegir quién controló", texto: "Personal de oficina, buscando por legajo o apellido." },
          { titulo: "Confirmar registro", texto: "Si el dictamen es NOK, la pantalla de éxito muestra un botón \"Completar NC\" por cada pieza — se abre en una pestaña nueva, con Modelo/Serie/OT/OC/Responsable/Detalle ya cargados." },
          { titulo: "Completar y guardar la NC", texto: "En esa pestaña nueva, completar Inspector/Línea de Producto/Cód. Operación/Codificación y guardar — NC devuelve el número asignado (ej. \"N° Asignado: 1476\")." },
          { titulo: "Cerrar el círculo — pegar el N° de NC", texto: "Volver a la pestaña de RG-CA-03 y, en el banner amarillo \"NC pendientes\" (visible arriba de todo mientras haya algo sin vincular), pegar el número que dio NC en el campo de esa pieza y apretar \"Guardar N°\". Recién ahí la columna J de Registro queda completa. Si una pieza sigue apareciendo en ese banner, es la señal de que todavía falta este último paso." }
        ]
      }
    },

    {
      id: "rg-ca-02-nc",
      categoria: "Calidad",
      nombre: "RG-CA-02 · No Conformidades (NC)",
      estado: "activo",
      resumen: "Apertura, análisis de gravedad y sanciones por No Conformidad técnica.",
      tecnico: {
        intro: "Permiso AuthLib: <code>\"nc\"</code>. Base: hoja Indice_Maestro (histórico completo) + Matriz_NC (códigos de falla) + Operaciones (catálogo Cod. de Operación).",
        bloques: [
          {
            titulo: "Estructura de Indice_Maestro (bloques de columnas)",
            tabla: [
              ["A", "NC N°", "Autoincremental, calculado atómicamente con LockService al guardar"],
              ["B", "Fecha del desvío", ""],
              ["C", "Operario (Responsable NC)", "Legajo, o \"legajo - Apellido, Nombre\""],
              ["D", "Inspector", "Área: Calidad / Control de Expedición / Producción / Mantenimiento / ODP Rosario"],
              ["E–J", "Producto, Modelo, N° Serie, N° OT, Cod. Operación, Orden de Compra", ""],
              ["K–P", "COD 1/2/3 + sus etiquetas", "Codificación jerárquica (Dónde → Tipo de NC → Detalle), sacada de Matriz_NC"],
              ["Q", "Descripción Detallada", ""],
              ["R", "Disposición", "Retrabajo / Concesión / Descarte / Devolución a proveedor / Retrabajo de Cliente"],
              ["S", "Acción Correctiva", "Combina Causa + Acción en un solo campo: <code>CAUSA: ... | ACCIÓN: ...</code>"],
              ["T", "Coordinó y Aprobó", ""],
              ["U/V", "Nº de Ficha / Fecha elaboración", "Solo se asigna si se generó el PDF"],
              ["W–Y", "Firmada / Fecha de firma / Archivada en legajo", ""],
              ["Z", "Estado", "ABIERTA / (cerrada, si aplica)"],
              ["AA–AH", "Análisis de Gravedad", "Peso + columnas por categoría (Poro, Error Geométrico, Mala Terminación, Ineficiencia de Control, Propios, Sistema, Servicio)"],
              ["AI–AK", "Sanciones", "Nº de Apercibimiento, fichas que agrupa, fecha de firma"]
            ]
          },
          {
            titulo: "Modo Edición — exactamente qué se puede cargar (y qué no)",
            texto: "Al buscar una NC existente por número, el formulario entra en <b>\"EDICIÓN DE NC DE CLIENTE (MRB)\"</b> — toda la sección 1 (Identificación) y 2 (Codificación) queda bloqueada en gris (<code>fieldset disabled</code>), a propósito, para no pisar por error los datos de origen. Lo que <b>sí</b> queda editable son 3 cosas: <b>Análisis de Causas</b> (texto libre), <b>Acción Correctiva</b> + <b>Coordinó y Aprobó</b> (quién autorizó, de una lista fija: Gerencia/Supervisor de Producción/Supervisor de Técnica/Supervisor de Administración), y <b>Disposición del Producto</b> (radio con 5 opciones: Retrabajo/Concesión/Descarte/Devolución a proveedor/Retrabajo de Cliente). <code>updateNCToMasterIndex</code> guarda exactamente esos 3 campos (columnas R/S/T de Indice_Maestro — Causa y Acción se combinan en un solo texto en S) y nada más."
          },
          {
            titulo: "⚠ Foto y firma se ven editables pero NO se guardan en la planilla",
            texto: "La sección \"Evidencia Fotográfica\" y la firma del inspector (\"Validación en Planta\") también quedan habilitadas en modo edición — pero <code>updateNCToMasterIndex</code> no las persiste en ninguna columna. Solo importan si en esa misma sesión se genera el PDF de la ficha (quedan embebidas en el documento impreso), no quedan guardadas como dato en Indice_Maestro. Si alguien cambia la foto en modo edición sin generar el PDF después, ese cambio se pierde al salir — vale la pena tenerlo claro para no esperar que quede reflejado en la planilla."
          },
          {
            titulo: "Las 3 pestañas de la app — para qué sirve cada una",
            texto: "<b>1. Formulario NC</b> — donde se abre una NC nueva o se edita una existente (modo edición, solo causa/acción/disposición). <b>2. Pendientes</b> — el trabajo de todos los días de Calidad y Administración, dos sub-pestañas separadas. <b>3. Análisis y Evaluación</b> — la vista estadística/gerencial, para ver patrones y reincidencia en el tiempo, no para cargar nada."
          },
          {
            titulo: "Pestaña Pendientes → Técnica y Producción",
            texto: "Lista cada NC con Estado=ABIERTA que todavía no tiene Peso cargado (columna AA vacía). Al abrir una para cargar el Análisis de Gravedad, la pantalla trae automáticamente <b>dos historiales en paralelo</b>, uno al lado del otro: <code>getHistorialOperario(legajo, reportId)</code> — antecedentes de <i>esa persona</i> (cuántas veces tuvo gravedad cargada, cuántas sanciones, agrupado por código de falla) — y <code>getHistorialCodigo(cod1, cod2, cod3, reportId)</code> — antecedentes de <i>ese mismo tipo de falla</i> en cualquier operario, para saber si es un problema puntual de la persona o algo más general del proceso/plano. Se cargan los 8 campos de gravedad (Peso, Poro-10, Error Geométrico-11, Mala Terminación-12, Ineficiencia de Control-13, Propios-14, Sistema-19, Servicio-40) — números que salen de la matriz de gravedad interna de calidad, no de una fórmula automática del sistema."
          },
          {
            titulo: "Pestaña Pendientes → Administración",
            texto: "Lista las NC que <b>ya tienen gravedad cargada</b> pero todavía no tienen Nº de Apercibimiento — depende directamente de que Técnica haya terminado su parte primero (si falta la gravedad, queda marcada \"Espera Gravedad\" y no se puede cargar sanción todavía, validado también del lado del servidor). Arriba de la lista está el <b>Resumen de Peso Acumulado por Operario</b> (<code>obtenerResumenAdministracion</code>): agrupa todas las NC abiertas con gravedad cargada y sin sanción, sumando el Peso de cada una por legajo — si ese acumulado supera el umbral (3 puntos por default), la fila se marca en rojo \"Corresponde sanción\". Desde ahí se eligen las NC a agrupar bajo un mismo apercibimiento, se firma con fecha, y se genera automáticamente el PDF de notificación — todo en un solo paso."
          },
          {
            titulo: "Pestaña Análisis y Evaluación — de dónde sale cada gráfico",
            texto: "Vista de <b>solo lectura</b>, para patrones y tendencias, no para cargar nada. Filtros arriba: rango de fechas, Operario, Producto, Tarea — todos opcionales, se combinan entre sí y disparan <code>obtenerDatosAnalisis(filtros)</code>."
          },
          {
            titulo: "Gráfico 1 — Ranking por Operario (Top 15)",
            texto: "Cantidad de NC por operario en el período/filtro elegido, ordenado de mayor a menor, mostrando los 15 con más casos. Responde directamente \"¿quién concentra más No Conformidades?\" en el recorte que estés mirando."
          },
          {
            titulo: "Gráfico 2 — NC por Tipo (Donde)",
            texto: "Agrupa por la columna \"Dónde\" de la codificación (Cód 1 de la matriz de fallas) — muestra en qué sector o etapa del proceso se concentran más No Conformidades, sin importar quién las causó."
          },
          {
            titulo: "Gráfico 3 — Evolución mensual",
            texto: "Cantidad total de NC por mes, usando la <b>fecha efectiva</b> de cada caso — que no siempre es la fecha de reporte: si la pieza tiene Nº de Serie identificado y ese número aparece en Cubas con fecha real de despacho, se usa esa fecha en su lugar (más precisa, refleja cuándo realmente salió la pieza con el defecto, no cuándo se cargó el papeleo). El contador <code>casosSinFechaDespachoEncontrada</code> lleva la cuenta de cuántos casos no pudieron cruzarse con Cubas y quedaron con la fecha de reporte nomás."
          },
          {
            titulo: "Gráfico 4 — Reincidencia por Tarea (el más importante para detectar patrones)",
            texto: "Agrupa por Tarea (Cód. de Operación) — no por Modelo, a propósito, porque el Modelo suele venir mal cargado o \"sin poder determinar\" en muchos casos históricos. Cada fila es expandible y muestra el detalle caso por caso al hacer click. Tres estados posibles, calculados sobre la fecha efectiva del caso más reciente de esa tarea: <b>Activo</b> (último caso hace ≤60 días — problema vigente), <b>Enfriando</b> (61 a 180 días — bajando pero todavía reciente), <b>Resuelto</b> (más de 180 días sin casos nuevos)."
          },
          {
            titulo: "La \"pista\" de cambio de operario — qué significa exactamente",
            texto: "Solo aparece cuando una tarea <b>ya no está Activa</b> (Enfriando o Resuelto) y hay al menos 2 casos. Si un mismo operario concentra el 60% o más de los casos históricos de esa tarea, y ese operario <b>no aparece en el caso más reciente</b> (o ya no figura activo en la empresa), el sistema arma una pista tipo: \"Fulano concentra el 75% de los casos de esta tarea (6 de 8), y ya no figura activo en la empresa. La reincidencia parece haber cesado desde entonces — a confirmar si realmente fue por cambio de tarea/operario.\" Es una <b>sugerencia a confirmar manualmente</b>, no una conclusión automática — el propio texto lo aclara así a propósito, para no dar por sentado una causa sin que alguien de Calidad la valide."
          },
          {
            titulo: "Informe PDF de Análisis y Evaluación",
            texto: "Arma un documento con los 3 gráficos como imagen (ranking, tipo, evolución), más una sección de \"Conclusiones y Recomendaciones\" generada por reglas fijas (quién concentra más NC, tipo de falla más frecuente, tendencia creciente/decreciente/estable comparando la primera mitad del período contra la segunda, tareas con reincidencia activa, y los casos con pista de cambio de operario) — pensado para imprimir y compartir con gerencia, con los filtros aplicados documentados arriba del todo."
          },
          {
            titulo: "Espejo automático hacia RRHH — Sanciones_Comportamiento",
            texto: "Al registrar un apercibimiento (<code>guardarSancionAgrupada</code>), además de escribir el número en Indice_Maestro, se genera automáticamente una fila espejo en la hoja <b>Sanciones_Comportamiento</b> de RRHH — Legajos (categoría fija \"No Conformidad de Producción / Calidad\", 0 días de suspensión, detalle con la lista de NC agrupadas). Así el legajo del operario queda con el antecedente completo en un solo lugar, sin duplicar carga manual. Si el espejo falla (por ejemplo, no encuentra la hoja), <b>el apercibimiento igual queda guardado</b> en Indice_Maestro — el mensaje de éxito avisa que hay que correr el backfill de nuevo para ese caso puntual."
          },
          {
            titulo: "Backfill — sincronizar apercibimientos viejos con RRHH",
            texto: "<code>backfillApercibimientosNCEnSancionesComportamiento()</code> — función de uso manual (correr una sola vez desde el editor), agrupa todos los apercibimientos ya cargados en Indice_Maestro por legajo+número, y crea la fila espejo en RRHH para los que todavía no la tengan. Verifica duplicados por una marca de \"Archivo origen\" (<code>RG-CA-02 - Apercibimiento Nº X - Legajo Y</code>) — se puede correr las veces que haga falta sin generar filas repetidas."
          },
          {
            titulo: "Herramienta de mantenimiento: normalización de operarios en Indice_Maestro",
            texto: "<code>normalizarOperariosIndiceMaestro()</code> — mismo patrón que la normalización de TIEMPOS: un mapa fijo de 94 casos ya resueltos a mano (texto libre tipo \"Rigo, J\" o legajo suelto → formato estándar \"legajo - Apellido, Nombre\"), aplicado de una sola vez sobre la columna C de Indice_Maestro. De uso manual, no forma parte del flujo diario. Deja afuera a propósito los casos sin match claro (\"???\" o legajos inexistentes en RRHH) para revisión manual — no los fuerza."
          },
          {
            titulo: "Botón Manual",
            texto: "El <code>doGet</code> ahora también inyecta <code>token</code> a la plantilla (antes solo mandaba <code>precargaJSON</code>) — se agregó <code>window.TOKEN_SESION</code> junto a la precarga existente, y el link \"📘 Manual\" en el header, al lado del título \"Informe de No Conformidades\"."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Abrir el formulario de NC", texto: "Desde RG-CA-03 (con datos precargados) o directamente en la app de NC para cargar desde cero." },
          { titulo: "Completar Identificación", texto: "Fecha del desvío, Responsable NC, Inspector (por área), Línea de Producto (esto habilita el desplegable de Cód. de Operación), Modelo, Nº Serie, Nº OT, Orden de Compra." },
          { titulo: "Codificación y Descripción", texto: "Elegir Cód 1 (Dónde), que filtra las opciones de Cód 2 (Tipo de NC), que a su vez filtra Cód 3 (Detalle). Cargar el detalle de la disconformidad." },
          { titulo: "Guardar", texto: "\"Guardar SIN FICHA\" registra la NC en el Índice Maestro. \"Previsualizar FICHA\" genera el PDF formal (F-CA-08) y asigna Nº de Ficha." },
          { titulo: "Pendientes → Técnica y Producción", texto: "Cargar el Análisis de Gravedad (Peso + categorías) para cada NC abierta." },
          { titulo: "Pendientes → Administración", texto: "Una vez cargada la gravedad, seleccionar las NC de un operario y registrar el Apercibimiento — genera automáticamente el PDF de notificación." }
        ]
      }
    },

    // =================================================================
    // RRHH
    // =================================================================
    {
      id: "rrhh-legajos",
      categoria: "RRHH",
      nombre: "RRHH — Legajos",
      estado: "activo",
      resumen: "Ficha de personal, altas/bajas, faltas, autorizaciones, sanciones (2 flujos) y Empleado del Mes.",
      tecnico: {
        intro: "Permiso AuthLib: <code>\"rrhh-presentismo\"</code>. Un solo proyecto de Apps Script, bound a la planilla \"RRHH — Legajos\", con <b>6 archivos</b>: <code>Código.gs</code> (legajos, faltas, autorizaciones, feriados, doGet), <code>EmpleadoDelMes.gs</code>, <code>Funcionpuentehistorial.gs</code> (historial de sanciones por CUIL), <code>Codigo_RRHH_Sanciones.gs</code> (modal de sanciones vía menú de Sheets), <code>Index.html</code> (la app completa), <code>FormularioSancion.html</code> (modal aparte).",
        bloques: [
          {
            titulo: "Estructura real de columnas (hoja RRHH, 35 columnas)",
            texto: "B=Legajo, C=Reloj, D=Apellido, E=Nombre, F=CUIL, G=Teléfono, H=F.Nac, I=Dirección, J=Edad, K=Estado Civil, L-M=Pareja/DNI, N-V=hasta 4 hijos (nombre/DNI/fecha nac. cada uno), W=Condición, AA=Consultora, AB=Puesto, AC=Categoría, AD=Ingreso, AE=Egreso, AF=Estado, AG=Motivo, AH=Código de Baja, AI=Comentario. El objeto <code>COL</code> en <code>Código.gs</code> es la única fuente de verdad de este mapeo — nunca asumir la columna por posición visual en la hoja."
          },
          {
            titulo: "Permisos por sección (7 secciones reales)",
            texto: "<code>SECCIONES_RRHH_</code>: Faltas, Autorizaciones, Sanciones, DatosPersonales, DatosLaborales, AltasBajas, Feriados. Cada una con su propio nivel (oculto/lectura/edición) vía <code>AuthLib.obtenerPerfilSeccion()</code> — <code>obtenerPerfilRRHHCompleto()</code> resuelve las 7 de una sola vez al abrir la pantalla. <code>obtenerDetalleLegajo()</code> filtra del lado del servidor los campos de sección \"oculto\" — no es solo ocultamiento visual."
          },
          {
            titulo: "Auto-numeración de legajo — 4 rangos, no 2",
            texto: "<code>operario</code>: 1–799. <code>oficina</code>: 800–9700. <code>cliente</code>: 9801–9899. <code>proveedor</code>: 9901–9999. El corte en 800 (planta vs. oficina) es la convención que usa todo el resto del sistema (RG-CA-03, Empleado del Mes, listas de operarios activos, etc.) — pero los rangos de cliente/proveedor son nuevos, no estaban documentados antes."
          },
          {
            titulo: "Sincronización con OPERARIOS (TIEMPOS)",
            texto: "Cada alta, baja, o cambio de ESTADO/EGRESO dispara <code>sincronizarOperariosActivos_()</code>, que reescribe las columnas B:E de la hoja OPERARIOS en TIEMPOS con los legajos activos — <b>nunca toca la columna A</b> (la usa otra app de unificación de nombres aparte). Es automático, no hace falta el botón manual salvo para forzarlo (<code>sincronizarOperariosManual</code>)."
          },
          {
            titulo: "Faltas — certificados y cálculo de días hábiles",
            texto: "Cada falta se guarda con un ID único (no por posición de fila, para poder editarla después con seguridad aunque se agreguen filas nuevas). Si se adjunta certificado, sube a Drive (carpeta <code>Certificados_Faltas</code> dentro de la carpeta Mayo) con permiso de solo-visualización por link. <code>_diasHabilesReales_()</code> calcula los días de la falta saltando fines de semana y feriados (calendario propio con la fórmula de Gauss para Semana Santa, ver <code>_calcularPascua_</code> — hay <b>dos</b> calendarios de feriados en el código: uno hardcodeado en <code>Código.gs</code> como respaldo, y el real editable en la hoja Feriados de esta misma planilla)."
          },
          {
            titulo: "Autorizaciones — penalización x1.5 por regreso tarde",
            texto: "4 plantillas de texto (Salida, Salida por Beneficio, Entrada Tarde, Falta) con placeholders <code>{{direccion}}</code>/<code>{{fecha}}</code>. Al registrar el regreso real de una autorización de Salida, <code>registrarRegresoAutorizacion()</code> calcula el tiempo fuera real y lo multiplica por <b>1.5</b> como penalización — ese tiempo penalizado es el que queda escrito, no el real."
          },
          {
            titulo: "Sanciones — DOS flujos paralelos (uno tenía un bug serio)",
            texto: "<b>Flujo 1 (correcto, el de uso diario)</b>: embebido en <code>Index.html</code>, se abre con el botón \"Sancionar\" dentro del panel de un legajo — <code>confirmarNuevaSancion()</code> → <code>guardarSancionComportamientoSeguro()</code> → <code>generarPdfSancion()</code>, todo bien conectado. <b>Flujo 2 (modal aparte, vía menú de Sheets)</b>: <code>Codigo_RRHH_Sanciones.gs</code> + <code>FormularioSancion.html</code>, se abre con \"Sanciones → Registrar nueva sanción...\" desde el menú de la planilla — pensado para cargar una sanción sin tener que abrir la app web completa."
          },
          {
            titulo: "⚠ Bug corregido — FormularioSancion.html tenía código pegado por error",
            texto: "El callback de éxito al guardar (dentro del Flujo 2) hacía referencia a <code>filaDetalle</code> y <code>pintarPanelDetalle</code> — variables/funciones que <b>no existen en ese archivo</b>, eran de <code>Index.html</code>, pegadas ahí por error en algún momento. Guardar una sanción desde ese modal guardaba el dato bien (el servidor ya había terminado su trabajo), pero el cliente tiraba un error justo después en vez de generar el PDF. Corregido: ahora llama correctamente a <code>generarPDF(res)</code>, la función que ya estaba definida en el mismo archivo pero nunca se usaba."
          },
          {
            titulo: "Historial de sanciones — prescripción y escalada (Funcionpuentehistorial.gs)",
            texto: "<code>obtenerHistorialSancionesOperario()</code> busca por CUIL (no por legajo) en <code>Sanciones_Comportamiento</code> — prescripción de <b>2 años</b> (<code>ANIOS_PRESCRIPCION_</code>), 3 categorías excluidas del conteo (COVID viejo, \"Otro/Revisar manualmente\", \"NO ES SANCIÓN\"), agrupado por categoría con el próximo nivel sugerido: menos de 3 apercibimientos vigentes en esa categoría → sigue siendo Apercibimiento; a partir de 3 → Suspensión, con escala de días <code>[1, 3, 5, 15]</code> según cuántas suspensiones vigentes ya tenga en esa misma categoría."
          },
          {
            titulo: "Fórmula de Empleado del Mes — completa, no solo el 40/35/15",
            formula: {
              texto: "Ranking mensual combinando tres factores (ponderación variable si falta el de Tiempos):",
              partes: [
                { pct: "40%", lbl: "Asistencia" },
                { pct: "35%", lbl: "Sanciones" },
                { pct: "15%", lbl: "Rendimiento de Tiempos" }
              ]
            },
            textoExtra: "<b>Asistencia</b>: 100 − (días de falta del mes / días hábiles del mes × 100). <b>Sanciones</b>: 100 − (apercibimientos del mes × 25) — suma apercibimientos de Sanciones_Comportamiento <b>y</b> de RG-CA-02/NC juntos (ver bug corregido abajo). <b>Tiempos</b>: se pondera desviación promedio en TIEMPOS ese mes vía una curva (<code>_puntajeDesdeDesviacion_</code>): −30% de desviación o mejor = 100 puntos, +30% o peor = 0 puntos, con interpolación lineal entre medio (0% de desviación = 70 puntos). <b>Descalificación automática</b> (puntaje final = 0, sin importar el resto): tener una suspensión vigente ese mes, o al menos una falta injustificada ese mes. <b>Si el operario no tiene registros en TIEMPOS ese mes</b>, el puntaje final se recalcula solo con Asistencia+Sanciones (75% del peso total), sin el 15% de Tiempos. Legajos ≥800 (oficina) excluidos por completo."
          },
          {
            titulo: "⚠ Bug corregido — el cruce con NC nunca funcionó, en silencio",
            texto: "<code>obtenerRankingEmpleadoDelMes()</code> intenta sumar los apercibimientos de RG-CA-02/NC a los de Sanciones_Comportamiento — pero usaba <code>ID_RGCA02_</code> y <code>extraerLegajoPuente_()</code>, ninguna de las dos declarada en ningún archivo del proyecto. Como el bloque está envuelto en un <code>try/catch</code> genérico (\"si falla el cruce con NC, seguimos sin esa parte\"), <b>nunca tiró error visible</b> — el ranking viene calculando \"Sanciones\" contando solo comportamiento, nunca calidad/NC, desde que se armó esto, sin que nadie lo supiera. Corregido: <code>ID_RGCA02_</code> declarada con el ID real de la planilla de NC, y <code>extraerLegajoPuente_()</code> implementada con el mismo patrón de regex que ya usaba el propio archivo para TIEMPOS (<code>/^(\\d+)\\s*-/</code> sobre el texto \"legajo - Apellido, Nombre\")."
          },
          {
            titulo: "Feriados",
            texto: "Modal con calendario editable (hoja Feriados en esta misma planilla) — pre-cargado con Argentina 2026 + Día del Metalúrgico (7 de septiembre) la primera vez que se usa. Trigger automático el día 1 de cada mes que solo manda el email recordatorio en diciembre (\"actualizá el calendario del año que viene\")."
          },
          {
            titulo: "⚠ Lección del día — plantillas vs. token por URL (aplica a todo el sistema, no solo acá)",
            texto: "Se intentó \"prevenir\" el incidente de F-CA-26 sacando <code>createTemplateFromFile</code> de este módulo también, leyendo el token del lado del cliente con <code>URLSearchParams(window.location.search)</code> — mala aplicación de la lección. La corrupción de F-CA-26 era específica de <b>Babel procesando JSX</b> después de que Apps Script tocara el archivo, no un problema general de archivos grandes. Además, el HTML servido por Apps Script corre adentro de un <b>iframe con sandbox propio</b> (la advertencia de consola \"allow-scripts and allow-same-origin\" que aparece en todos los módulos) — ese iframe interno <b>no hereda necesariamente el <code>?token=...</code></b> de la URL de arriba, aunque el <code>doGet</code> del lado del servidor sí lo reciba bien vía <code>e.parameter.token</code>. Resultado: la página cargaba bien (el gate del <code>doGet</code> pasa), pero <b>todas las llamadas del cliente fallaban</b> con \"Sesión inválida o vencida\", porque el token leído del lado del cliente no era el real. <b>Revertido a <code>createTemplateFromFile</code></b> (el mecanismo original, que sí funcionaba). <b>Regla real, no la que se aplicó mal</b>: evitar plantillas específicamente en archivos que combinan React+Babel de gran tamaño (como F-CA-26); en JS plano, plantillas funcionan bien en todo el resto del sistema (Cubas, Carga de Tiempos, RG-CA-03, NC) y <b>no</b> hay que sacarlas preventivamente."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Buscar y ver un legajo", texto: "Buscador arriba (por legajo, apellido o nombre), o filtros Todos/Activos/Baja. Click en una fila para expandir el detalle en acordeón." },
          { titulo: "Editar un campo", texto: "Dentro del detalle expandido, cada campo editable permite tipear directo — se guarda solo al perder el foco, y queda registrado en Historial_RRHH." },
          { titulo: "Dar de alta un empleado", texto: "\"+ Nuevo empleado\" → elegir tipo (operario/oficina/cliente/proveedor) para la auto-numeración de legajo → completar datos → confirmar." },
          { titulo: "Dar de baja", texto: "Desde el detalle del legajo, botón de baja — fecha, código de motivo (obligatorio) y comentario. Sincroniza automáticamente OPERARIOS en TIEMPOS." },
          { titulo: "Registrar faltas del día", texto: "Botón \"📋 Registrar faltas del día\" arriba — selecciona operarios, motivo, tipo de enfermedad si corresponde, días, y certificado si hay." },
          { titulo: "Generar una autorización", texto: "\"📝 Generar autorización\" — elegir tipo, completar dirección/motivo y hora, genera el PDF listo para firmar." },
          { titulo: "Cargar una sanción", texto: "Desde el detalle del legajo, acordeón de Sanciones → \"Nueva sanción\" — elegir categoría (autocompleta el texto), tipo, fecha y detalle específico. Genera el PDF y queda en el historial. También se puede desde el menú de Sheets \"Sanciones → Registrar nueva sanción...\" sin abrir la app completa." },
          { titulo: "Ver Análisis de Faltas", texto: "\"📊 Análisis de Faltas\" — gráficos por operario/motivo/tipo de enfermedad/justificación, con exportación a PDF." },
          { titulo: "Calcular Empleado del Mes", texto: "\"🏆 Empleado del Mes\" → elegir mes y año → calcular. El ranking se recalcula en el momento, no queda guardado." },
          { titulo: "Gestionar feriados", texto: "Botón \"Feriados\" — agregar uno por uno o pegar una lista completa (\"AAAA-MM-DD, Descripción\" por línea)." }
        ]
      }
    },

    // =================================================================
    // PLANIFICACIÓN Y LOGÍSTICA
    // =================================================================
    {
      id: "cubas",
      categoria: "Planificación y Logística",
      nombre: "Cubas",
      estado: "activo",
      resumen: "Ciclo completo de una cuba: banco de series, plegado, producción, despacho y reparación.",
      tecnico: {
        intro: "Spreadsheet ID <code>1cjV4eFwRRXwlCoMiQ-BhdB-RzMKZ3S-Ns4bQA71vuMQ</code>. La planilla más completa del sistema — es la fuente real de números de serie que usa RG-CA-03.",
        bloques: [
          {
            titulo: "Un solo proyecto de Apps Script para 5 formularios",
            texto: "Confirmado: Órdenes/Stock de Series, Materiales, Despachos, Dashboard y Tablero de Producción son <b>un único proyecto de código</b> (\"Cubas\"), con un solo <code>doGet(e)</code> como router (despacha por <code>?v=</code>: <code>ordenes</code>/<code>materiales</code>/<code>despachos</code>/<code>dashboard</code>/<code>tablero-produccion</code>) y un solo menú de Sheets (<code>onOpen()</code>, \"⚙️ Sistema Mayo\") para abrirlos como modal desde la propia planilla. El Tablero de Producción, aunque lee de otro spreadsheet (TAREAS 2026), es código del mismo proyecto — ver su página propia para el detalle completo."
          },
          {
            titulo: "Permisos por submódulo, no uno solo para todo Cubas",
            texto: "Cada formulario usa su propia <code>moduloKey</code> en <code>AuthLib</code>: <code>ordenes</code>, <code>materiales</code>, <code>despachos</code>, <code>tablero-produccion</code>. Dashboard no tiene candado (solo lectura). El <code>doGet</code> inyecta <code>token</code> y <code>nivel</code> por plantilla únicamente en las 4 vistas que tienen escritura — Dashboard sigue sirviéndose como archivo estático simple."
          },
          {
            titulo: "Endpoint de KPIs (JSONP)",
            texto: "El <code>doGet</code> también atiende <code>?v=kpis</code> sin pasar por el gate de sesión — es el endpoint liviano que alimenta los contadores del header del Tablero general (hub), vía <code>getKpisProduccion()</code>."
          },
          {
            titulo: "Hoja Cubas — columnas clave",
            tabla: [
              ["A", "i", "Índice"],
              ["B", "Orden", "OC — <b>ojo:</b> a pesar del nombre \"Orden\", esta es la Orden de Compra real, no el OT (la OT vive en TAREAS 2026, no acá)"],
              ["C", "Modelo", ""],
              ["D", "Cliente", ""],
              ["F", "Serie", "Nº de serie individual de la cuba"],
              ["G", "Plegado - OC", "OC de una etapa anterior (plegado) — no confundir con la columna B"],
              ["M", "OT", ""],
              ["S", "Despacho", "Flag 0/1"],
              ["AB", "Estado de Despacho", "\"Completo\" / \"Parcial\""]
            ]
          },
          {
            titulo: "Tipos de cuba (por prefijo de código de modelo)",
            tabla: [
              ["10", "D", ""], ["11", "PRENSA", ""], ["12", "D AL", ""],
              ["13", "DI AL", ""], ["14", "DI", ""], ["15", "ST", ""],
              ["16", "D AL", ""], ["17", "D", ""], ["18", "DIM AL", ""], ["19", "DIM", ""]
            ]
          },
          {
            titulo: "Banco de números de serie (Stock_Series)",
            texto: "Al registrar una nueva orden, se descuentan series del banco (estado \"Libre\"). Si no hay suficientes, la función <code>registrarNuevaOrden</code> devuelve error antes de escribir nada — no permite quedar con series parcialmente asignadas."
          },
          {
            titulo: "FormularioOrdenes — Reserva de Stock de Series (Módulos 1 y 2)",
            texto: "Formulario con dos pestañas dentro de la misma pantalla. <b>Confirmado: es el mismo módulo que \"Generación de OTs\" del hub</b> (<code>?v=ordenes</code> en el router de Cubas sirve exactamente este archivo, con el título \"Mayo — Generación de OTs\") — la nota anterior que los distinguía como cosas separadas estaba mal, ya corregida. Pestaña 1 arma la OT en sí; Pestaña 2 administra el banco de números de serie que se le van a asociar. Como los rangos pedidos pueden no ser consecutivos, cada pedido se trata por separado en vez de acumularse en un único banco corrido. <b>Pestaña 1 (Cargar Orden)</b>: OT, Cliente, Modelo (combo cargado desde <code>obtenerModelosReales()</code>), Cantidad — valida en vivo contra el stock disponible (<code>validarDisponibilidad()</code> en el cliente) y bloquea el botón Guardar si la cantidad pedida supera las series libres, mostrando un cartel con acceso directo a la Pestaña 2. Al guardar, llama a <code>registrarNuevaOrden(datosOrden)</code>. <b>Pestaña 2 (Cargar Stock Series)</b>: dos modos — \"Consecutivos (Rango)\" (Desde/Hasta) o \"Con Saltos\" (lista de números separados por coma) — llama a <code>agregarNuevasSeriesAlStock(paqueteSeries)</code> y vuelve automáticamente a la Pestaña 1 después de guardar."
          },
          {
            titulo: "Niveles de acceso en FormularioOrdenes",
            texto: "Usa el mismo patrón de plantilla que RG-CA-03: <code>NIVEL_USUARIO</code> inyectado por <code>doGet()</code> vía <code>&lt;?= nivel ?&gt;</code>. Si es <code>'lectura'</code>, el frontend muestra un aviso naranja (\"🔒 Modo solo lectura\") y la función <code>bloqueadoPorLectura()</code> corta el submit antes de llamar al servidor — pero la validación real de fondo tiene que estar también del lado del servidor (con <code>AuthLib.validarAccion</code>), nunca confiar solo en este bloqueo del cliente."
          },
          {
            titulo: "Despacho por lote (Módulo 5)",
            texto: "<code>procesarDespachoLoteM5(datos)</code> soporta despacho parcial por ítem dentro de un mismo lote — cada ítem puede quedar \"Completo\" o \"Parcial\" independientemente, y el remito se acumula (columna O) sin pisar despachos anteriores del mismo lote."
          },
          {
            titulo: "Reparaciones",
            texto: "Una cuba \"en reparación\" es la que tiene Fecha de ingreso (columna W) cargada pero Fecha de egreso (columna Z) vacía. El alta y el egreso de reparación usan remitos y observaciones separados (columnas V/X para ingreso, Y/AA para egreso)."
          },
          {
            titulo: "Otras pestañas",
            texto: "PENDIENTES (mismo esquema que Cubas, ~28.000 filas — cubas con algún paso sin cerrar), PENDIENTES RESUMEN (agregado por OC/Modelo con prioridad), Para Enviar (hoja de ruta de despacho por chofer y posición en el camión)."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Cargar una nueva Orden de Trabajo", texto: "En la pestaña \"1. Cargar Orden\": completar OT, Cliente, elegir Modelo de la lista, y la Cantidad de cubas a fabricar. El contador de \"Series Disponibles\" arriba a la derecha se actualiza en vivo." },
          { titulo: "Si faltan números de serie", texto: "El sistema avisa antes de dejarte guardar y te lleva directo a la pestaña 2 con un botón — no hace falta buscar el otro formulario a mano." },
          { titulo: "Cargar stock de series — por rango", texto: "En \"2. Cargar Stock Series\", con \"Consecutivos (Rango)\" marcado: completar \"Desde el número\" y \"Hasta el número\" para cargar un bloque consecutivo." },
          { titulo: "Cargar stock de series — con saltos", texto: "Marcar \"Con Saltos (Listado separado por comas)\" y escribir o pegar los números sueltos, separados por coma (ej: 5020, 5021, 5035, 5040)." },
          { titulo: "Guardar", texto: "Al guardar el stock, el contador se refresca solo y el sistema vuelve automáticamente a la pestaña de carga de orden después de 1.5 segundos." }
        ],
        nota: "Esto documenta solo la Generación de OT y Carga de Stock de Series (Módulos 1 y 2). El resto de los formularios de Cubas (seguimiento logístico de materiales, despacho por lote, reparaciones) todavía no se relevaron con el código real — pendiente."
      }
    },

    {
      id: "tablero-produccion",
      categoria: "Planificación y Logística",
      nombre: "Tablero de Producción",
      estado: "activo",
      resumen: "Control operativo completo: estado por OC/etapa, asignación de tareas, prioridades, ranking de operarios y disponibilidad.",
      tecnico: {
        intro: "Módulo 7 del hub (<code>?v=tablero-produccion</code>). Vive en el mismo proyecto de Apps Script que Órdenes, Materiales, Despachos y Dashboard (\"Cubas\") — confirmado por el menú <code>onOpen()</code>, que lista los 5 formularios como ítems 1 a 5 de un solo menú \"⚙️ Sistema Mayo\". Es el módulo con más lógica de negocio de todo el sistema.",
        bloques: [
          {
            titulo: "Corrección: funciones reales del backend",
            texto: "La documentación anterior de este módulo mencionaba <code>marcarTareaEnProceso()</code> — esa función <b>no existe</b>. Las funciones reales son: <code>obtenerDatosTableroProduccion()</code>, <code>obtenerOperariosParaAsignacion()</code>, <code>obtenerPersonalParaBaja()</code>, <code>asignarTareaAProduccion()</code>, <code>completarTareaIndividual()</code>, <code>darDeBajaTarea()</code>, <code>guardarPrioridadOC()</code>, <code>obtenerRankingOperariosParaTarea()</code>, <code>obtenerDisponibilidadOperarios()</code>, <code>generarPdfAsignaciones()</code>, y <code>marcarTareasCompletasEnLote()</code> (esta última existe en el backend pero no está conectada a ningún botón visible del HTML — posible herramienta de uso manual desde el editor)."
          },
          {
            titulo: "Fuente de datos: TAREAS 2026, no la hoja Cubas",
            texto: "A diferencia de los otros 5 formularios del proyecto (que trabajan sobre la hoja \"Cubas\"), el Tablero de Producción lee de <b>otro spreadsheet</b>: <code>1HFBUjxS_fwq8yqrMs0ImobyK2uo-SEaTvAAQgwCJK4o</code> (el mismo ID que ya conocíamos como \"TAREAS 2026\"). ⚠ <b>Ojo con el nombre de hoja</b>: <code>obtenerDatosTableroProduccion()</code> busca la pestaña <code>\"Tareas\"</code> (con mayúscula solo la T), pero <code>getKpisProduccion()</code> busca <code>\"TAREAS\"</code> (todo mayúsculas) — <code>getSheetByName</code> es sensible a mayúsculas/minúsculas. Si el nombre real de la pestaña no coincide exactamente con una de las dos, esa función devuelve error en silencio. A confirmar cuál es el nombre real."
          },
          {
            titulo: "Mapeo de OT a Tipo de Producto",
            texto: "<code>tipoProducto(mod)</code> deriva el tipo a partir de los primeros 2 dígitos del código de modelo: <code>10,12,13,14,16,17,18,19 → Distribución</code>; <code>11 → Rurales</code>; <code>15 → Potencia</code>; <code>90</code> → Herrajes si el código de modelo tiene 4 caracteres o menos, si no Accesorios. Las filas de TAREAS sin OT se agrupan bajo la OC ficticia <code>\"HERRAJES\"</code>."
          },
          {
            titulo: "ETAPAS_POR_TIPO — configuración real de etapas y secuencia",
            texto: "Cada tipo de producto tiene su propio set de etapas, cada una definida por un rango de Cód. Tarea (<code>min</code>/<code>max</code>), más códigos sueltos fuera de rango que igual pertenecen a esa etapa (<code>extra</code>) o que hay que excluir aunque caigan dentro del rango (<code>excluir</code>). El campo <code>secuencia</code> es un número fijo, hardcodeado a mano por el desarrollador (no calculado) — define el orden lógico de producción real."
          },
          {
            titulo: "Distribución y Potencia (comparten la misma config)",
            tabla: [
              ["1", "Fondo", "5110–5145"],
              ["2", "Brida", "5150–5164 + extra 5190"],
              ["2", "Patas/Costillas", "5165–5182 (misma secuencia que Brida — son paralelas)"],
              ["3", "Tanque", "5191–5202 + extra 5185, 5591, 5601"],
              ["4", "Paneles", "5210–5260"],
              ["4", "Tapa", "5510–5564 (misma secuencia que Paneles)"],
              ["5", "Accesorios", "5565–5605, excluye 5580, 5591, 5601 (esos van a Tanque/Terminación)"],
              ["6", "Armado Cuba", "5310–5410"],
              ["7", "Terminación", "5700–5910 + extra 5580"]
            ]
          },
          {
            titulo: "Rurales / Herrajes / Accesorios",
            texto: "<b>Rurales</b> tiene su propia secuencia más corta (1 a 5): Tacho (5110–5145) → Suncho (5150–5164) → Paneles/Tapa-Accesorios (secuencia 3, en paralelo) → Armado Cuba (5310–5410) → Terminación (5700–5910). <b>Herrajes y Accesorios NO tienen campo <code>secuencia</code></b> en absoluto — por eso no participan de la lógica de \"alerta de salto\" ni de \"qué frena\", que dependen exclusivamente de ese campo."
          },
          {
            titulo: "Semáforo de Materia Prima — lógica real (leerCubasParaTablero_)",
            texto: "Se calcula cruzando cada OC+Modelo contra la hoja Cubas (columna J = Estado_Recepción). Por cada unidad física de esa OC+Modelo en Cubas: si Estado=\"Completo\" cuenta como completa; si Estado=\"Parcial\" cuenta como parcial (y extrae el texto entre corchetes <code>[...]</code> de la columna Q como detalle); cualquier otro valor cuenta como \"roja\" (sin ingresar). <b>Color final</b>: rojo si hay al menos una unidad sin ingresar, si no amarillo si hay al menos una parcial, si no verde. <b>Gris</b> = esa OC+Modelo no tiene ningún registro en Cubas. <b>Error</b> (⚠ naranja) = la OC existe en Cubas pero con un Modelo distinto al que figura en TAREAS para esa misma OC — señal de que hay que revisar la carga, no un problema real de stock."
          },
          {
            titulo: "asignarTareaAProduccion({numFila, activar, operario, token})",
            texto: "Escribe directo en TAREAS 2026: columna T (\"X\"), columna U (fecha/hora actual), columna V (nombre del operario) al asignar; las vacía las tres al quitar. Requiere <code>AuthLib.validarAccion(token, 'tablero-produccion', 'edicion')</code> — candado real del servidor, no solo ocultamiento de botones en el cliente."
          },
          {
            titulo: "completarTareaIndividual(numFila, token)",
            texto: "Marca columna P (\"X\") y limpia columna T — la tarea deja de figurar \"en proceso\" y pasa a completada, sin pasar por Carga de Tiempos."
          },
          {
            titulo: "darDeBajaTarea({numFila, motivo, operarioBaja, token})",
            texto: "Marca columna P (\"X\", cuenta como completada a efectos de progreso), y escribe el motivo con timestamp en columna W (<code>[BAJA dd/MM/yyyy HH:mm]: motivo</code>) y quién autorizó en columna X. El padrón de <code>operarioBaja</code> viene de <code>obtenerPersonalParaBaja()</code>, que a diferencia de <code>obtenerOperariosParaAsignacion()</code> <b>no excluye</b> legajo ≥800 — puede ser un supervisor de oficina quien autorice, no solo un operario de planta."
          },
          {
            titulo: "guardarPrioridadOC(oc, modelo, valor, tipoProd, token)",
            texto: "Guarda en una hoja propia <code>Prioridades_OC</code> (se autocrea si no existe), con columnas OC/Modelo/TipoProd/Prioridad/ActualizadoPor/Fecha — busca si ya existe la fila para esa OC+Modelo y la actualiza, si no la agrega nueva. Registra automáticamente el email de quien hizo el cambio (<code>Session.getActiveUser()</code>) y la fecha."
          },
          {
            titulo: "Ranking de operarios — fórmula real de scoring",
            texto: "Combina dos fuentes de desviación de tiempo estándar: la hoja TIEMPOS (columna U, año actual) y una hoja \"Histórico\" (2023–2025) cacheada 12hs, dentro de una <b>ventana móvil de 2 años</b> hacia atrás desde hoy. Fórmula: <code>confiabilidad = 0.7 × min(cantidadTareas / 20, 1) + 0.3 × (1 − tasaNC)</code>, donde <code>tasaNC = min(cantidadNC / cantidadTareas, 1)</code>. <code>scoreFinal = desviaciónPromedio − (0.10 × confiabilidad)</code> — <b>menor score es mejor</b>. Con menos de 3 tareas registradas (<code>UMBRAL_MUESTRA_MINIMA</code>), el operario queda marcado <code>muestraInsuficiente</code> y no compite en el ranking principal. Las NC se cuentan desde RG-CA-02 (Índice Maestro), mismo código de operación, misma ventana de 2 años. Solo se rankean operarios <b>actualmente activos</b> y de planta (legajo &lt;800)."
          },
          {
            titulo: "Disponibilidad — algoritmo real de proyección de ETA",
            texto: "Jornada laboral fija: 7:00 a 15:48 (<code>HORA_INICIO_LABORAL</code>/<code>HORA_FIN_LABORAL</code> en minutos), de lunes a viernes. Toma todas las tareas con columna T=\"X\" y P≠\"X\" por operario, cruza el tiempo estándar contra una hoja \"Consolidado\" externa (cacheada 6hs) usando la clave Modelo+CódTarea concatenados — si no hay estándar para esa combinación, la tarea queda fuera de la proyección y suma al contador <code>sinEstimacion</code>. Para la primera tarea de la cola, calcula cuánto tiempo laboral ya transcurrió desde que se asignó y resta al estimado (con 5% de tolerancia antes de marcar \"atrasada\"); las siguientes tareas de la cola usan su tiempo estimado completo, encadenadas una tras otra. <code>avanzarMinutosLaborales_()</code> es la función que \"salta\" fines de semana y horas fuera de jornada al proyectar el ETA final."
          },
          {
            titulo: "Alertas de Secuencia — cómo se calculan (calcularAlertaSecuencia_)",
            texto: "Agrupa las etapas de esa OC por su número de <code>secuencia</code> (las de igual número son paralelas entre sí, no se alertan mutuamente). Recorre las secuencias de menor a mayor: si una secuencia posterior tiene al menos una tarea completada mientras una secuencia anterior todavía no está 100% completa, genera una alerta. <b>Solo se calcula si la OC todavía tiene <code>pendienteEnvio &gt; 0</code></b> — si ya se despachó, lo que haya pasado en el orden de producción ya es historia y no genera ruido en el tablero."
          },
          {
            titulo: "\"Pendiente de Envío\" — de dónde sale el número",
            texto: "<code>cantReal</code> (la mayor entre la cantidad declarada en TAREAS y la cantidad de series/OT distintas realmente vistas para esa OC+Modelo — detecta OC \"divididas\" en más cubas físicas de las declaradas) menos la cantidad ya marcada como despachada en la hoja Cubas (columna S = 1), cruzando por OC+Modelo."
          },
          {
            titulo: "PDF de asignaciones",
            texto: "<code>generarPdfAsignaciones(lista)</code> arma una tabla HTML (OT/OC/Modelo/Etapa/Tarea/Serie/Operario/Fecha) y la convierte a PDF, que se guarda automáticamente en Google Drive dentro de <code>Mayo/Despachos</code> (misma carpeta que usan los PDFs de despacho del Módulo 5) con permiso de visualización abierto por link."
          },
          {
            titulo: "Permisos: claves de módulo reales (hoja Accesos)",
            texto: "Cada sub-formulario de este proyecto usa su propia <code>moduloKey</code> en <code>AuthLib.validarAccion()</code>, no una única clave \"cubas\": <code>ordenes</code>, <code>materiales</code>, <code>despachos</code>, <code>tablero-produccion</code>. Dashboard y Tiempos <b>no tienen candado</b> — el propio código lo aclara explícitamente (\"esos no tienen candados\"), consistente con que Dashboard es de solo lectura."
          },
          {
            titulo: "⚠ Hallazgo — dos tablas de tipo de cuba que no coinciden",
            texto: "<code>obtenerCodigoPorPrefijo(\"11\")</code> devuelve <code>\"\"</code> (vacío), pero <code>getTipoCuba</code> con el mismo prefijo <code>\"11\"</code> devuelve <code>\"PRENSA\"</code> — son dos funciones de mapeo modelo→tipo casi idénticas pero con al menos esa discrepancia. Candidatas a unificar."
          },
          {
            titulo: "POR_TIPO — confirmado, parece no usarse en el cliente",
            texto: "El backend sí arma y devuelve <code>porTipo</code> (agrupa <code>resultado</code> por <code>tipoProd</code>), pero el HTML del Tablero solo usa <code>filas</code>/<code>DATA</code> y hace su propio agrupamiento del lado del cliente en <code>filtrar()</code>. Es más probable que sea dato no utilizado (el cliente no necesita que el servidor se lo pre-agrupe) que un consumidor externo — pero queda como algo a confirmar si aparece relevante más adelante."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Ver el estado general", texto: "El tablero se agrupa por tipo de producto (Distribución, Potencia, Rurales, Herrajes, Accesorios). Cada OC muestra su progreso por etapa con un semáforo de color: verde=completo, violeta=asignado, amarillo=en curso, rayado=mixto, rojo=pendiente." },
          { titulo: "Filtrar", texto: "Por OC, Modelo, Estado (en curso / completados / sin iniciar) o Tipo de producto." },
          { titulo: "Revisar el semáforo de insumos", texto: "Cada fila tiene un punto de color (verde/amarillo/rojo/gris) que indica el estado de la materia prima — pasar el mouse muestra el detalle." },
          { titulo: "Asignar una tarea", texto: "Click en una celda de etapa → se abre el modal con todas las tareas de esa etapa. En cada tarea pendiente, elegir un operario del desplegable y \"▶ Asignar\"." },
          { titulo: "Quitar una asignación", texto: "En una tarea ya asignada, botón \"✕ Quitar\" (pide confirmación)." },
          { titulo: "Completar manualmente", texto: "En una tarea asignada, botón \"✔ Marcar Completado\" — para casos donde no se cargó por Carga de Tiempos." },
          { titulo: "Dar de baja una tarea", texto: "Botón \"🚫 Dar de Baja\" en una tarea pendiente — elegir quién autoriza (incluye personal de oficina) y escribir el motivo, obligatorio." },
          { titulo: "Asignar prioridad a una OC", texto: "En Sugerencias/Alertas → tablas de Prioridad de Producción (Distribución/Potencia): escribir un número en la columna Prioridad de la fila correspondiente (1 = más urgente)." },
          { titulo: "Ver qué frena una OC", texto: "En esas mismas tablas, botón \"▾ Ver qué frena\" — muestra la primera etapa (en orden de secuencia) que tiene tareas realmente sin asignar, y permite asignar directo desde ahí con sugerencia de ranking." },
          { titulo: "Buscar ranking de operarios para una tarea", texto: "En Sugerencias/Alertas, escribir el código de tarea (ej. 5150) y Buscar — muestra a los operarios recomendados, ordenados de mejor a peor desempeño histórico en esa tarea puntual." },
          { titulo: "Ver disponibilidad de todos los operarios", texto: "Botón \"📋 Disponibilidad de Operarios\" en el header — lista completa ordenada de más libre a más ocupado, con semáforo 🟢 libre / 🟡 en curso / 🔴 atrasado." },
          { titulo: "Revisar personal ausente", texto: "La tarjeta roja \"Personal Faltante\" en la fila de KPIs es clickeable — abre el detalle de quién falta hoy y el motivo." },
          { titulo: "Armar y generar el PDF de asignaciones", texto: "Cada asignación que hacés durante la sesión se suma a la barra inferior. \"📋 Ver lista\" abre el detalle para elegir cuáles imprimir; \"📄 Generar PDF\" arma la hoja de asignación para entregar a producción." }
        ]
      }
    },

    // =================================================================
    // PENDIENTES DE DOCUMENTAR
    // =================================================================
    // (Generación de OTs — confirmado que ES FormularioOrdenes, ya documentado
    // arriba en el módulo "Cubas". No es un módulo aparte, se sacó el stub
    // duplicado que existía acá por error.)
    {
      id: "materiales",
      categoria: "Planificación y Logística",
      nombre: "Logística de Materiales (FormularioMateriales)",
      estado: "activo",
      resumen: "Pedido de chapa a proveedor (Plegado-OC) y registro de su recepción física en planta, por número de serie.",
      tecnico: {
        intro: "Módulos 3 y 4 del proyecto <b>Cubas</b> (mismo spreadsheet <code>1cjV4eFwRRXwlCoMiQ-BhdB-RzMKZ3S-Ns4bQA71vuMQ</code>, hoja \"Cubas\", <code>HOJA_MAESTRA</code>) — no es un proyecto aparte, es otro formulario dentro del mismo código que ya administra órdenes y series (ver página Cubas). El botón del hub (\"Logística de Materiales\", <code>?v=materiales</code>) apunta a la URL del router principal — no se confirmó todavía si internamente reenvía a este mismo código de Cubas o si hay una capa intermedia; a chequear si hace falta tocar el routing en algún momento.",
        bloques: [
          {
            titulo: "Módulo 3 — Cargar Pedido (OC)",
            texto: "<code>obtenerOtsParaPedidoOC()</code> filtra las OT que están en planta (columna P \"Fecha - Envío\" vacía = todavía no salió a producción) y que <b>no</b> tienen OC de plegado asignada (columna G vacía) — esas son las que califican para pedir chapa. <code>registrarPedidoMaterial({ot, oc, fecha, token})</code> guarda el Nº de OC y la fecha de pedido contra esa OT."
          },
          {
            titulo: "Módulo 4 — Registrar Recepción (Remito)",
            texto: "Flujo en cascada de tres pasos: <code>obtenerOtsParaRecepcionRto()</code> trae las OC únicas con recepción pendiente → al elegir una, <code>obtenerModelosPorOc(ocSel)</code> trae los modelos que tiene esa OC → al elegir un modelo, <code>obtenerSeriesPorOcYModelo(ocSel, modSel)</code> trae los números de serie puntuales pendientes de ese modelo (cada uno con <code>numFila</code>, <code>serie</code>, <code>ot</code>), para tildar cuáles llegaron físicamente. Mismo patrón de \"tildar todo el bloque\" que ya usa RG-CA-03."
          },
          {
            titulo: "registrarIngresoMateriaPrimaPorItems(datos)",
            texto: "Recibe <code>filasAfectadas</code> (array de <code>numFila</code> de las series tildadas), <code>remito</code>, <code>fecha</code>, <code>tipo</code> (\"Completo\" o \"Parcial\") y <code>detalleFaltante</code> si es parcial. Marca la recepción a nivel de cada serie individual, no a nivel de OC completa — permite que una OC llegue en varias tandas parciales sin perder trazabilidad de qué unidades específicas ya entraron."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Pedir chapa a proveedor (pestaña 3)", texto: "Elegir la Orden de la lista (solo aparecen las que están en planta y todavía no tienen OC de plegado asignada), completar el Nº de Orden de Compra y la fecha de pedido, y confirmar." },
          { titulo: "Elegir la OC a recibir (pestaña 4)", texto: "Seleccionar la OC activa de la lista." },
          { titulo: "Elegir el modelo dentro de esa OC", texto: "Aparece un segundo desplegable (resaltado en azul) con los modelos disponibles en ese pedido." },
          { titulo: "Tildar las series que llegaron", texto: "Se despliega la lista de números de serie pendientes de ese modelo. Tildar los que efectivamente llegaron, o usar \"Tildar Todo el Bloque\" si entró completo." },
          { titulo: "Completar remito y fecha", texto: "Nº de Remito del Proveedor y fecha de recepción." },
          { titulo: "Marcar si llegó completo o con faltante", texto: "Si hay faltante, se habilita un campo obligatorio para describirlo." },
          { titulo: "Confirmar ingreso", texto: "Registra la recepción física a nivel de cada serie tildada." }
        ]
      }
    },
    {
      id: "despachos",
      categoria: "Planificación y Logística",
      nombre: "Despachos y Reparaciones (FormularioDespachos)",
      estado: "activo",
      resumen: "Despacho en lote por número de serie (con parciales por ítem) y trazabilidad de reparaciones.",
      tecnico: {
        intro: "Módulo 5 del proyecto Cubas — mismo spreadsheet que Órdenes/Stock de Series y Logística de Materiales. Formulario con dos solapas: A. Despacho en Lote, B. Control de Reparación.",
        bloques: [
          {
            titulo: "buscarCubaPorSerieModulo5(serie, token)",
            texto: "Función compartida por las dos solapas — busca una cuba por Nº de Serie y devuelve su estado completo: <code>modelo</code>, <code>orden</code>, <code>cliente</code>, <code>enReparacion</code> (ingreso sin egreso todavía), <code>yaDespachada</code> (Estado de Despacho = \"Completo\"), <code>esParcial</code> (Estado de Despacho = \"Parcial\"), y el código de tipo de cuba (D/PRENSA/D AL/DI AL/DI/ST/DIM AL/DIM, según prefijo de modelo — ver tabla en la página Cubas)."
          },
          {
            titulo: "Solapa A — Despacho en Lote",
            texto: "Se escanea o tipea un Nº de Serie, Enter (o botón Agregar) lo suma a la \"Lista de Embarque\" del camión. Si la serie está en reparación activa o ya fue despachada completa, se bloquea con aviso. Si tiene un despacho parcial previo, se permite agregar igual pero queda marcada con la etiqueta \"Parcial prev.\" en la lista. Cada ítem de la lista tiene su propio radio Completo/Parcial — si se marca Parcial, exige una observación de qué componentes salen (ej. \"Cuba, Tanque\") antes de poder confirmar."
          },
          {
            titulo: "procesarDespachoLoteM5(datos)",
            texto: "Recibe <code>remito</code>, <code>filasAfectadas</code> (array de <code>numFila</code>) e <code>itemsDetalle</code> (array con <code>numFila</code>, <code>serie</code>, <code>estadoItem</code>, <code>observaciones</code> por cada pieza). Genera un PDF del comprobante y devuelve <code>{status, mensaje, urlPdf, identificador}</code> — el PDF se abre automáticamente en una pestaña nueva al confirmar."
          },
          {
            titulo: "Solapa B — Control de Reparación (ingreso/egreso)",
            texto: "Al verificar una serie, el formulario cambia de comportamiento según el estado actual de esa cuba: si <b>no</b> está en reparación, arma un formulario de <b>ingreso</b> (Remito de Reingreso → columna V, Detalle del Defecto → columna X, botón ámbar). Si <b>ya</b> está en reparación, arma un formulario de <b>egreso/alta</b> (Remito de Egreso → columna Y, Solución Técnica Aplicada → columna AA, botón verde). Mismo formulario HTML, distinto texto/color/columnas de destino según el estado detectado."
          },
          {
            titulo: "procesarRegistroReparacionM5(datos)",
            texto: "Recibe <code>numFila</code>, <code>operacion</code> (\"ingreso\" o \"egreso\", seteada automáticamente por <code>verificarSerieReparacion</code>), <code>serie</code>, <code>remito</code>, <code>observaciones</code>. Igual que el despacho, genera un PDF técnico y devuelve <code>urlPdf</code> + <code>identificador</code>."
          },
          {
            titulo: "Compartir comprobante (WhatsApp / Email)",
            texto: "Después de generar cualquiera de los dos PDFs, <code>prepararBloqueCompartir(urlPdf, identificador)</code> arma dos links: uno a <code>api.whatsapp.com/send?text=...</code> (abre WhatsApp Web o la app según el dispositivo) y otro <code>mailto:</code> — ambos con el link de descarga del PDF ya redactado en el mensaje."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Despacho en lote — escanear piezas", texto: "En la solapa \"A. Despacho en Lote\", escanear o tipear cada Nº de Serie y Enter. Se van sumando a la lista de embarque del camión." },
          { titulo: "Marcar completo o parcial por pieza", texto: "Cada pieza de la lista tiene su propio Completo/Parcial. Si sale parcial, hay que anotar qué componentes van (ej: \"Cuba, Tanque\") — es obligatorio, no deja confirmar sin eso." },
          { titulo: "Cargar el remito y confirmar", texto: "Completar el Nº de Remito de Salida y confirmar — se genera el PDF automáticamente y se abre en una pestaña nueva." },
          { titulo: "Compartir el comprobante", texto: "Después de confirmar aparecen botones directos a WhatsApp y Email con el link del PDF ya cargado en el mensaje." },
          { titulo: "Reparaciones — verificar una serie", texto: "En la solapa \"B. Control de Reparación\", escanear o tipear el Nº de Serie y Verificar." },
          { titulo: "Si la pieza no estaba en reparación", texto: "Se abre el formulario de ingreso: cargar el Remito de Reingreso y el Detalle del Defecto detectado." },
          { titulo: "Si la pieza ya estaba en reparación", texto: "Se abre automáticamente el formulario de egreso/alta: cargar el Remito de Egreso y la Solución Técnica aplicada." },
          { titulo: "Guardar", texto: "Genera el PDF técnico correspondiente y ofrece los mismos botones de compartir por WhatsApp/Email." }
        ]
      }
    },
    {
      id: "dashboard-general",
      categoria: "Planificación y Logística",
      nombre: "Tablero de Control de Despacho (FormularioDashboard)",
      estado: "activo",
      resumen: "Métricas de despacho: volumen mensual, mix de modelos, eficiencia logística y concentración de clientes.",
      tecnico: {
        intro: "Confirmado: es el <b>Módulo 6</b> del proyecto Cubas (mismo spreadsheet que Órdenes, Materiales y Despachos) — el botón del hub \"Tablero de Control de Despacho\" (<code>?v=dashboard</code>). <b>No confundir con el Tablero de Producción</b> (Módulo 7, otro proyecto, agrupa por OC+Modelo+estado de tarea) — este es puramente analítico/de solo lectura, sin ninguna función de escritura.",
        bloques: [
          {
            titulo: "obtenerMetricasDashboardM6()",
            texto: "Única llamada al servidor de todo el módulo — trae de una vez <code>anos</code> (para el filtro), <code>volumenProduccion</code> (cubas despachadas por período-modelo), <code>tiemposLogistica</code> (días promedio entre pedido y recepción de plegados) y <code>analisisClientes</code> (unidades por cliente y período). Todo se calcula del lado servidor recorriendo la hoja Cubas una sola vez; el filtrado por año/mes se hace después, en el cliente, sin volver a golpear el servidor — por eso los filtros responden instantáneo."
          },
          {
            titulo: "Los 4 gráficos (Chart.js)",
            texto: "<b>Cantidades Despachadas Mensuales</b> (línea): total de cubas por mes, con el label KPI del total del período filtrado arriba a la derecha. <b>Modelos de Cuba Despachados</b> (dona): mix de modelos del período filtrado. <b>Eficiencia Logística de Proveedores</b> (barras): promedio de días entre fecha de pedido y fecha de recepción del plegado — mide qué tan rápido responden los proveedores de chapa. <b>Concentración de Clientes</b> (barras): unidades despachadas por cliente en el período."
          },
          {
            titulo: "Sin sesión ni permisos de escritura",
            texto: "A diferencia de los otros 5 formularios de Cubas, este <b>no</b> usa el patrón <code>TOKEN_SESION</code>/<code>NIVEL_USUARIO</code>/<code>bloqueadoPorLectura</code> — no hace falta, porque no hay ningún <code>google.script.run</code> que escriba nada, es 100% lectura y visualización."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Filtrar por año", texto: "El desplegable de años se completa solo con los años que realmente tienen datos en Cubas." },
          { titulo: "Filtrar por mes", texto: "Se puede combinar con el filtro de año, o dejar \"Todos los Meses\" para ver el año completo." },
          { titulo: "Leer el KPI de total despachado", texto: "Arriba a la derecha del primer gráfico, muestra la suma de unidades del período filtrado actual." },
          { titulo: "Interpretar Eficiencia Logística", texto: "Cuanto más bajo el promedio de días, más rápido están respondiendo los proveedores de chapa en ese período." }
        ]
      }
    },
    {
      id: "desempeno-tiempos",
      categoria: "Ejecución en Planta",
      nombre: "Desempeño de Tiempos",
      estado: "activo",
      resumen: "Análisis de desviación de tiempos por operario, código y modelo — combina el histórico congelado (2023-2025) con TIEMPOS en vivo (2026).",
      tecnico: {
        intro: "Corrección de un dato viejo: este módulo <b>ya no corre en Netlify</b> — está migrado a Apps Script como el resto, con el mismo patrón <code>doGet</code> + <code>AuthLib.validarSesion</code>/<code>tienePermiso</code> (permiso <code>\"desempeno-tiempos\"</code>). El HTML (<code>DashboardEnVivo.html</code>) es un dashboard de análisis muy elaborado (~2200 líneas) con su propia paleta de colores basada en variables CSS — ajustada al lenguaje visual Sistema Mayo en fondo/paneles/bordes/texto, pero <b>sin tocar los colores semánticos</b> (azul=neutro, verde=bien, ámbar=atención, rojo=mal) que el propio dashboard usa para comunicar la calidad del dato, no como decoración de marca.",
        bloques: [
          {
            titulo: "Dos fuentes de datos combinadas",
            texto: "<code>obtenerRegistrosDashboard()</code> junta dos orígenes: el <b>histórico congelado</b> 2023-2025 (planilla <code>1gzW1747nhiYrzEdWRDj_98Tr2NJ5Gr0H_4rns7YkwSI</code>, hoja \"Historico\") y <b>TIEMPOS en vivo</b> 2026 (la misma planilla TIEMPOS de siempre). Ambos pasan por el mismo mapa de normalización de nombres antes de combinarse, para que un mismo operario nunca aparezca duplicado como dos entradas distintas por una diferencia de formato entre las dos fuentes."
          },
          {
            titulo: "Normalización de nombres — única fuente de verdad",
            texto: "<code>normNameDashboard_(v)</code> limpia el texto crudo (saca legajo, comas dobles, espacios) y lo pasa por un diccionario de variantes conocidas (<code>NAME_MAP_DASHBOARD_</code>) para unificar errores de tipeo históricos (ej. \"CASTRO WILLIAM\" → \"CASTRO, WILLIAM\", \"CAMUSSA, LUIS\" → \"CAMUSSA, LUCAS\"). <code>construirLegajoPorNombreDesdeTextos_()</code> arma un mapa único {nombre limpio → legajo} combinando las dos fuentes juntas, y <code>nombreCanonico_()</code> arma el texto final a mostrar (\"legajo - Nombre\" si hay legajo, si no, solo el nombre) — todo lo que este módulo muestra como nombre de operario pasa por estas mismas tres funciones, tanto en el dashboard principal como en Tiempos Muertos."
          },
          {
            titulo: "Filtros de calidad de dato al combinar",
            texto: "Al armar los registros del año en vivo, se descartan filas con Desviación fuera de ±300% (dato corrupto o tiempo estándar mal cargado) y con Tiempo Estándar vacío. La Desviación se guarda como <b>fracción</b> (0.03 = 3%), igual que la columna U real de TIEMPOS — el propio dashboard multiplica por 100 en sus funciones de promedio, nunca hay que multiplicarla antes de mandarla."
          },
          {
            titulo: "Tiempos Muertos — huecos sin tarea registrada",
            texto: "<code>obtenerTiemposMuertos()</code> arma, por operario y fecha, los intervalos de tarea real cargados en TIEMPOS, y calcula los \"huecos\" (≥10 minutos sin ninguna tarea activa) dentro de las ventanas horarias esperadas de cada tipo de día: <b>laboral</b> (7:00–15:48, con posible margen de entrada/salida temprana/tardía como \"extra\"), <b>sábado</b> (7:00–12:00, todo cuenta como extra), <b>feriado</b> (6:00–15:00, todo extra). Los descansos institucionales fijos (desayuno 9:00–9:15, almuerzo 13:00–13:30) se descuentan de cualquier hueco calculado — nunca cuentan como tiempo muerto."
          },
          {
            titulo: "Checkpoints de entrada/salida con tolerancia",
            texto: "<code>calcularCheckpointEntrada_()</code>/<code>calcularCheckpointSalida_()</code> redondean el horario real cargado a \"checkpoints\" fijos con 10 minutos de margen (ej. si el fin cargado es 15:52, se toma como checkpoint 15:48 — dentro de tolerancia, no genera hueco de \"extra\"; recién a partir de cierto margen salta al siguiente checkpoint, 16:48 o 17:48) — evita que pequeñas imprecisiones de carga generen huecos falsos."
          },
          {
            titulo: "Feriados — misma fuente que Empleado del Mes",
            texto: "<code>obtenerFeriados_()</code> lee (o crea, si no existe) la hoja \"Feriados\" en la planilla RRHH — Legajos, la misma que usa el cálculo de Empleado del Mes. Si la hoja no existe, la auto-crea precargada con el calendario 2026 completo — único punto de escritura de todo este módulo, y es un bootstrap idempotente, no una acción de usuario."
          },
          {
            titulo: "Reporte individual por operario (obtenerReporteTiemposOperario)",
            texto: "Arma, para un operario y mes puntual, el detalle día por día de tareas y huecos, separando minutos muertos en horario normal vs. extra. Usa <code>limpiarNombreParaAgrupar_()</code> para el desplegable de selección — agrupa todas las variantes de escritura del mismo operario bajo una sola entrada, mostrando el legajo si se encontró en alguna variante."
          },
          {
            titulo: "Bloque de datos embebido — no tocar",
            texto: "El HTML tiene un bloque <code>&lt;script type=\"application/json\" id=\"dasv-slot\"&gt;</code> con un string base64/comprimido enorme — es un dataset de respaldo para pruebas locales sin conexión al servidor. No tiene relación con la lógica en vivo ni con el estilo; se dejó completamente intacto en el restyle."
          },
          {
            titulo: "⚠ Botones del header — cuáles son reales hoy y cuáles son de la época de Netlify",
            texto: "El dashboard nació como una herramienta de escritorio: subías un Excel, generaba un HTML con todos los datos incrustados adentro, y ese HTML se subía a mano a Netlify. Cuando se migró a Apps Script con datos en vivo, esas funciones viejas <b>no se borraron</b> — quedaron conviviendo con la nueva. Hoy, al abrir el dashboard, aparecen <b>tres botones juntos</b> en el header:"
          },
          {
            titulo: "🔄 \"Actualizar en vivo\" — el único que hace algo útil hoy",
            texto: "Llama a <code>obtenerRegistrosDashboard()</code> del servidor y reconstruye todo el dashboard con los datos más frescos de TIEMPOS, sin recargar la página. Es el equivalente a \"traeme los números de ahora mismo\". <b>Es el único de los tres botones que tiene sentido usar en el día a día.</b>"
          },
          {
            titulo: "⬆ \"Actualizar datos\" y 💾 \"Guardar HTML\" — vestigios de la era Netlify, hoy sin uso real",
            texto: "\"Actualizar datos\" abre el modal viejo para subir un archivo Excel a mano (pensado para reemplazar el año completo). \"Guardar HTML\" genera un archivo único con todos los datos incrustados, pensado para subirlo manualmente a Netlify como <code>index.html</code> — el propio código lo dice en su tooltip (\"Ese archivo se puede subir solo a Netlify\"). <b>Ninguno de los dos tiene sentido con el esquema actual</b>: los datos ya vienen solos desde TIEMPOS, y ya no hay ningún Netlify al que subir nada. Quedaron ahí porque nunca se sacó ese código al migrar — no es que cumplan una función oculta, es código muerto todavía conectado a botones visibles. <b>No los toqué</b> (pediste no modificar mucho) — si en algún momento querés que los oculte o los saque del todo, es un cambio chico y lo puedo hacer aparte, avisando primero."
          },
          {
            titulo: "✔ El filtro de operarios por año YA funciona — confirmado en el código",
            texto: "La función <code>reconstruirListaOperariosPorAnio(anio)</code> reconstruye la lista de checkboxes de operarios mostrando <b>solo</b> a quienes tienen algún registro en el año elegido — se dispara automáticamente al tocar los botones rápidos \"2025\" / \"2026\" / \"Ambos\" de la barra lateral (función <code>fy(y)</code>). Es decir: si estás parado en 2026, la lista de operarios ya te muestra solo a los vigentes ese año, sin que tengas que hacer nada más. No es un problema pendiente — es una función que ya resolviste vos (o quien programó esto) y que sigue funcionando bien hoy."
          },
          {
            titulo: "Las 8 pestañas del dashboard — qué muestra cada una",
            texto: "Arriba de los gráficos hay 8 pestañas. Cada una tiene un propósito bien distinto — se explican una por una abajo, con el detalle real de cada gráfico (sacado literal de los títulos y subtítulos que ya tiene el propio dashboard, no inventado)."
          },
          {
            titulo: "1. Resumen — pantalla \"inteligente\", cambia según cuántos operarios elegiste",
            texto: "Si tenés <b>un solo operario</b> tildado en el filtro, el gráfico principal se enfoca 100% en esa persona: evolución mensual, con su mejor mes (verde) y peor mes (rojo) destacados arriba. Si tenés <b>varios operarios</b> tildados, en cambio, se muestra una tabla comparativa con desviación promedio, mejor mes, peor mes, cantidad de registros y estado de cada uno — pensada para comparar al grupo. Es la pestaña que más cambia de forma según el uso: sirve tanto para mostrarle a un operario puntual su propio desempeño, como para que un gerente compare a todo el equipo de un vistazo."
          },
          {
            titulo: "2. Evolución temporal — cómo viene el grupo mes a mes",
            texto: "Seis gráficos: evolución mensual de la desviación promedio del grupo completo; volumen de registros válidos por mes (para saber si un mes con mejor promedio es real o es porque hay poca data); desviación acumulada por mes; evolución de los 5 operarios con más registros; el mínimo mensual del grupo (el mejor desempeño de cada mes, como referencia); el máximo mensual (el peor, como alerta); y una banda que muestra el rango entre mínimo y máximo cada mes — cuanto más ancha esa banda, más disperso está el grupo ese mes."
          },
          {
            titulo: "3. Evolución × operario — la trayectoria de cada persona en el tiempo",
            texto: "Acá es donde se responde \"¿cómo viene fulano en los últimos meses?\": una línea por operario mostrando su evolución mes a mes (con el 0% como referencia del tiempo estándar exacto); un gráfico de barras agrupadas por mes para comparar operarios lado a lado; \"velocidad de cambio\" — cuánto mejoró o empeoró cada uno respecto al mes anterior (verde=mejoró, rojo=empeoró); y el peor mes y mejor mes individual de cada operario, para identificar tanto los picos críticos como el techo real de cada uno."
          },
          {
            titulo: "4. Por operario — la distribución, no solo el promedio",
            texto: "Complementa a \"Evolución × operario\" con una mirada estadística: dispersión de cada operario (el punto es su promedio, las barras el rango entre su mejor y peor registro); desvío mes a mes en barras apiladas; y un histograma que muestra cómo se reparten todos los registros individuales por rango de desviación — la forma de esa distribución dice si el operario es consistente (campana angosta) o irregular (dispersa)."
          },
          {
            titulo: "5. Por tarea — dónde está el problema: ¿en la persona, o en la tarea?",
            texto: "Acá se responde justo lo que preguntaste: <b>para una misma tarea, quién la hace mejor</b>. Incluye: desviación promedio por código de tarea (qué tareas generan más desvío en general, sin importar quién las hace); volumen de mediciones por tarea; desviación por tarea <b>y</b> operario cruzados (cómo varía la misma tarea entre distintas personas); evolución mensual de las 8 tareas más frecuentes (para ver si una tarea puntual está mejorando o empeorando con el tiempo); dispersión mín/prom/máx por tarea (tareas con rango amplio son más impredecibles, quizás por variabilidad del proceso más que del operario); y un <b>radar de desempeño</b> — compara a los 6 operarios más activos contra las 6 tareas más frecuentes en un mismo gráfico: cuanto más chica el área de un operario, mejor su rendimiento general across esas tareas."
          },
          {
            titulo: "6. Mapa de calor — la vista panorámica operario × mes",
            texto: "Una grilla con un operario por fila y un mes por columna — cada celda es la desviación promedio de esa persona ese mes, coloreada de verde oscuro (buen rendimiento) a rojo (alto desvío); celdas vacías son meses sin datos para esa persona. Es la forma más rápida de detectar patrones a simple vista: una fila entera roja señala a alguien con problema sostenido, una columna entera rojiza señala un mes malo para todo el equipo (posible causa externa: material, herramienta, etc.)."
          },
          {
            titulo: "7. 2025 vs 2026 — comparación interanual",
            texto: "Compara, operario por operario, su desempeño de un año contra el otro (solo incluye a quienes tienen datos en ambos años) — azul 2025, violeta 2026. Al lado, la variación exacta (2026 menos 2025: rojo si empeoró, verde si mejoró) y el promedio global de cada año, para ver si el equipo en conjunto mejoró o empeoró de un año al otro."
          },
          {
            titulo: "8. ⏱ Tiempos Muertos — la más importante, ahora también la más visible",
            texto: "Se agregó una clase CSS propia (<code>.tab-tm</code>) que la pinta en ámbar tanto en reposo como activa, distinguiéndola del resto (que quedan en el azul neutro de siempre) — dado lo importante que es (control de horas ociosas, impacto directo en costos), ahora salta a la vista en vez de perderse entre las demás."
          },
          {
            titulo: "Qué muestra Tiempos Muertos exactamente",
            texto: "4 KPIs arriba: tiempo muerto total en jornada normal, tiempo muerto en horas extra, el operario con más tiempo muerto acumulado, y la cantidad de días con algún hueco detectado — todo del período filtrado. Debajo, dos rankings en gráfico de barras (tiempo muerto en jornada normal, y por separado en horas extra — sábados, feriados, o extensión de jornada antes de las 7:00/después de las 15:48), y una tabla con el detalle numérico por operario: minutos muertos normal, extra, total, y días con hueco."
          },
          {
            titulo: "El informe en PDF — el detalle real, para discutir con el operario",
            texto: "Al pie de la pestaña hay un selector de operario + mes y el botón \"📄 Generar reporte PDF\" — llama a <code>obtenerReporteTiemposOperario(operario, ym)</code> en el servidor, que arma día por día la línea de tiempo completa de ese mes: cada tarea real cargada (con su horario y código) intercalada con cada hueco sin tarea, resaltado en color (amarillo si es hueco en horas extra, rojo si es en jornada normal), con el subtotal de minutos muertos de cada día y el total del mes al final. El PDF se genera 100% en el navegador (<code>html2pdf.js</code>) y se descarga directo — nada queda guardado en el servidor. Es exactamente el documento pensado para sentarse con un operario puntual y mostrarle, minuto a minuto, dónde estuvo sin tarea cargada ese mes."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Filtrar por año/mes/operario/código", texto: "La barra lateral izquierda tiene botones rápidos de año (2025/2026/Ambos) — al tocarlos, la lista de operarios se actualiza sola mostrando solo a los vigentes ese año. También hay listas con checkbox para operarios y códigos de tarea puntuales, combinables entre sí." },
          { titulo: "Actualizar con los datos más recientes", texto: "Botón \"🔄 Actualizar en vivo\" en el header — trae los números de TIEMPOS actualizados al momento, sin recargar la página. Es el único de los tres botones del header que hace falta usar (los otros dos, \"Actualizar datos\" y \"Guardar HTML\", son de una versión anterior del sistema y hoy no cumplen ninguna función real)." },
          { titulo: "Ver el desempeño de un operario puntual", texto: "Tildá solo a esa persona en el filtro de operarios — la pestaña \"Resumen\" cambia sola a la vista enfocada en esa persona, con su mejor y peor mes destacados." },
          { titulo: "Comparar quién hace mejor una tarea puntual", texto: "Pestaña \"Por tarea\" — el gráfico \"Desviación por tarea y operario\" y el radar de desempeño muestran directamente quién rinde mejor en cada código de tarea." },
          { titulo: "Ver la evolución de alguien a lo largo del tiempo", texto: "Pestaña \"Evolución × operario\" para el detalle mes a mes de una persona, o \"Mapa de calor\" para la vista panorámica de todo el equipo a la vez." },
          { titulo: "Comparar un año contra el otro", texto: "Pestaña \"2025 vs 2026\"." },
          { titulo: "Revisar tiempos muertos", texto: "Pestaña \"⏱ Tiempos Muertos\" — KPIs, rankings y tabla por operario, separando jornada normal de horas extra." },
          { titulo: "Generar el informe PDF de un operario", texto: "Al pie de Tiempos Muertos, elegir operario y mes, y \"Generar reporte PDF\" — descarga el detalle día por día con cada hueco sin justificar, listo para mostrarle a esa persona." }
        ]
      }
    },
    {
      id: "f-ca-26",
      categoria: "Ejecución en Planta",
      nombre: "Toma de Tiempos (F-CA-26) — Cronómetro Analítico",
      estado: "activo",
      resumen: "Cronometraje OIT por cuba (con paradas intermedias) + checklist de inspección de puesto, y un diagnóstico histórico de desviaciones sobre toda la hoja Registro.",
      tecnico: {
        intro: "Proyecto propio con `Código.gs` + `Index.html` separados (a diferencia de Carga de Tiempos, que genera el HTML embebido en el `.gs`). Dos vistas: <b>Cronómetro</b> (captura) y <b>Diagnóstico/Análisis</b> (histórico).",
        bloques: [
          {
            titulo: "Estructura de datos real (hoja Registro) — corregida",
            texto: "El mapeo anterior tenía un error de columna, confirmado ahora con el código real:",
            tabla: [
              ["A", "Código completo", "Modelo + Cód. Tarea concatenados — clave para buscar el Tiempo Estándar en Consolidado"],
              ["B", "Nº de Registro", "Consecutivo autoincremental"],
              ["C", "Modelo de cuba", ""],
              ["D", "Código Tarea", ""],
              ["E", "Operario", "Texto libre histórico o \"legajo - Apellido, Nombre\" ya normalizado"],
              ["F", "Tiempo Promedio (TO)", "Por cuba, antes del suplemento"],
              ["G", "Tiempo Suplementario", "16% fijo sobre F"],
              ["H", "Tiempo Cronometrado Total", "F + G — el tiempo real medido"],
              ["K", "Tiempo Estándar", "Lookup contra Consolidado por el código de columna A"],
              ["L", "Diferencia", "H − K"],
              ["M", "Porcentaje de desviación", "(H / K − 1) × 100"],
              ["Q", "Fecha/hora de carga", "Solo presente en registros cargados desde que se agregó esta columna — vacía en datos viejos"]
            ]
          },
          {
            titulo: "Hoja Procesos",
            texto: "980 filas — desglose de micro-pasos dentro de cada Cód. de Operación (ej. \"Colocar matriz a punto\", \"Cortar perfil ángulo largos\"). Es el nivel más granular del sistema."
          },
          {
            titulo: "Código de Suplementarios",
            texto: "Catálogo de motivos de parada/tiempo suplementario (Baño, Tomar agua/café, Cobrar RRHH, etc.), usado para justificar diferencias entre tiempo cronometrado y estándar."
          },
          {
            titulo: "getDiagnostico() — el corazón de la vista de Análisis",
            texto: "Lee toda la hoja Registro (cientos de filas acumuladas históricamente) y arma de una sola vez los KPI generales, el agrupado por operario y por tarea, y la lista plana completa para el drill-down del frontend. Cada fila pasa por <code>procesarFilaRegistro_()</code>, que clasifica el resultado en 5 tipos: <code>ok</code> (válida), <code>vacia</code> (sin dato, no se reporta), <code>sin_estandar</code> (el código Modelo+Tarea es válido pero no tiene Tiempo Estándar cargado en Consolidado), <code>tiempo_invalido</code> (la columna H no tiene un número real), <code>posible_mantenimiento</code> (ver bloque aparte)."
          },
          {
            titulo: "Bug corregido — \"Error al calcular el diagnóstico\"",
            texto: "El síntoma real: el servidor terminaba de calcular todo bien y rápido (confirmado en el panel de Ejecuciones — \"Completada\", ~2 segundos), pero la respuesta se rompía recién en el paso de empaquetarla para el navegador — un tipo de falla que ni el editor ni el panel de Ejecuciones muestran, porque pasa después. La causa más probable: la columna Q (fecha) podía viajar como objeto <code>Date</code> crudo de JavaScript en vez de texto, y una fecha inválida/corrupta rompe la conversión a JSON. Se blindó <code>procesarFilaRegistro_()</code> para que la fecha siempre se convierta a texto simple antes de mandarla, y además cada fila se procesa dentro de su propio <code>try/catch</code> — una fila con datos corruptos ya no puede tirar abajo el diagnóstico completo."
          },
          {
            titulo: "⚠ Incidente grave del día — createTemplateFromFile corrompía el archivo entero",
            texto: "Al agregar el botón de Manual, el <code>doGet</code> se cambió de <code>HtmlService.createHtmlOutputFromFile('Index')</code> a <code>createTemplateFromFile('Index')</code> + <code>.evaluate()</code>, para poder inyectar <code>&lt;?!= token ?&gt;</code>. Con un archivo tan grande (~2000 líneas de React), ese mecanismo de plantillas de Apps Script terminaba <b>escapando caracteres del bloque de script entero</b> (<code>=</code>, <code>{</code>, <code>}</code> aparecían convertidos a <code>\\x3d</code>, <code>\\x7b</code>, <code>\\x7d</code>) antes de mandarlo al navegador — rompiendo el parser de Babel en un punto del código que no tenía nada que ver con el cambio real. Costó varias rondas de diagnóstico entender que el problema no estaba en la lógica, sino en el mecanismo de servido del HTML."
          },
          {
            titulo: "Solución — leer el token directo de la URL, sin plantillas",
            texto: "El <code>doGet</code> volvió a <code>createHtmlOutputFromFile('Index')</code> (sin motor de plantillas). El token de sesión <b>ya viene en la URL</b> de la página (<code>...exec?token=...</code>) — se lee del lado del cliente con <code>new URLSearchParams(window.location.search).get('token')</code>, sin que el servidor tenga que tocar el archivo para nada. <b>Lección para todo el sistema</b>: si un módulo ya recibe el token por query string en la URL (todos lo reciben, porque así arma el link cada módulo desde el hub), <b>no hace falta <code>createTemplateFromFile</code> para pasárselo al cliente</b> — alcanza con leerlo del lado del navegador. El motor de plantillas de Apps Script solo hace falta si hay que insertar contenido calculado del lado del servidor que el cliente no podría obtener por su cuenta."
          },
          {
            titulo: "Panel de filas con problema — colapsado en una sola línea",
            texto: "En vez de saltear en silencio las filas incompletas, <b>todo</b> lo que no sea una fila realmente vacía se reporta con su número de fila real y el motivo. El panel general es un <b>botón único colapsado</b> (cantidad total + desglose por tipo), que se expande recién al hacer click — así no tapa el resto de la pantalla aunque haya decenas de filas. Adentro, cada fila tiene su propio acordeón individual (también colapsado por defecto) con un link directo a esa fila en la planilla real y un botón \"Verificar de nuevo\" que re-chequea solo esa fila puntual (<code>verificarFilaRegistro()</code>) sin recalcular las ~800 — si ya se corrigió, se marca con ✔ verde en el momento, sin recargar la página."
          },
          {
            titulo: "⚠ Cuarta categoría — \"Posible registro de mantenimiento (no producción)\"",
            texto: "Se descubrió que buena parte de las filas \"sin estándar\" en realidad <b>no son registros de producción de cuba en absoluto</b> — son mediciones de mantenimiento de máquinas (fresadora, sierra sin fin, limadora, computadoras, perforadora, torno, rectificadora, balancín, transpallet) cargadas históricamente, de la época en que esas actividades no tenían un código de tarea asignado — así que se tipeó el nombre de la máquina directo en las columnas de Modelo/Tarea. <code>procesarFilaRegistro_()</code> las detecta por una lista de palabras clave (armada a partir de ejemplos reales, buscando en Modelo+Tarea+código concatenado) y también marca como sospechoso cualquier Código de Tarea que sea literalmente \"0\". Se clasifican aparte (etiqueta violeta), distinguiéndolas de \"Sin Tiempo Estándar\" real (código válido, pero sin cargar en Consolidado)."
          },
          {
            titulo: "Cómo se corrigen estas filas — sin perder el historial",
            texto: "El criterio es el mismo para las 4 categorías de problema: <b>codificar, nunca borrar ni mover</b>. Se abre el link \"Editar en la planilla\", se corrige el Modelo/Código de Tarea con el código real que corresponda, y se aprieta \"Verificar de nuevo\" — si ahora encuentra el Tiempo Estándar en Consolidado, la fila pasa a <code>ok</code> y se cuenta en el diagnóstico general; si no, sigue marcada hasta que se resuelva. El registro histórico de esa medición nunca se pierde, solo se completa el código que en su momento no existía."
          },
          {
            titulo: "Top 10 Mayor Desviación — solo personal activo",
            texto: "<code>getDiagnostico()</code> cruza cada operario contra el mismo padrón de <code>OPERARIOS</code> (Estado=ACTIVO) que usa <code>obtenerOperariosActivos()</code>, marcando cada uno con una bandera <code>activo</code>. El gráfico de Top 10 filtra a los inactivos automáticamente."
          },
          {
            titulo: "Tabla \"Por Operario\" — activos primero, con filtro Activos/Inactivos",
            texto: "La tabla completa (a diferencia del Top 10) sigue mostrando a todo el mundo, para no perder el historial — pero ahora los activos aparecen siempre primero como criterio estable, sin pisar el orden de columna elegido dentro de cada grupo. Se agregaron 3 botones (Todos / Activos / Inactivos) al lado del buscador de texto existente, para filtrar rápido sin tener que escribir el nombre."
          },
          {
            titulo: "Normalización de operarios (NormalizarOperariosFCA26.gs) — la parte más peleada del día",
            texto: "Mismo criterio final que en NC: formato <code>legajo - Apellido, Nombre</code>, RRHH — Legajos como fuente de verdad. Es una <b>herramienta de mantenimiento aparte</b> (no forma parte del flujo diario), pensada para correr una vez y volver a usar solo si aparecen más datos viejos sin normalizar."
          },
          {
            titulo: "Cómo funciona el emparejamiento automático",
            texto: "<code>construirPadronRRHHPorApellido_()</code> arma un padrón de RRHH agrupado por apellido normalizado (sin tildes, mayúsculas) — <b>a propósito no filtra por Estado=ACTIVO</b>, porque Registro es un historial de años con gente que ya no trabaja más ahí y hay que poder identificarla igual (distinto del filtro de activos del Top 10, que es una necesidad aparte, y que sí filtra). Para cada valor de texto libre en la columna Operario, <code>extraerApellidoYResto_()</code> separa el apellido del \"resto\" (nombre completo o solo la inicial, como venga tipeado: \"Rigo, J\" o \"Carrizo Carlos\"). Si hay un solo apellido coincidente en RRHH, es <code>OK</code> directo. Si hay varios (apellido repetido), se usa el \"resto\" para desambiguar — si el nombre real en RRHH empieza con lo que vino en el texto original (nombre completo o solo la inicial), se resuelve solo; si sigue habiendo empate, queda <code>AMBIGUO</code>."
          },
          {
            titulo: "Los dos pasos obligatorios, en orden — y el bug que hubo en el primero",
            texto: "<code>normalizarOperariosFCA26_DryRun()</code> arma la hoja <code>Log_Normalizacion_Operarios</code> (Fila / Valor Original / Estado / Propuesta) <b>sin tocar ningún dato real</b>. <code>normalizarOperariosFCA26_Aplicar()</code> escribe en Registro solo lo marcado \"OK\". <b>Bug real que hubo y se corrigió</b>: la primera versión de <code>Aplicar()</code> volvía a correr el emparejamiento automático desde cero en vez de leer la hoja de log — por eso, cuando Walter corregía a mano los casos AMBIGUO/SIN_MATCH directo en el log (cambiando el Estado a OK con la propuesta correcta), esas correcciones nunca se aplicaban. Se corrigió para que <code>Aplicar()</code> lea la hoja de log tal cual está en ese momento, columna por columna — respetando cualquier corrección manual."
          },
          {
            titulo: "Resultados reales de la corrida completa",
            texto: "Sobre 779 filas de Registro: primera pasada (matching solo por apellido) → 240 OK, 30 ambiguos, 509 sin match. Al agregar el desempate por \"resto\" (nombre/inicial) → subió a 651 OK, 91 ambiguos, 37 sin match. Con las correcciones manuales de Walter sobre el log, quedaron todos resueltos — la columna E de Registro terminó 100% en formato <code>legajo - Apellido, Nombre</code>."
          },
          {
            titulo: "Visual normalizado a Sistema Mayo",
            texto: "El logo vectorial custom (componente <code>MayoLogo</code>, un SVG propio con las letras dibujadas) se reemplazó en el header de pantalla por la caja blanca \"MAYO\" en rojo estándar — se dejó intacto el uso del logo vectorial dentro del PDF exportado (fondo blanco, mismo criterio que los PDFs de NC). Se fijó la tipografía (<code>Segoe UI</code>) explícita en la config de Tailwind. El acento principal (header, pestañas activas, botón de Iniciar/Pausar) ya estaba en rojo Mayo de una corrección anterior — las acciones secundarias (buscar OT, imprimir, subir foto) quedan en azul a propósito, mismo patrón rojo=primario/azul=secundario que el resto del sistema."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Iniciar el cronómetro", texto: "Elegir Modelo y Código de Tarea, apretar \"Iniciar Reloj\"." },
          { titulo: "Paradas intermedias", texto: "Durante la medición se pueden marcar paradas — son los tiempos que quedan fuera del proceso en sí (esperas, interrupciones), se registran aparte del tiempo productivo." },
          { titulo: "Levantar los pasos de la tarea", texto: "Se van marcando los micro-pasos del proceso a medida que se completan (de la hoja Procesos)." },
          { titulo: "Checklist de inspección de puesto", texto: "Al cerrar la medición, marcar si corresponde o no cada punto: Proceso, MP (materia prima), Pulido, Ergonomía, Elementos de Seguridad." },
          { titulo: "Ver el diagnóstico histórico", texto: "Pestaña \"Diagnóstico / Análisis\" — KPIs generales, Top 10 de mayor desviación (por operario o por tarea), y detalle por operario/tarea." },
          { titulo: "Filtrar la tabla de operarios", texto: "Los activos aparecen siempre primero. Con los botones \"Todos / Activos / Inactivos\" al lado del buscador se puede acotar rápido, además de poder escribir el nombre." },
          { titulo: "Revisar filas con problema", texto: "El cartel rojo arriba está colapsado por defecto — un click lo despliega. Cada fila listada tiene un link directo para corregirla en la planilla y un botón para verificar si ya quedó bien, sin recalcular todo el diagnóstico de nuevo. Siempre se corrige el dato (nunca se borra la fila), para no perder el historial." }
        ]
      }
    },
    {
      id: "mantenimiento",
      categoria: "Pendientes de Documentar",
      nombre: "Mantenimiento",
      estado: "pendiente",
      resumen: "Reporte y órdenes preventivas/correctivas para puentes grúa, plegadoras y soldadoras.",
      tecnico: { pendiente: true, nota: "Placeholder en el hub — todavía no desarrollado (<code>URL_DE_TU_APP_MANTENIMIENTO_AQUI</code> sin reemplazar)." },
      operativo: { pendiente: true }
    },
    {
      id: "seguimiento-compras",
      categoria: "Pendientes de Documentar",
      nombre: "Seguimiento de Compras",
      estado: "pendiente",
      resumen: "Monitoreo y trazabilidad de materias primas e insumos.",
      tecnico: { pendiente: true, nota: "Placeholder en el hub — todavía no desarrollado." },
      operativo: { pendiente: true }
    },
    {
      id: "tiempos-estandar",
      categoria: "Ejecución en Planta",
      nombre: "Tiempos Estándar / Desviaciones / Errores",
      estado: "activo",
      resumen: "Matriz de tiempos estándar editable, cruce de desviaciones (TIEMPOS + F-CA-26) con sugerencias automáticas, seguimiento de pendientes, y detector de errores en TAREAS 2026.",
      tecnico: {
        intro: "Un solo proyecto de Apps Script con 2 archivos <code>.gs</code> (<code>Codigo_TiemposEstandar.gs</code> con el <code>doGet</code> y la Comparativa/Editar; <code>Codigo_COMPLETO_Desviaciones_y_Errores.gs</code> con Desviaciones/Seguimiento/Errores Tareas) y 2 HTML (<code>FormularioTiemposEstandar</code>, la app principal; <code>FormularioEditarTiempo</code>, un modal chico para editar directo desde el menú de Sheets). 5 pestañas: Comparativa, Editar Tiempo, Desviaciones, Seguimiento, Errores Tareas 2026.",
        bloques: [
          {
            titulo: "Fuente única editable — el resto son fórmulas",
            texto: "El \"cuadro\" (8 hojas: D, DI, ST, MONOPOSTE-RURAL, D Al, DI Al, MONOPOSTE-RURAL Al, ACC-HERRAJES) es la <b>única</b> fuente editable de Tiempos Estándar. \"Consolidado\" y \"Matriz_Comparativa\" son siempre fórmulas — nunca se escribe ahí directamente. Toda edición pasa por <code>actualizarTiempoEstandar()</code>, que revalida el token, escribe en el cuadro real, y deja constancia en la hoja \"Historial_Cambios\"."
          },
          {
            titulo: "Pestaña Comparativa — la matriz completa",
            texto: "Tabla Modelo × Tarea armada desde <code>Matriz_Comparativa</code> (fórmula). Filtros: buscar por modelo (texto parcial), buscar por tarea (código o parte de la descripción), y chips por familia (mostrar/ocultar D, DI, ST, etc. — con botones \"Mostrar todas\"/\"Ocultar todas\"). Las columnas Herrajes/Accesorios/Mantenimiento se separan como familias propias en el filtro, aunque en la hoja física estén unificadas bajo \"ACC-HERRAJES\". Las celdas con historial de cambios se resaltan; un click abre el detalle de modificaciones anteriores."
          },
          {
            titulo: "Pestaña Editar Tiempo — buscar y corregir un valor puntual",
            texto: "Buscar por Modelo + Código de Tarea, ver el valor actual (con hoja de origen y descripción de la tarea) y su historial completo, cargar el nuevo valor y guardar. <code>localizarCeldaCuadro_()</code> encuentra la celda real recorriendo las 8 hojas del cuadro. Al guardar, si había un pendiente \"Corregir Estándar\" abierto para ese Modelo+Tarea en la pestaña Seguimiento, <b>se cierra solo automáticamente</b>."
          },
          {
            titulo: "Pestaña Desviaciones — el análisis cruzado",
            texto: "Cruza dos fuentes: <b>TIEMPOS</b> (tiempo real cargado en producción, ya con su Tiempo Estándar de referencia grabado por fila) y <b>F-CA-26/Registro</b> (cronometrajes de campo — la \"verdad de terreno\", sin fecha pero con número de registro correlativo como orden cronológico). Por cada código Modelo+Tarea con actividad, calcula: desviación del promedio real vs. el estándar, variabilidad entre operarios (coeficiente de variación), y si hubo un salto entre cronometrajes viejos y recientes de F-CA-26 (posible cambio de procedimiento, umbral 15%)."
          },
          {
            titulo: "Las 7 sugerencias automáticas — con prioridad",
            texto: "Primero se filtran los 3 problemas de <b>carga de datos</b> (siempre tienen prioridad sobre el resto): <code>dato_invalido</code> (tiempo ≤0 en TIEMPOS), <code>codigo_invalido</code> (el Modelo+Tarea no existe en Consolidado — puede ser un typo), <code>ot_invalida</code> (OT vacía o con formato raro). Si no hay ninguno de esos, la sugerencia depende de la combinación de señales: dentro de ±5% → <code>ok</code> (sin acción); si el cronometraje de campo contradice al estándar (>±5%) → <code>editar_estandar</code>; si la desviación es pareja contra el estándar pero varía mucho entre operarios (>20% coef. variación) → <code>revisar_operario</code> (el estándar está bien, el problema es de una persona); si no hay dato de campo para comparar → <code>tomar_tiempo</code>; si nada de lo anterior explica la desviación → <code>revisar_general</code>."
          },
          {
            titulo: "Drill-down por operario y acciones",
            texto: "Cada fila de la tabla es expandible — muestra el detalle por operario (ordenado de mayor a menor tiempo), y las tablas separadas de registros con problema (inválidos/sin estándar/OT inválida), cada una con link directo a la fila real y botón \"✏️ Corregir\" (abre el modal de corrección en línea, sin salir de la página). Según la sugerencia, aparece un botón de acción: \"📌 Marcar pendiente\" (Corregir Estándar) o \"🕐 Tomar tiempo\" / \"👤 Seguimiento operario\" — todos escriben en la hoja \"Pendientes_Desviaciones\"."
          },
          {
            titulo: "Corrección en línea — sin salir de Desviaciones",
            texto: "Permite corregir Modelo, Código de Tarea, Cantidad, Operario, horas de inicio/fin y tiempo de parada directo desde el modal. El OT se muestra solo como referencia (no editable — está ligado al estado \"Completado\" de TAREAS 2026, tocarlo por acá podría desincronizar esa referencia). Al guardar, dispara automáticamente <code>TIEMPOSLib.recalcularBloqueDesdeFila()</code> sobre el bloque completo de esa tarea."
          },
          {
            titulo: "Pestaña Seguimiento — con auto-detección de resolución",
            texto: "3 tipos de pendiente, cada uno con su propio chequeo automático al cargar la pestaña: <b>Toma de tiempo</b> (se guarda el máximo Nº de registro de F-CA-26 para ese código como línea base — si aparece un registro más nuevo, se marca \"Posiblemente resuelto\"); <b>Seguimiento operario</b> (compara por fecha, cruzando TIEMPOS de ese operario en la misma tarea — código solamente, sin importar el modelo — desde que se creó el pendiente; si el promedio de desviación de los registros posteriores baja de ±10%, se marca resuelto); <b>Corregir Estándar</b> (no se re-chequea acá — se cierra en el momento exacto de editar ese Modelo+Tarea desde la pestaña Editar Tiempo)."
          },
          {
            titulo: "Pestaña Errores Tareas 2026 — 5 tipos de error estructural",
            texto: "Analiza la hoja TAREAS buscando: OC vacío (con Modelo/Tarea cargados), Modelo o Código de Tarea vacío, OT+Tarea duplicada (misma tarea de la misma cuba cargada más de una vez), Completado (X) sin OT asignado (contradicción real), y Cantidad inconsistente dentro de una misma OT (distinto de OC completo — es normal que un mismo OC+Modelo se reparta en varias OT con cantidades chicas distintas; lo raro es que DENTRO de una sola OT las tareas tengan cantidades distintas cargadas). Excluye a propósito las filas \"PLANILLA EN BLANCO\" (plantilla intencional) y Herrajes/Accesorios del chequeo de cantidad (no representan \"cubas\", varían normalmente)."
          },
          {
            titulo: "⚠ Bug real del día — ID de F-CA-26 apuntaba a una copia vieja",
            texto: "<code>ID_FCA26</code> tenía cargado el ID de una copia anterior de la planilla (de antes de que se pasara a \"Copia de Walter\") — <code>leerCronometradosFCA26_()</code> terminaba cruzando contra datos viejos/vacíos, y como esa función no tenía su propio <code>try/catch</code>, cualquier fallo ahí tiraba abajo toda la pestaña de Desviaciones. Corregido al ID real, y blindadas las 3 funciones que abren F-CA-26 con <code>try/catch</code> propio — un problema puntual con esa planilla ya no puede romper el resto del análisis."
          },
          {
            titulo: "⚠ Bug real del día — Infinity rompía toda la respuesta",
            texto: "Con el ID correcto, algunos cronometrajes de campo con tiempo cargado en 0 (mismo tipo de dato sucio que se viene encontrando en F-CA-26) producían <code>Infinity</code> al calcular <code>desviacionEstandarVsCronometrado</code> (división por ese cero). <code>google.script.run</code> no tolera <code>Infinity</code>/<code>NaN</code> en la respuesta — a diferencia de un <code>JSON.stringify()</code> normal (que los convierte a <code>null</code> sin problema), Apps Script puede romper el armado de <b>toda</b> la respuesta con uno solo, sin importar cuán anidado esté. El servidor terminaba \"Completada\" en el panel de Ejecuciones, pero el navegador recibía <code>null</code> — mismo patrón de falla silenciosa que ya se había visto en el Diagnóstico de F-CA-26. Se corrigió la división puntual, y se agregó <code>sanearNumeros_()</code> — recorre todo el árbol de resultado y convierte cualquier valor no finito a <code>null</code> antes de devolver, como red de seguridad general para el futuro."
          },
          {
            titulo: "Botón Manual y el token — mismo criterio aprendido hoy",
            texto: "Al agregar el botón, se evitó <code>createTemplateFromFile</code> a propósito (el mecanismo que rompió F-CA-26 el mismo día) — el <code>doGet</code> usa <code>createHtmlOutputFromFile</code> simple, y el token se lee del lado del cliente con <code>URLSearchParams(window.location.search)</code>. El email de sesión (mostrado en el header) se resuelve con una función chica y liviana (<code>obtenerEmailSesion</code>), en vez de inyectarlo por plantilla."
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Comparativa — ver la matriz completa", texto: "Buscar por modelo o tarea, o usar los chips de familia para mostrar/ocultar. Click en una celda con historial (resaltada) para ver los cambios anteriores." },
          { titulo: "Editar un tiempo estándar puntual", texto: "Pestaña \"Editar Tiempo\" → cargar Modelo y Código de Tarea → \"Buscar valor actual\" → escribir el nuevo valor → \"Guardar cambio\"." },
          { titulo: "Revisar desviaciones", texto: "Pestaña \"Desviaciones\" — filtrar por modelo, tarea, o tipo de sugerencia. El gráfico de arriba muestra las 15 peores desviaciones de un vistazo." },
          { titulo: "Ver el detalle de una fila", texto: "Click en la fila (no en los botones) para expandir el desglose por operario y, si corresponde, las tablas de registros con problema." },
          { titulo: "Actuar sobre una sugerencia", texto: "Según el tipo: \"📌 Marcar pendiente\" para corregir el estándar, \"🕐 Tomar tiempo\" si falta dato de campo, \"👤 Seguimiento operario\" si el problema parece de una persona puntual, o \"✏️ Corregir\" directo en los registros con problema de carga." },
          { titulo: "Revisar pendientes", texto: "Pestaña \"Seguimiento\" — se auto-detectan como \"Posiblemente resuelto\" los que ya tienen actividad nueva. \"✅ Confirmar resuelto\" los cierra a mano." },
          { titulo: "Revisar errores de carga en TAREAS 2026", texto: "Pestaña \"Errores Tareas 2026\" — filtrar por tipo de error o buscar por OC/OT, cada fila con link directo para corregirla en la planilla real." }
        ]
      }
    }
  ]
};
