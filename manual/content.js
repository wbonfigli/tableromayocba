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
          }
        ]
      },
      operativo: {
        pasos: [
          { titulo: "Ingresar la OT", texto: "Escribir el N° de OT y confirmar. Si tiene varias tareas pendientes, aparece una tabla para elegir cuál cargar." },
          { titulo: "Completar Modelo, Cód. Tarea, Cantidad y Operario", texto: "Se autocompletan si la OT existe en TAREAS. El Operario se elige de una lista (viene de RRHH — Legajos, solo activos)." },
          { titulo: "Cargar horarios", texto: "Fecha, hora y minutos de inicio y fin. Si la tarea tiene más de una etapa, marcar cuántas etapas totales tiene." },
          { titulo: "Marcar Parcial si no se termina hoy", texto: "El checkbox \"Guardar como PARCIAL\" deja la tarea abierta para continuar otro día, sin cerrar el bloque." },
          { titulo: "Guardar", texto: "Al cerrar la última etapa, el sistema calcula solo el tiempo total y lo compara contra el estándar — no hace falta hacer nada más, el semáforo de colores (verde/amarillo/rojo según desviación) se aplica automáticamente." }
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
            titulo: "Integración con NC (sin creación automática por servidor)",
            texto: "Cuando el dictamen es NOK, se arma un <b>link de precarga</b> al formulario NUEVO de NC (no al de edición, que bloquea campos) con Modelo, Serie, OT, OC, Responsable y Detalle ya cargados por parámetros de URL. El inspector completa Inspector/Línea de Producto/Cód. Operación/Codificación en NC mismo y guarda ahí. El N° de NC resultante se pega a mano de vuelta en el banner de \"NC pendientes\" de RG-CA-03, que lo escribe en la columna J."
          },
          {
            titulo: "Por qué no hay creación automática por atrás",
            texto: "Se probó un <code>doPost</code> que creaba la NC directo desde RG-CA-03, pero el modo de edición de NC bloquea a propósito los campos de identificación (está pensado solo para cargar causa/acción/disposición) — eso dejaba NC con Inspector/Codificación vacíos para siempre. El diseño actual evita ese problema de raíz."
          }
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
          { titulo: "Confirmar registro", texto: "Si el dictamen es NOK, aparece un botón \"Completar NC\" por cada pieza — abre el formulario de NC ya precargado." },
          { titulo: "Vincular el N° de NC", texto: "Una vez guardada la NC, volver a RG-CA-03 (banner superior) y pegar el N° de NC obtenido para dejarlo vinculado." }
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
            titulo: "Flujo de pendientes",
            texto: "Una NC con Estado=ABIERTA aparece como pendiente en <b>Técnica y Producción</b> hasta que se cargue el Peso (columna AA). Recién con Peso cargado puede pasar a <b>Administración</b> para cargar la Sanción — hay una validación de dependencia explícita: no se puede sancionar sin gravedad cargada."
          },
          {
            titulo: "Resumen de Peso Acumulado por Operario",
            texto: "En la pestaña Administración, agrupa NC con Gravedad cargada y sin sanción todavía, sumando Peso por operario. Si supera el umbral configurado (default 3 puntos), se marca \"Corresponde sanción\" y permite generar el PDF de notificación de apercibimiento."
          },
          {
            titulo: "Análisis y Evaluación",
            texto: "Agrupa reincidencia por Tarea (Cod. Operación), no por Modelo — usa la fecha real de despacho de la cuba (cruzando con la hoja Cubas por Nº de Serie) en vez de la fecha de reporte, para medir el estado real: Activo (≤60 días), Enfriando (≤180 días), Resuelto. Incluye una heurística (\"pista\") que sugiere si la reincidencia cesó por cambio de operario — siempre a confirmar manualmente."
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
      resumen: "Ficha de personal, altas, faltas/autorizaciones, sanciones y Empleado del Mes.",
      tecnico: {
        intro: "Permiso AuthLib: <code>\"rrhh-presentismo\"</code>. Proyecto standalone \"RRHH — Legajos\". Este resumen está armado a partir de lo trabajado en conversación — el resumen técnico general del proyecto todavía lo lista como pendiente, así que conviene revalidarlo contra el código real la próxima vez que se toque.",
        bloques: [
          {
            titulo: "Sub-módulos",
            texto: "Cuatro piezas: (1) Legajo — visor/editor en acordeón, (2) Alta de nuevo empleado, (3) Faltas/Autorizaciones, (4) Sanciones."
          },
          {
            titulo: "Auto-numeración de legajo",
            texto: "Al dar de alta un empleado, el número de legajo se asigna automáticamente según el tipo: <b>operarios de planta → 1 a 799</b>, <b>personal de oficina → 800 a 9700</b>. Este corte en 800 se usa como convención en todo el sistema para distinguir planta de oficina (RG-CA-03, Empleado del Mes, listas de operarios, etc.)."
          },
          {
            titulo: "Permisos por sección (hoja Perfiles)",
            texto: "Formato largo: Perfil, Módulo, Sección, Nivel. Cuatro perfiles reales: <code>rrhh</code>, <code>gerencia</code>, <code>produccion</code>, <code>calidad</code>. La función <code>obtenerDetalleLegajo</code> filtra del lado del servidor los campos marcados como sección \"oculto\" según el perfil de quien consulta — no es solo un ocultamiento visual en el frontend."
          },
          {
            titulo: "Fórmula de Empleado del Mes",
            formula: {
              texto: "Ranking mensual combinando tres factores:",
              partes: [
                { pct: "40%", lbl: "Asistencia" },
                { pct: "35%", lbl: "Sanciones" },
                { pct: "15%", lbl: "Rendimiento de Tiempos" }
              ]
            },
            textoExtra: "Los legajos ≥800 (personal de oficina) quedan <b>excluidos por completo</b> del ranking — el reconocimiento es específicamente para planta."
          },
          {
            titulo: "Feriados",
            texto: "Modal pre-cargado con los feriados de Argentina 2026 + el Día del Metalúrgico (7 de septiembre), con un trigger de recordatorio anual por email."
          }
        ]
      },
      operativo: {
        pendiente: true,
        nota: "Los pasos de uso día a día (cómo dar de alta un empleado, cómo cargar una falta, dónde ver el ranking de Empleado del Mes) no están confirmados con el detalle suficiente todavía. Completar la próxima vez que se use el módulo en vivo."
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
            texto: "Formulario con dos pestañas dentro de la misma pantalla. <b>No es la Generación de OT del hub</b> (<code>?v=ordenes</code>, todavía sin relevar) — este es un paso previo: reserva/administra el banco de números de serie por pedido. Como los rangos pedidos pueden no ser consecutivos, cada pedido se trata por separado en vez de acumularse en un único banco corrido. <b>Pestaña 1 (Cargar Orden)</b>: OT, Cliente, Modelo (combo cargado desde <code>obtenerModelosReales()</code>), Cantidad — valida en vivo contra el stock disponible (<code>validarDisponibilidad()</code> en el cliente) y bloquea el botón Guardar si la cantidad pedida supera las series libres, mostrando un cartel con acceso directo a la Pestaña 2. Al guardar, llama a <code>registrarNuevaOrden(datosOrden)</code>. <b>Pestaña 2 (Cargar Stock Series)</b>: dos modos — \"Consecutivos (Rango)\" (Desde/Hasta) o \"Con Saltos\" (lista de números separados por coma) — llama a <code>agregarNuevasSeriesAlStock(paqueteSeries)</code> y vuelve automáticamente a la Pestaña 1 después de guardar."
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
    {
      id: "generacion-ot",
      categoria: "Pendientes de Documentar",
      nombre: "Generación de OTs (hub, ?v=ordenes)",
      estado: "pendiente",
      resumen: "Emisión y carga de nuevas órdenes de trabajo de calderería — distinto de la carga de stock de series en Cubas.",
      tecnico: {
        pendiente: true,
        nota: "Confirmado con Walter: <b>no</b> es el mismo módulo que \"Cubas → Módulos 1 y 2\". La carga de stock de series en Cubas administra pedidos de rangos de números de serie (que pueden no ser consecutivos, por eso se tratan como pedidos separados) — es un paso previo de reserva de series, no la generación de la Orden de Trabajo de calderería en sí. Sigue pendiente de relevar con el código real del router principal (<code>?v=ordenes</code>)."
      },
      operativo: { pendiente: true }
    },
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
      categoria: "Pendientes de Documentar",
      nombre: "Desempeño de Tiempos",
      estado: "activo",
      resumen: "Análisis de horas efectivas y rendimiento del personal — corre en Netlify, no en GitHub Pages.",
      tecnico: { pendiente: true, nota: "Hostname: <code>mayocordobarendimientos.netlify.app</code>. Es la única app del sistema que no está migrada a GitHub Pages. No relevado en detalle." },
      operativo: { pendiente: true }
    },
    {
      id: "f-ca-26",
      categoria: "Pendientes de Documentar",
      nombre: "Toma de Tiempos (F-CA-26)",
      estado: "activo",
      resumen: "Cronometrajes y checklist de métodos — calcula tiempo estándar vs. real por tarea/modelo.",
      tecnico: {
        intro: "Deployment propio, sin <code>?v=</code>. Genera la interfaz completa por código (sin archivos .html externos).",
        bloques: [
          {
            titulo: "Estructura de datos (hoja Registro)",
            tabla: [
              ["B", "Nº de Registro", ""],
              ["C", "Modelo de cuba", ""],
              ["D", "Código Tarea", ""],
              ["F", "Tiempo suplementario", "16% fijo"],
              ["G", "Tiempo Cronometrado Total", ""],
              ["K", "Tiempo Estándar", ""],
              ["L/M", "Diferencia / %", ""]
            ]
          },
          {
            titulo: "Hoja Procesos",
            texto: "980 filas — desglose de micro-pasos dentro de cada Cód. de Operación (ej. \"Colocar matriz a punto\", \"Cortar perfil ángulo largos\"). Es el nivel más granular del sistema."
          },
          {
            titulo: "Código de Suplementarios",
            texto: "Catálogo de motivos de parada/tiempo suplementario (Baño, Tomar agua/café, Cobrar RRHH, etc.), usado para justificar diferencias entre tiempo cronometrado y estándar."
          }
        ]
      },
      operativo: { pendiente: true, nota: "Falta confirmar el paso a paso de carga con Walter." }
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
      id: "control-procedimiento",
      categoria: "Pendientes de Documentar",
      nombre: "Control de Procedimiento",
      estado: "pendiente",
      resumen: "Análisis ergonómico y estandarización del proceso.",
      tecnico: { pendiente: true, nota: "Placeholder en el hub — todavía no desarrollado." },
      operativo: { pendiente: true }
    }
  ]
};
