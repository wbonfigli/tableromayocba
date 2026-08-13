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
    "Referencia de Datos",
    "Ejecución en Planta",
    "Calidad",
    "RRHH",
    "Planificación y Logística",
    "Pendientes de Documentar"
  ],

  modulos: [
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
        pendiente: true,
        nota: "Cubas tiene 5 módulos de formulario distintos (banco de series, pedido de OC, seguimiento logístico, despacho, reparaciones) — falta confirmar el paso a paso operativo de cada uno con Walter."
      }
    },

    {
      id: "tablero-produccion",
      categoria: "Planificación y Logística",
      nombre: "Tablero de Producción",
      estado: "activo",
      resumen: "Estado de tareas por OC, etapa y operario — vista agrupada de TAREAS 2026.",
      tecnico: {
        intro: "Módulo 7 del hub (<code>?v=tablero-produccion</code>), el más reciente del router principal.",
        bloques: [
          {
            titulo: "Lógica",
            texto: "Agrupa TAREAS 2026 por OC + Modelo, con drill-down en modal por operación individual. Tres estados: Pendiente / En Proceso / Completo — este último usa la columna T (\"En Proceso\") agregada específicamente para este módulo, separada de la columna P (\"Completado\") que usa Carga de Tiempos."
          },
          {
            titulo: "Funciones backend",
            texto: "<code>obtenerDatosTableroProduccion()</code> (lectura agregada), <code>marcarTareaEnProceso()</code> (cambio de estado)."
          },
          {
            titulo: "Mapeo de códigos de tarea corregido",
            texto: "5185/5591/5601 → Tanque; 5580 → Terminación; hay un array <code>excluir</code> para el rango de Accesorios que no debe mapearse a esas categorías."
          }
        ]
      },
      operativo: { pendiente: true, nota: "Falta confirmar el paso a paso de uso con Walter." }
    },

    // =================================================================
    // PENDIENTES DE DOCUMENTAR
    // =================================================================
    {
      id: "generacion-ot",
      categoria: "Pendientes de Documentar",
      nombre: "Generación de OTs",
      estado: "pendiente",
      resumen: "Emisión y carga de nuevas órdenes de trabajo de calderería.",
      tecnico: { pendiente: true, nota: "Módulo activo en el hub (<code>?v=ordenes</code>) pero sin código relevado en detalle todavía." },
      operativo: { pendiente: true }
    },
    {
      id: "materiales",
      categoria: "Pendientes de Documentar",
      nombre: "Logística de Materiales",
      estado: "parcial",
      resumen: "Trazabilidad de compras, insumos y chapas críticas para tanques.",
      tecnico: { pendiente: true, nota: "Módulo 3 (FormularioMateriales), <code>?v=materiales</code>. Descrito en el resumen general como \"en debugging activo\" — revisar estado actual antes de documentar." },
      operativo: { pendiente: true }
    },
    {
      id: "despachos",
      categoria: "Pendientes de Documentar",
      nombre: "Despachos y Reparaciones (hub)",
      estado: "parcial",
      resumen: "Control de egreso por lote con remito y retrabajos en planta.",
      tecnico: { pendiente: true, nota: "Corresponde al Módulo 5 de Cubas (<code>procesarDespachoLoteM5</code>, ver página Cubas) — falta documentar el formulario/interfaz específica del hub (<code>?v=despachos</code>)." },
      operativo: { pendiente: true }
    },
    {
      id: "dashboard-general",
      categoria: "Pendientes de Documentar",
      nombre: "Tablero de Control (dashboard general)",
      estado: "parcial",
      resumen: "Análisis dinámico de volúmenes y eficiencia — no confundir con Tablero de Producción.",
      tecnico: { pendiente: true, nota: "<code>?v=dashboard</code>. Se sabe que analiza volumen de producción despachada, tiempos logísticos y análisis de clientes cruzando Cubas (columnas de fecha de plegado/recepción/envío) — falta el detalle completo del código." },
      operativo: { pendiente: true }
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
