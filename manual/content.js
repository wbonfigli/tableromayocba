// ARCHIVO: Panol_Modal  (Apps Script › + › Secuencia de comandos › nombre exacto: Panol_Modal)
/**
 * ============================================================================
 *  PAÑOL — MODAL DE EGRESO / INGRESO / HISTORIAL / ALERTAS   (Paso 2)
 *  Proyecto Apps Script ATADO a la planilla "consumos".
 *
 *  Convive con la consola vieja:
 *   - Escribe en la MISMA hoja de movimientos (consumos, gid 1310385527)
 *     con el mismo formato (ID, FECHA, HORA, CODIGO INSUMO, DESCRIPCION,
 *     CANTIDAD, SALDO, OPERADOR, OPERADOR_CONSOLA ...) más las columnas
 *     nuevas N–S (OPERADOR (corregido), OT, TAREA, TIPO MOVIMIENTO,
 *     ORIGEN, MOTIVO EXCEPCION).
 *   - Descuenta / suma en la MISMA columna Stock de Insumos › InsumosCod.
 *
 *  Control previo al descuento (todas las reglas juntas):
 *   R1 Repetición   : retiro del mismo material antes de su frecuencia habitual.
 *   R2 Pares        : consumo cada 1000 min trabajados vs. operarios que hacen
 *                     la misma tarea (TIEMPOS, últimos 180 días).
 *   R3 Propio       : últimos 30 días vs. su propio ritmo de los 150 anteriores.
 *   R4 Cantidad     : cantidad mayor a la habitual por retiro.
 *   R5 Stock        : el sistema no tiene stock suficiente.
 *  Si alguna regla da ALERTA, el egreso exige motivo (+ observación) ANTES de
 *  descontar, y queda una fila en la hoja Alertas_Panol para administración.
 *
 *  Reglas Sistema Mayo: nunca se devuelve un Date al cliente (todo texto);
 *  columnas por NOMBRE de encabezado; consumos (150k filas) se consulta con
 *  la Query de Google (gviz), nunca se lee completa.
 *
 *  Usa (si están en el proyecto): MAPEO_OPERARIOS / resolverOperario_()
 *  de Panol_Preparacion — dejá ese archivo en el proyecto.
 * ============================================================================
 */

var PANOL_CFG = {
  CONSUMOS_ID: '1SzaDtNzEEuKcLM8HGgrG2m2v0F96oJ4t2388bBy97FU',
  CONSUMOS_GID: 1310385527,
  INSUMOS_ID: '1fUGE8Ze0FTNU79zKF3TAIYq2jb6Kf_BZ_-EcHpZFesA',
  INSUMOS_GID: 1804405181,            // InsumosCod (stock real)
  INSUMOS_PROP_GID: 554724880,        // InsumosCod_propuesto (Familia / Tipo)
  RRHH_ID: '1MBYjqwpd5Y4mFx_mRRhlIfLgaz4fK_cy3ooVwz6CnJc',
  RRHH_GID: 0,
  TIEMPOS_ID: '1uzR_76G7d-rA_ExzPq_l6Rgcfq3fnCInoe0ziNZMrw8',
  TIEMPOS_GID: 0,
  EN_CURSO_GID: 255741306,
  CONSOLIDADO_ID: '1Lxm3W4-DomhcS-P9uEmGxuEJ07hYTaxml3Kx79Gljbw',
  HOJA_TAREAS: 'TAREAS',
  HOJA_ALERTAS: 'Alertas_Panol',
  ORIGEN: 'MODAL PAÑOL',
  PERMISO: 'panol',
  PERMISOS_REVISION: ['insumo', 'insumos', 'admin'],
  TIPO_DIRECTA: 'ENTREGA DIRECTA',    // consumos › TIPO MOVIMIENTO de la entrega del mayorista directo al operario   // administración: depósito mayorista y alertas (moduloKey 'insumo')
  TZ: 'America/Argentina/Cordoba',

  // Ventanas y umbrales de desvío (ajustables)
  HIST_DIAS: 365,
  VENTANA_DIAS: 180,
  VENTANA_RECIENTE: 30,
  FACTOR_REPETICION: 0.5,    // R1: retira antes de la mitad de su intervalo habitual
  FACTOR_PARES: 2,           // R2: más del doble que la mediana de sus pares
  FACTOR_PROPIO: 2,          // R3: más del doble que su propio ritmo anterior
  MIN_UNIDADES_ALERTA: 3,    // no alertar R2/R3 por debajo de estas unidades
  MIN_MIN_TAREA_PAR: 600,    // minutos mínimos en la tarea para ser "par"
  MIN_MIN_TOTAL_PAR: 1000,   // minutos totales mínimos del par en la ventana
  MIN_PARES: 3,
  MIN_RETIROS_CANTIDAD: 10,  // R4: historial mínimo para juzgar la cantidad

  MOTIVOS: ['Falla del material', 'Se rompió', 'Pérdida / extravío', 'Cambio de tarea',
            'Trabajo especial / mayor volumen', 'Desgaste normal anticipado', 'Otro'],
  MOTIVOS_AJUSTE: ['Inventario físico', 'Error de carga anterior', 'Material dañado en depósito',
                   'Devolución de operario', 'Otro'],
  MAIL_ALERTAS: ''           // opcional: mail de administración para avisos de desvío
};

var PNL_COLS_CONSUMOS = {
  ID: 'ID', FECHA: 'FECHA', HORA: 'HORA', CODIGO: 'CODIGO INSUMO', DESCRIPCION: 'DESCRIPCION',
  CANTIDAD: 'CANTIDAD', SALDO: 'SALDO', OPERADOR: 'OPERADOR', CONSOLA: 'OPERADOR_CONSOLA',
  LOTE: 'LOTE', PESO: 'PESO', TUBO: 'NUMERO_TUBO', OBS: 'OBSERVACIONES',
  OPCORR: 'OPERADOR (CORREGIDO)', OT: 'OT', TAREA: 'TAREA', TIPO: 'TIPO MOVIMIENTO',
  ORIGEN: 'ORIGEN', MOTIVO: 'MOTIVO EXCEPCION', DEPOSITO: 'DEPOSITO',
  PUESTO: 'PUESTO TRABAJO', MAQUINA: 'MAQUINA SOLDAR'   // se crean solas la primera vez que se usan (Panol_Puestos)
};
var PNL_COLS_INSUMOS = {
  CODIGO: 'CODIGO DE INSUMO', DESCRIPCION: 'DESCRIPCION', MEDIDA: 'MEDIDA', UNIDAD: 'UNIDAD',
  PROVEEDOR: 'PROVEEDOR', PRECIO: 'PRECIO', STOCK: 'STOCK', CRITICO: 'STOCK CRITICO',
  DEPOSITO: 'DEPOSITO', MAYORISTA: 'STOCK MAYORISTA', FAMILIA: 'FAMILIA', TIPO: 'TIPO',
  COMPRA_MIN: 'COMPRA MINIMA', MULTIPLO: 'MULTIPLO COMPRA', MESES: 'MESES STOCK'
};
// Columna K (Deposito) de InsumosCod: solo los códigos con 1 se ven en el modal de pañol.
// Para sacar temporalmente un insumo del modal, se pone otro valor (o se deja vacío).
var PNL_DEPOSITO_VISIBLE = 1;
var PNL_ORDEN_FAMILIAS = ['Discos y Corte', 'Soldadura y Plasma', 'Protección Personal', 'Insumos Pintura',
  'Elementos Varios', 'Mechas Varias', 'Insumos Embalaje', 'Insumos Zincado', 'Materia prima / Producción', 'Producción'];
var PNL_COLS_TIEMPOS = {
  MODELO: 'MODELO', TAREA: 'CODIGO DE TAREAS', CANTIDAD: 'CANTIDAD', OPERARIO: 'OPERARIO',
  OT: 'OT', FECHA: 'FECHA INICIO', PARCIAL: 'PARCIAL'
};
var PNL_COLS_ENCURSO = {
  OPERARIO: 'OPERARIO', OT: 'OT', TAREA: 'COD TAREA', MODELO: 'MODELO', CANTIDAD: 'CANTIDAD',
  ESTADO: 'ESTADO', ULTIMA: 'ULTIMA FECHA', MINEST: 'MIN ESTIMADOS', FINEST: 'FIN ESTIMADO',
  INICIO_MS: 'INICIO (MS)'
};
var PNL_COLS_RRHH = { LEGAJO: 'LEGAJO', APELLIDO: 'APELLIDO', NOMBRE: 'NOMBRE', PUESTO: 'PUESTO', ESTADO: 'ESTADO' };
var PNL_ENC_ALERTAS = ['ID', 'FECHA', 'HORA', 'TIPO', 'NIVEL', 'OPERARIO', 'CODIGO', 'DESCRIPCION',
  'CANTIDAD', 'OT', 'TAREA', 'REGLAS', 'MOTIVO', 'OBSERVACION', 'ID MOVIMIENTO', 'REGISTRADO POR',
  'ESTADO', 'REVISADO POR', 'FECHA REVISION', 'COMENTARIO'];

/* ------------------------------------------------------------------ */
/*  Entradas                                                           */
/* ------------------------------------------------------------------ */

/** Llamar desde el onOpen() del proyecto (ver Panol_Menu). */
function agregarMenuPanol_() {
  SpreadsheetApp.getUi()
    .createMenu('Pañol')
    .addItem('Egreso / Ingreso de pañol', 'abrirModalPanol')
    .addItem('Depósito mayorista (administración)', 'abrirModalDeposito')
    .addItem('Precios de insumos (administración)', 'abrirModalPrecios')
    .addItem('Producto (árbol, planos y costos)', 'abrirModalProducto')
    .addSeparator()
    .addItem('Preparar depósito mayorista (una vez)', 'depositoPrepararColumnas')
    .addItem('Completar OPERADOR (corregido) de la consola', 'panolCompletarCorregidos')
    .addItem('Limpiar caché del pañol', 'panolLimpiarCache')
    .addToUi();
}

function abrirModalPanol() {
  var t = pnlPlantilla_('PanolModal');
  t.token = '';
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(1420).setHeight(900), 'Pañol · Sistema Mayo');
}

/**
 * Abre la plantilla HTML aunque el archivo se haya creado con otra combinación de
 * mayúsculas/minúsculas (PreciosModal, preciosModal, Preciosmodal…). Si no existe con
 * ninguna, avisa el nombre exacto que hay que crear.
 */
function pnlPlantilla_(nombre) {
  var variantes = [nombre, nombre.charAt(0).toLowerCase() + nombre.slice(1), nombre.toLowerCase(),
    nombre.charAt(0) + nombre.slice(1).toLowerCase(), nombre.toUpperCase()];
  for (var i = 0; i < variantes.length; i++) {
    try { return HtmlService.createTemplateFromFile(variantes[i]); } catch (e) {}
  }
  throw new Error('Falta el archivo HTML "' + nombre + '" en el proyecto. Crealo con + › HTML y escribí exactamente ' + nombre + ' (sin .html).');
}

/** Para usar como Web App desde el Tablero (?token=...). Ver Panol_Menu. */
function panolDoGet(e) {
  var v = e && e.parameter ? String(e.parameter.v || '') : '';
  if ((v === 'insumo' || v === 'insumos' || v === 'deposito') && typeof depositoDoGet === 'function') return depositoDoGet(e);
  if (v === 'precios' && typeof preciosDoGet === 'function') return preciosDoGet(e);
  if (v === 'producto' && typeof productoDoGet === 'function') return productoDoGet(e);
  if (v === 'producto') return pnlPaginaSimple_('Producto · Sistema Mayo', 'Producto (gerencia)',
    'Este módulo todavía está en desarrollo: va a recalcular el costo de los productos con los precios de insumos, con simulación y aprobación.');
  if (v === 'mantenimiento' && typeof mantenimientoDoGet === 'function') return mantenimientoDoGet(e);
  if (v === 'diag') return pnlDiagnosticoWeb_(e);
  var t = pnlPlantilla_('PanolModal');
  t.token = (e && e.parameter && e.parameter.token) ? String(e.parameter.token) : '';
  return t.evaluate()
    .setTitle('Pañol · Sistema Mayo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

var PANOL_VERSION = '2026-10-26 a';

/** Página simple con el estilo del sistema (módulos en desarrollo, avisos). */
function pnlPaginaSimple_(titulo, encabezado, texto) {
  var e = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{margin:0;background:#0f172a;color:#e2e8f0;font:14px/1.5 "Segoe UI",Roboto,Arial,sans-serif}header{display:flex;gap:14px;align-items:center;padding:10px 16px;background:#0b1222;border-bottom:2px solid #dc2626}' +
    '.logo{background:#dc2626;color:#fff;font-weight:800;letter-spacing:2px;padding:4px 10px;border-radius:4px}main{padding:24px 16px;max-width:900px}' +
    '.card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #334155;padding:6px;text-align:left;vertical-align:top}' +
    'th{background:#0f172a}.ok{color:#4ade80;font-weight:700}.err{color:#f87171;font-weight:700}code{color:#38bdf8}</style></head><body>' +
    '<header><span class="logo">MAYO</span><b>' + e(encabezado) + '</b></header><main><div class="card">' + texto + '</div></main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(titulo).addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ?v=diag — revisa la instalación sin tocar datos: versión del código, qué archivos HTML
 * encuentra (y con qué nombre), cómo empiezan y qué funciones están cargadas.
 */
function pnlDiagnosticoWeb_(e) {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var filas = ['PanolModal', 'DepositoModal', 'PreciosModal', 'ProductoModal', 'MantenimientoModal'].map(function (n) {
    var variantes = [n, n.charAt(0).toLowerCase() + n.slice(1), n.toLowerCase(), n.charAt(0) + n.slice(1).toLowerCase(), n.toUpperCase()];
    for (var i = 0; i < variantes.length; i++) {
      try {
        var raw = HtmlService.createTemplateFromFile(variantes[i]).getRawContent();
        var titulo = (raw.match(/<title>([^<]*)<\/title>/) || [])[1] || '(sin título)';
        var marca = (raw.match(/ARCHIVO: (\w+)/) || [])[1] || '';
        var bien = raw.length > 5000 && (!marca || marca === n);
        return '<tr><td><b>' + n + '</b></td><td class="' + (bien ? 'ok' : 'err') + '">' + (bien ? 'OK' : 'REVISAR') + '</td><td>' + esc(variantes[i]) +
          '</td><td>' + raw.length + '</td><td>' + esc(titulo) + (marca && marca !== n ? '<br><span class="err">tiene pegado el contenido de ' + esc(marca) + '</span>' : '') +
          (raw.length <= 5000 ? '<br><span class="err">el archivo está casi vacío: falta pegar el contenido</span>' : '') + '</td></tr>';
      } catch (x) {}
    }
    return '<tr><td><b>' + n + '</b></td><td class="err">FALTA</td><td colspan="3">No existe: crealo con + › HTML › <code>' + n + '</code></td></tr>';
  }).join('');
  var funcs = ['panolDoGet', 'depositoDoGet', 'preciosDoGet', 'productoDoGet', 'depositoInit', 'preciosInit', 'productoInit', 'pnlPlantilla_'].map(function (f) {
    var hay = false; try { hay = typeof eval(f) === 'function'; } catch (x) {}
    return '<code>' + f + '</code> <span class="' + (hay ? 'ok' : 'err') + '">' + (hay ? 'OK' : 'FALTA') + '</span>';
  }).join(' · ');
  var html = '<p>Versión del código: <b>' + PANOL_VERSION + '</b> · URL de la implementación: <code>' + esc(ScriptApp.getService().getUrl() || '') + '</code></p>' +
    '<p>Parámetros recibidos: <code>' + esc(JSON.stringify(e && e.parameter ? e.parameter : {})) + '</code></p>' +
    '<table><tr><th>Archivo HTML esperado</th><th>Estado</th><th>Nombre encontrado</th><th>Tamaño</th><th>Título / detalle</th></tr>' + filas + '</table>' +
    '<p style="margin-top:14px">Funciones: ' + funcs + '</p>' +
    '<p class="peq" style="color:#94a3b8">Tamaños esperados aproximados: PanolModal ~47.000, DepositoModal ~64.000, PreciosModal ~44.000, ProductoModal ~50.000 caracteres.</p>';
  return pnlPaginaSimple_('Diagnóstico · Sistema Mayo', 'Diagnóstico de instalación — Pañol / Depósito / Precios', html);
}

/* ------------------------------------------------------------------ */
/*  API para el modal (google.script.run)                              */
/* ------------------------------------------------------------------ */

function panolInit(token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    var ops = pnlOperarios_(true);
    var cat = pnlCatalogo_();
    var guardado = '';
    try { guardado = PropertiesService.getScriptProperties().getProperty('pnl_encargado_' + u.email) || ''; } catch (e) {}
    return {
      usuario: u.email,
      puedeRevisar: u.puedeRevisar,
      authlib: u.authlib,
      operarios: ops.lista.map(function (o) { return [o.leg, o.disp, o.puesto, o.activo ? 1 : 0]; }),
      catalogo: cat,
      familias: pnlFamiliasPresentes_(cat),
      motivos: PANOL_CFG.MOTIVOS,
      motivosAjuste: PANOL_CFG.MOTIVOS_AJUSTE,
      encargado: guardado,
      traz: typeof trzConfigCliente_ === 'function' ? trzConfigCliente_(true) : null,
      puestos: typeof pueCliente_ === 'function' ? pueCliente_() : null,
      alertasPendientes: pnlContarAlertasPendientes_(),
      pasesPendientes: typeof depositoContarPasesPendientes_ === 'function' ? depositoContarPasesPendientes_() : 0,
      urlApp: (function () { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } })(),
      generado: Utilities.formatDate(new Date(), PANOL_CFG.TZ, 'dd/MM/yyyy HH:mm')
    };
  });
}

function panolGuardarEncargado(legajo, token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    PropertiesService.getScriptProperties().setProperty('pnl_encargado_' + u.email, String(legajo || ''));
    return true;
  });
}

/** OT y tarea en curso (EN_CURSO / TIEMPOS) + retiros recientes del operario. */
function panolContextoOperario(legajo, token) {
  return pnlEnvolver_(function () {
    panolAcceso_(token);
    return pnlContextoOperario_(legajo);
  });
}

function pnlContextoOperario_(legajo) {
  {
    var leg = String(legajo || '').trim();
    if (!leg) throw new Error('Elegí un operario.');
    var idx = pnlIndiceOperarios_();
    var op = idx.porLeg[leg];
    if (!op) throw new Error('No encuentro el legajo ' + leg + ' en RRHH.');

    var enCurso = pnlEnCursoDe_(leg);
    var ultimo = enCurso.length ? null : pnlUltimaTareaTiempos_(leg);
    var M = pnlMinutos_();
    var mo = M.porOp[leg] || { tot180: 0, tot30: 0, tareas: {} };
    var tareas = Object.keys(mo.tareas).map(function (t) { return { tarea: t, desc: pnlDescTarea_(t, ''), min: Math.round(mo.tareas[t]) }; })
      .sort(function (a, b) { return b.min - a.min; }).slice(0, 8);

    var recientes = pnlMovimientosOperario_(leg, 60, 25);
    return {
      operario: { leg: op.leg, disp: op.disp, puesto: op.puesto, activo: op.activo },
      ultimoPuesto: typeof pueUltimo_ === 'function' ? pueUltimo_(leg) : null,
      enCurso: enCurso,
      ultimo: ultimo,
      minutos: { d30: Math.round(mo.tot30), d180: Math.round(mo.tot180), ultimo: pnlTextoDia_(mo.ult), aviso: M.error || '' },
      tareas: tareas,
      recientes: recientes
    };
  }
}

/** Control previo al descuento. No escribe nada. */
function panolEvaluarEgreso(p, token) {
  return pnlEnvolver_(function () {
    var t0 = Date.now(), ms = {};
    var paso = function (k) { var t = Date.now(); ms[k] = t - t0; t0 = t; };
    panolAcceso_(token); paso('acceso');
    var d = pnlValidarEgreso_(p);
    var item = pnlItemVivo_(d.codigo, false); paso('insumo');
    var ev = pnlEvaluar_(d, item); paso('reglas');
    if (typeof pueAplicar_ === 'function') { pueAplicar_(ev, d, item, p); paso('puesto'); }
    if (typeof trzOpciones_ === 'function') { ev.traz = trzOpciones_(d.codigo); paso('tubos'); }
    ev.tiempos = ms;
    return ev;
  });
}

/**
 * Precarga en segundo plano lo que necesita el control previo (minutos de TIEMPOS, consumos de 180 días,
 * retiros del código elegido) para que "Verificar retiro" responda rápido. La llama la pantalla sola.
 */
function panolPrecargar(codigo, token) {
  return pnlEnvolver_(function () {
    panolAcceso_(token, ['panol', 'insumo', 'insumos', 'admin']);
    var t0 = Date.now();
    try { pnlMinutos_(); } catch (e) {}
    try { pnlUso180_(); } catch (e) {}
    try { pnlFamTipo_(); } catch (e) {}
    var cod = pnlCodigo_(codigo);
    if (cod) { try { pnlEgresosCodigo_(cod); } catch (e) {} }
    return { ms: Date.now() - t0 };
  });
}

/** Registra el egreso. Vuelve a evaluar del lado del servidor. */
function panolRegistrarEgreso(p, token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    var d = pnlValidarEgreso_(p);
    var idx = pnlIndiceOperarios_();
    var op = idx.porLeg[d.legajo];
    if (!op) throw new Error('No encuentro el legajo ' + d.legajo + ' en RRHH.');
    var enc = idx.porLeg[String(p.encargado || '')];
    if (!enc) throw new Error('Elegí el encargado de pañol que entrega.');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw new Error('Otro movimiento se está registrando. Probá de nuevo en unos segundos.');
    try {
      var item = pnlItemVivo_(d.codigo, true);
      var ev = pnlEvaluar_(d, item);
      var PU = typeof pueAplicar_ === 'function' ? pueAplicar_(ev, d, item, p) : { puesto: '', maquina: '' };
      // trazabilidad: tubos de gas (N° de tubo) y pinturas (lote); un lote vencido es desvío R6
      var V = typeof trzValidarEgreso_ === 'function' ? trzValidarEgreso_(d.codigo, d.cantidad, p) : null;
      if (V) { trzSumarRegla_(ev, V); ev.traz = trzOpciones_(d.codigo); }
      var motivo = String(p.motivo || '').trim();
      var obs = String(p.observacion || '').trim();
      if (ev.anormal) {
        if (!motivo) return { requiereMotivo: true, evaluacion: ev };
        if (!obs) throw new Error('El retiro tiene desvíos: escribí una observación que lo justifique.');
      }
      var saldo = pnlRedondear_(item.stock - d.cantidad, 3);
      var reglasTxt = ev.reglas.filter(function (r) { return r.nivel === 'alerta'; }).map(function (r) { return r.id; }).join(',');
      var mov = pnlEscribirMovimiento_({
        codigo: d.codigo, descripcion: pnlDescMovimiento_(item), cantidad: -d.cantidad, saldo: saldo,
        operador: op.corto, consola: enc.corto, opcorr: op.disp, ot: d.ot, tarea: d.tarea,
        tipo: 'EGRESO', obs: V ? trzObs_(obs, trzObsMov_(V, item)) : obs, motivo: ev.anormal ? (motivo + ' | ' + reglasTxt) : '',
        puesto: PU.puesto, maquina: PU.maquina,
        tubo: V && V.tipo === 'GAS' ? V.texto : '', lote: V && V.tipo === 'PINTURA' ? V.texto : '',
        peso: V && V.tipo === 'GAS' ? trzPesoTubos_(V, item) : ''
      });
      pnlActualizarStock_(item, -d.cantidad);
      if (typeof pueGuardarUltimo_ === 'function') pueGuardarUltimo_(d.legajo, PU.puesto, PU.maquina);
      var asignada = typeof pueAsignarDesdeRetiro_ === 'function' ? pueAsignarDesdeRetiro_(PU.puesto, PU.maquina, u.email) : '';
      if (V) { V.maquina = PU.maquina; V.puesto = PU.puesto; trzAplicarEgreso_(d.codigo, item, V, mov.id, op, d, u.email); }
      pnlLimpiarCacheCodigo_(d.codigo);

      var alertas = [];
      if (ev.anormal) {
        alertas.push(pnlCrearAlerta_({
          tipo: 'DESVIO', nivel: 'ALERTA', operario: op.disp, codigo: d.codigo, descripcion: item.desc,
          cantidad: d.cantidad, ot: d.ot, tarea: d.tarea,
          reglas: ev.reglas.filter(function (r) { return r.nivel === 'alerta'; }).map(function (r) { return r.id + ' ' + r.titulo; }).join(' · '),
          motivo: motivo, observacion: obs, idMov: mov.id, por: enc.disp + ' (' + u.email + ')'
        }));
      }
      // el operativo se repone por consumo: si quedó bajo el mínimo de la semana, alerta para el pase
      if (ev.reponer) {
        var a2 = pnlAlertaReponer_(item, saldo, ev.consumo, mov.id, enc.disp);
        if (a2) alertas.push(a2);
      }
      return { id: mov.id, saldo: saldo, alertas: alertas, anormal: ev.anormal, asignacion: asignada === 'asignada' ? { puesto: PU.puesto, maquina: PU.maquina } : undefined };
    } finally {
      lock.releaseLock();
    }
  });
}

/** Ingreso de mercadería (compra / proveedor). */
function panolRegistrarIngreso(p, token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    var cod = pnlCodigo_(p.codigo);
    var cant = pnlNumero_(p.cantidad);
    if (!cod) throw new Error('Elegí el insumo.');
    if (!(cant > 0)) throw new Error('La cantidad debe ser mayor a cero.');
    var idx = pnlIndiceOperarios_();
    var enc = idx.porLeg[String(p.encargado || '')];
    if (!enc) throw new Error('Elegí el encargado de pañol que recibe.');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw new Error('Otro movimiento se está registrando. Probá de nuevo en unos segundos.');
    try {
      var item = pnlItemVivo_(cod, true);
      var V = typeof trzValidarIngreso_ === 'function' ? trzValidarIngreso_(cod, cant, p, item) : null;
      var saldo = pnlRedondear_(item.stock + cant, 3);
      var partes = [];
      if (p.proveedor) partes.push('Prov: ' + String(p.proveedor).trim());
      if (p.remito) partes.push('Remito: ' + String(p.remito).trim());
      if (p.observacion) partes.push(String(p.observacion).trim());
      if (V && V.obs) partes.push(V.obs);
      var mov = pnlEscribirMovimiento_({
        codigo: cod, descripcion: pnlDescMovimiento_(item), cantidad: cant, saldo: saldo,
        operador: enc.corto, consola: enc.corto, opcorr: enc.disp, tipo: 'INGRESO',
        lote: V && V.tipo === 'PINTURA' ? V.texto : pnlNumOTexto_(p.lote),
        peso: V && V.tipo === 'GAS' ? V.peso : (p.peso === '' || p.peso === undefined ? '' : pnlNumero_(p.peso)),
        tubo: V && V.tipo === 'GAS' ? V.texto : pnlNumOTexto_(p.tubo), obs: partes.join(' · ')
      });
      pnlActualizarStock_(item, cant);
      if (V) trzAplicarIngreso_(cod, item, V, cant, p, u.email);
      pnlLimpiarCacheCodigo_(cod);
      return { id: mov.id, saldo: saldo };
    } finally {
      lock.releaseLock();
    }
  });
}

/** Ajuste de inventario: se informa el stock contado; queda alerta para administración. */
function panolRegistrarAjuste(p, token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    var cod = pnlCodigo_(p.codigo);
    var contado = pnlNumero_(p.contado);
    if (!cod) throw new Error('Elegí el insumo.');
    if (contado === null || contado < 0) throw new Error('Ingresá el stock contado (0 o más).');
    var motivo = String(p.motivo || '').trim();
    var obs = String(p.observacion || '').trim();
    if (!motivo) throw new Error('Elegí el motivo del ajuste.');
    if (!obs) throw new Error('Escribí una observación del ajuste.');
    var idx = pnlIndiceOperarios_();
    var enc = idx.porLeg[String(p.encargado || '')];
    if (!enc) throw new Error('Elegí el encargado de pañol.');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw new Error('Otro movimiento se está registrando. Probá de nuevo en unos segundos.');
    try {
      var item = pnlItemVivo_(cod, true);
      var delta = pnlRedondear_(contado - item.stock, 3);
      if (delta === 0) throw new Error('El stock contado es igual al del sistema: no hay nada que ajustar.');
      var mov = pnlEscribirMovimiento_({
        codigo: cod, descripcion: pnlDescMovimiento_(item), cantidad: delta, saldo: contado,
        operador: enc.corto, consola: enc.corto, opcorr: enc.disp, tipo: 'AJUSTE',
        obs: obs, motivo: motivo
      });
      pnlActualizarStock_(item, delta);
      pnlLimpiarCacheCodigo_(cod);
      var a = pnlCrearAlerta_({
        tipo: 'AJUSTE', nivel: 'AVISO', operario: enc.disp, codigo: cod, descripcion: item.desc,
        cantidad: delta, reglas: 'Sistema ' + item.stock + ' → contado ' + contado,
        motivo: motivo, observacion: obs, idMov: mov.id, por: enc.disp + ' (' + u.email + ')'
      });
      return { id: mov.id, saldo: contado, delta: delta, alertas: [a] };
    } finally {
      lock.releaseLock();
    }
  });
}

/** Historial y estadísticas de un operario (por tareas desempeñadas). */
function panolHistorialOperario(legajo, dias, token) {
  return pnlEnvolver_(function () {
    panolAcceso_(token);
    var leg = String(legajo || '').trim();
    var nd = Math.max(30, Math.min(730, Number(dias) || PANOL_CFG.VENTANA_DIAS));
    var idx = pnlIndiceOperarios_();
    var op = idx.porLeg[leg];
    if (!op) throw new Error('No encuentro el legajo ' + leg + '.');
    var movs = pnlMovimientosOperario_(leg, nd, 600);
    var M = pnlMinutos_();
    // sin datos y caché vieja (> 30 min): se vuelve a leer TIEMPOS una vez (puede haber registros nuevos)
    if (!M.porOp[leg] && !M.error && (!M.ts || Date.now() - M.ts > 1800000)) {
      pnlBorrarCache_(CacheService.getScriptCache(), 'pnl_min_v2');
      M = pnlMinutos_();
    }
    var U = pnlUso180_();
    var mo = M.porOp[leg] || { tot180: 0, tot30: 0, tareas: {} };
    var pistas = (!movs.length || !mo.ult) ? pnlPistasOperario_(op, leg, M, !movs.length, !mo.ult) : {};
    var principal = pnlTareaPrincipal_(mo);
    var cat = pnlCatalogoMapa_();

    // Resumen por código en la ventana elegida
    var porCod = {};
    movs.forEach(function (m) {
      if (m.cantidad >= 0) return;
      var r = porCod[m.codigo] || (porCod[m.codigo] = { codigo: m.codigo, desc: m.desc, n: 0, cant: 0, ultimo: m.fecha });
      r.n++; r.cant += -m.cantidad;
    });
    // Tasa por 1000 min (180 días) vs. planta y vs. pares de su tarea principal
    var resumen = Object.keys(porCod).map(function (c) {
      var r = porCod[c];
      var t = pnlTasasCodigo_(c, leg, principal, M, U);
      r.cant = pnlRedondear_(r.cant, 2);
      r.tasa = t.mia; r.medPlanta = t.medPlanta; r.medPares = t.medPares; r.nPares = t.nPares;
      var ref = t.nPares >= PANOL_CFG.MIN_PARES ? t.ref : (t.medPlanta || 0);
      r.ratio = ref > 0 && t.mia !== null ? pnlRedondear_(t.mia / ref, 2) : null;
      r.familia = cat[c] ? cat[c].familia : '';
      return r;
    }).sort(function (a, b) { return (b.ratio || 0) - (a.ratio || 0); });

    var tareas = Object.keys(mo.tareas).map(function (t) { return { tarea: t, desc: pnlDescTarea_(t, ''), min: Math.round(mo.tareas[t]) }; })
      .sort(function (a, b) { return b.min - a.min; });

    return {
      operario: { leg: op.leg, disp: op.disp, puesto: op.puesto, activo: op.activo },
      dias: nd,
      ultimoRetiro: pistas.ultimoRetiro || null,
      pistas: pistas.textos || [],
      minutos: { d30: Math.round(mo.tot30), d180: Math.round(mo.tot180), ultimo: pnlTextoDia_(mo.ult), aviso: M.error || '' },
      principal: principal ? { tarea: principal, desc: pnlDescTarea_(principal, '') } : null,
      tareas: tareas,
      resumen: resumen,
      movimientos: movs
    };
  });
}

/** Historial y ranking de un insumo. */
function panolHistorialInsumo(codigo, token) {
  return pnlEnvolver_(function () {
    panolAcceso_(token);
    var cod = pnlCodigo_(codigo);
    if (!cod) throw new Error('Elegí un insumo.');
    var item = pnlItemVivo_(cod, false);
    var hoy = pnlHoy_();
    var eg = pnlEgresosCodigo_(cod);
    var M = pnlMinutos_();
    var idx = pnlIndiceOperarios_();

    // Serie mensual 12 meses
    var meses = {};
    eg.forEach(function (r) { var k = r.y + '-' + pnlPad2_(r.m); meses[k] = (meses[k] || 0) + r.cant; });
    var serie = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      var k = Utilities.formatDate(d, PANOL_CFG.TZ, 'yyyy-MM');
      serie.push({ mes: k, cant: pnlRedondear_(meses[k] || 0, 2) });
    }
    var u90 = 0, u30 = 0;
    eg.forEach(function (r) { if (r.dia >= hoy.dia - 90) u90 += r.cant; if (r.dia >= hoy.dia - 30) u30 += r.cant; });
    var diario = u90 / 90;

    // Por operario (180 días)
    var porOp = {};
    eg.forEach(function (r) {
      if (r.dia < hoy.dia - PANOL_CFG.VENTANA_DIAS) return;
      var k = r.leg || ('? ' + r.original);
      var o = porOp[k] || (porOp[k] = { leg: r.leg, n: 0, cant: 0, c30: 0, ultimo: r.dia });
      o.n++; o.cant += r.cant; if (r.dia >= hoy.dia - 30) o.c30 += r.cant; if (r.dia > o.ultimo) o.ultimo = r.dia;
    });
    var tasas = [];
    var filas = Object.keys(porOp).map(function (k) {
      var o = porOp[k];
      var mo = o.leg ? M.porOp[o.leg] : null;
      var tasa = mo && mo.tot180 > 0 ? o.cant / mo.tot180 * 1000 : null;
      if (tasa !== null && mo.tot180 >= PANOL_CFG.MIN_MIN_TOTAL_PAR) tasas.push(tasa);
      var pr = mo ? pnlTareaPrincipal_(mo) : '';
      return {
        leg: o.leg, operario: o.leg && idx.porLeg[o.leg] ? idx.porLeg[o.leg].disp : k,
        retiros: o.n, cant: pnlRedondear_(o.cant, 2), c30: pnlRedondear_(o.c30, 2),
        min180: mo ? Math.round(mo.tot180) : 0, tasa: tasa === null ? null : pnlRedondear_(tasa, 3),
        tarea: pr ? pr + ' ' + pnlDescTarea_(pr, '') : '', ultimo: pnlTextoDia_(o.ultimo)
      };
    });
    var med = pnlMediana_(tasas);
    filas.forEach(function (f) { f.ratio = f.tasa !== null && med > 0 ? pnlRedondear_(f.tasa / med, 2) : null; f.desvio = f.ratio !== null && f.ratio > PANOL_CFG.FACTOR_PARES && f.cant >= PANOL_CFG.MIN_UNIDADES_ALERTA; });
    filas.sort(function (a, b) { return (b.ratio || 0) - (a.ratio || 0) || b.cant - a.cant; });

    return {
      item: pnlItemCliente_(item),
      serie: serie,
      u30: pnlRedondear_(u30, 2), u90: pnlRedondear_(u90, 2),
      coberturaDias: diario > 0 ? Math.floor(Math.max(item.stock, 0) / diario) : null,
      medianaTasa: pnlRedondear_(med, 3),
      operarios: filas,
      ultimos: eg.slice(-30).reverse().map(function (r) {
        return { fecha: pnlTextoDia_(r.dia), hora: r.hora, cant: r.cant, operario: r.leg && idx.porLeg[r.leg] ? idx.porLeg[r.leg].disp : r.original, ot: r.ot, tarea: r.tarea, motivo: r.motivo };
      })
    };
  });
}

/**
 * Alertas (desvíos de egreso, diferencias de pases y ajustes). Desde 13/10 la pestaña está solo en
 * Depósito e Insumos (depositoAlertas / depositoActualizarAlerta); esta función queda por compatibilidad.
 */
function panolAlertas(estado, token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    return { alertas: pnlListarAlertas_(estado), puedeRevisar: u.puedeRevisar };
  });
}
function pnlListarAlertas_(estado) {
    var h = pnlHojaAlertas_();
    var n = h.getLastRow() - 1;
    if (n <= 0) return [];
    var desde = Math.max(2, h.getLastRow() - 1499);
    var vals = h.getRange(desde, 1, h.getLastRow() - desde + 1, PNL_ENC_ALERTAS.length).getValues();
    var filtro = String(estado || '').toUpperCase();
    var out = [];
    for (var i = vals.length - 1; i >= 0 && out.length < 400; i--) {
      var r = vals[i];
      var o = {};
      PNL_ENC_ALERTAS.forEach(function (k, j) { o[k] = pnlTexto_(r[j], k); });
      if (filtro && filtro !== 'TODAS' && String(o.ESTADO).toUpperCase() !== filtro) continue;
      out.push(o);
    }
    return out;
}

function panolActualizarAlerta(id, estado, comentario, token) {
  return pnlEnvolver_(function () {
    var u = panolAcceso_(token);
    if (!u.puedeRevisar) throw new Error('Solo administración puede cambiar el estado de una alerta.');
    return pnlActualizarAlerta_(id, estado, comentario, u.email);
  });
}
function pnlActualizarAlerta_(id, estado, comentario, email) {
    var u = { email: email };
    var est = String(estado || '').toUpperCase();
    if (['PENDIENTE', 'REVISADA', 'INFORMADA', 'DESCARTADA'].indexOf(est) < 0) throw new Error('Estado inválido.');
    var h = pnlHojaAlertas_();
    var f = h.getRange(2, 1, Math.max(1, h.getLastRow() - 1), 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (!f) throw new Error('No encuentro la alerta ' + id);
    var fila = f.getRow();
    var c = function (k) { return PNL_ENC_ALERTAS.indexOf(k) + 1; };
    h.getRange(fila, c('ESTADO')).setValue(est);
    h.getRange(fila, c('REVISADO POR')).setValue(u.email);
    h.getRange(fila, c('FECHA REVISION')).setValue(Utilities.formatDate(new Date(), PANOL_CFG.TZ, 'dd/MM/yyyy HH:mm'));
    if (comentario !== undefined && comentario !== null) h.getRange(fila, c('COMENTARIO')).setValue(String(comentario));
    return true;
}

/* ------------------------------------------------------------------ */
/*  Mantenimiento                                                      */
/* ------------------------------------------------------------------ */

/**
 * Completa "OPERADOR (corregido)" en las filas que carga la consola vieja
 * (últimas 5000 filas). Se puede programar con un activador diario.
 */
function panolCompletarCorregidos() {
  var hoja = pnlHojaConsumos_();
  var cols = pnlColsConsumos_();
  if (cols.OPCORR === null || cols.OPERADOR === null) throw new Error('Faltan columnas OPERADOR / OPERADOR (corregido).');
  var ult = hoja.getLastRow();
  var desde = Math.max(2, ult - 4999);
  var n = ult - desde + 1;
  if (n <= 0) return 0;
  var h = hoja.getRange(desde, cols.OPERADOR + 1, n, 1).getValues();
  var f = hoja.getRange(desde, cols.FECHA + 1, n, 1).getValues();
  var rng = hoja.getRange(desde, cols.OPCORR + 1, n, 1);
  var c = rng.getValues();
  var idx = pnlIndiceOperarios_();
  var cambios = 0;
  for (var i = 0; i < n; i++) {
    if (String(c[i][0]).trim() !== '' || String(h[i][0]).trim() === '') continue;
    var leg = pnlLegajoDe_(h[i][0], f[i][0], idx);
    c[i][0] = leg && idx.porLeg[leg] ? idx.porLeg[leg].disp : String(h[i][0]).trim();
    cambios++;
  }
  if (cambios) rng.setValues(c);
  try { SpreadsheetApp.getActive().toast('Filas completadas: ' + cambios, 'Pañol', 5); } catch (e) {}
  return cambios;
}

/** Generación de la caché de retiros por código: subirla invalida todos los códigos de una vez. */
function pnlGenCache_() {
  var c = CacheService.getScriptCache(), g = c.get('pnl_gen');
  if (!g) { g = String(Date.now() % 100000); c.put('pnl_gen', g, 21600); }
  return g;
}

/**
 * "↻ Actualizar datos" del pañol: vuelve a leer todo (retiros, consumos, TIEMPOS, catálogo).
 * Para cuando se corrigen datos a mano en las planillas (ej. códigos cambiados en consumos).
 */
function panolActualizarDatos(token) {
  return pnlEnvolver_(function () {
    panolAcceso_(token, ['panol', 'insumo', 'insumos', 'admin']);
    panolLimpiarCache();
    return true;
  });
}

function panolLimpiarCache() {
  var c = CacheService.getScriptCache();
  PNL_BLOQUE_MEMO_ = {};
  c.put('pnl_gen', String((Number(c.get('pnl_gen')) || 0) + 1), 21600);   // retiros por código
  ['pnl_ops_v1', 'pnl_cat_v2', 'pnl_dep_cat_v2', 'pnl_min_v2', 'pnl_uso180_v1', 'pnl_uso180_v2', 'pnl_tareas_v1', 'pnl_famtipo_v1', 'pnl_pue_v2'].forEach(function (k) { pnlBorrarCache_(c, k); });
  ['consumos', 'tiempos', 'encurso'].forEach(function (k) { c.remove('pnl_cols_' + k); });
  try { SpreadsheetApp.getActive().toast('Caché del pañol limpia', 'Pañol', 4); } catch (e) {}
  return true;
}

/* ------------------------------------------------------------------ */
/*  Acceso (AuthLib)                                                   */
/* ------------------------------------------------------------------ */

/**
 * - Desde el menú de la planilla: usuario de Google activo + AuthLib.tienePermiso(email,'panol').
 * - Como Web App (?token=): AuthLib.validarSesion(token) + permiso.
 * Si el proyecto no tiene la librería AuthLib, el modal desde la planilla
 * funciona (lo protege el acceso a la planilla) y la Web App se bloquea.
 */
function panolAcceso_(token, permisosEntrada) {
  // Cada consulta a AuthLib tarda: el resultado se guarda 5 minutos por sesión y juego de permisos.
  var cache = null, clave = '';
  if (token) {
    try {
      cache = CacheService.getScriptCache();
      clave = 'pnl_acc_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, token + '|' + (permisosEntrada || []).join(','))).slice(0, 22);
      var c = cache.get(clave);
      if (c) return JSON.parse(c);
    } catch (e) { cache = null; }
  }
  var r = pnlAccesoSinCache_(token, permisosEntrada);
  if (cache && clave) { try { cache.put(clave, JSON.stringify(r), 300); } catch (e) {} }
  return r;
}
function pnlAccesoSinCache_(token, permisosEntrada) {
  var hayLib = (typeof AuthLib !== 'undefined');
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  if (token) {
    if (!hayLib) throw new Error('Falta agregar la librería AuthLib al proyecto.');
    email = pnlEmailDeSesion_(AuthLib.validarSesion(token));
    if (!email) throw new Error('Sesión vencida o inválida. Volvé a ingresar desde el Tablero.');
  }
  var puedeRevisar = !hayLib;
  if (hayLib && typeof AuthLib.tienePermiso === 'function') {
    if (!email) throw new Error('No se pudo identificar al usuario de Google.');
    var tiene = function (perm) { try { return !!AuthLib.tienePermiso(email, perm); } catch (e) { return false; } };
    var entrada = permisosEntrada || [PANOL_CFG.PERMISO, 'admin'];
    var ok = entrada.some(tiene);
    if (!ok) throw new Error('El usuario ' + email + ' no tiene el permiso "' + entrada[0] + '".');
    puedeRevisar = PANOL_CFG.PERMISOS_REVISION.some(tiene);
  }
  return { email: email || 'usuario de la planilla', authlib: hayLib, puedeRevisar: puedeRevisar };
}

function pnlEmailDeSesion_(s) {
  if (!s) return '';
  if (typeof s === 'string') return s.indexOf('@') > 0 ? s : '';
  if (s.ok === false || s.valida === false || s.valido === false || s.valid === false || s.success === false) return '';
  if (s.status && String(s.status).toUpperCase() !== 'OK') return '';
  var e = s.email || s.mail || s.user || s.usuario || (s.data && (s.data.email || s.data.usuario)) || '';
  if (e && typeof e === 'object') e = e.email || e.mail || '';
  return String(e).indexOf('@') > 0 ? String(e) : '';
}

/* ------------------------------------------------------------------ */
/*  Evaluación de desvíos                                              */
/* ------------------------------------------------------------------ */

function pnlValidarEgreso_(p) {
  p = p || {};
  var leg = String(p.legajo || '').trim();
  var cod = pnlCodigo_(p.codigo);
  var cant = pnlNumero_(p.cantidad);
  if (!leg) throw new Error('Elegí el operario.');
  if (!cod) throw new Error('Elegí el insumo.');
  if (!(cant > 0)) throw new Error('La cantidad debe ser mayor a cero.');
  return { legajo: leg, codigo: cod, cantidad: cant, ot: String(p.ot || '').trim(), tarea: String(p.tarea || '').trim() };
}

function pnlEvaluar_(d, item) {
  var C = PANOL_CFG;
  var hoy = pnlHoy_();
  var eg = pnlEgresosCodigo_(d.codigo);
  var M = pnlMinutos_();
  var U = pnlUso180_();
  var idx = pnlIndiceOperarios_();
  var reglas = [];
  var add = function (id, nivel, titulo, detalle) { reglas.push({ id: id, nivel: nivel, titulo: titulo, detalle: detalle }); };

  var propios = eg.filter(function (r) { return r.leg === d.legajo; });
  var previos = propios.slice(-12).reverse().map(function (r) {
    return { fecha: pnlTextoDia_(r.dia), hora: r.hora, cant: r.cant, ot: r.ot, tarea: r.tarea, motivo: r.motivo, hace: hoy.dia - r.dia };
  });

  // R1 — Repetición / frecuencia
  var interPropios = pnlIntervalos_(propios);
  var porOp = {};
  eg.forEach(function (r) { if (r.leg) (porOp[r.leg] = porOp[r.leg] || []).push(r); });
  var interPlanta = [];
  Object.keys(porOp).forEach(function (k) { interPlanta = interPlanta.concat(pnlIntervalos_(porOp[k])); });
  var medPropia = interPropios.length >= 3 ? pnlMediana_(interPropios) : null;
  var medPlanta = interPlanta.length >= 5 ? pnlMediana_(interPlanta) : null;
  var refFrec = medPropia !== null ? medPropia : medPlanta;
  var ult = propios.length ? propios[propios.length - 1] : null;
  var diasDesde = ult ? hoy.dia - ult.dia : null;
  var hoyCant = propios.filter(function (r) { return r.dia === hoy.dia; }).reduce(function (s, r) { return s + r.cant; }, 0);
  if (!ult) {
    add('R1', 'ok', 'Sin retiros previos', 'No retiró este material en los últimos 12 meses.');
  } else if (item.tipo === 'EPP' && diasDesde === 0) {
    add('R1', 'alerta', 'Ya retiró hoy', 'Hoy ya retiró ' + pnlFmt_(hoyCant) + ' ' + item.unidad + ' de este EPP.');
  } else if (refFrec !== null && refFrec >= 2 && diasDesde < refFrec * C.FACTOR_REPETICION) {
    add('R1', 'alerta', 'Retiro antes de lo habitual',
      'Retiró hace ' + diasDesde + ' día(s); ' + (medPropia !== null ? 'su frecuencia habitual' : 'la frecuencia habitual de la planta') +
      ' es cada ' + pnlFmt_(refFrec) + ' días.');
  } else {
    add('R1', 'ok', 'Frecuencia normal', 'Último retiro hace ' + diasDesde + ' día(s)' + (refFrec !== null ? ' · habitual cada ' + pnlFmt_(refFrec) + ' días' : '') + '.');
  }

  // R2 — Pares que hacen la misma tarea (consumo cada 1000 min trabajados, 180 días)
  var mo = M.porOp[d.legajo] || null;
  var tareaRef = d.tarea || (mo ? pnlTareaPrincipal_(mo) : '');
  var t = pnlTasasCodigo_(d.codigo, d.legajo, tareaRef, M, U, d.cantidad);
  var estadPares = { tarea: tareaRef, desc: tareaRef ? pnlDescTarea_(tareaRef, '') : '', n: t.nPares, mediana: t.medPares, planta: t.medPlanta, mia: t.mia };
  if (!mo || mo.tot180 <= 0) {
    add('R2', 'aviso', 'Sin minutos en TIEMPOS', 'No tiene minutos cargados en TIEMPOS en los últimos ' + C.VENTANA_DIAS + ' días: no se puede comparar con sus pares.');
  } else if (!tareaRef || t.nPares < C.MIN_PARES) {
    add('R2', 'ok', 'Pocos pares para comparar', 'Hay ' + t.nPares + ' operario(s) con la tarea ' + (tareaRef || '—') + ' en la ventana.');
  } else if (t.ref > 0 && t.mia > t.ref * C.FACTOR_PARES && t.unidadesMias >= C.MIN_UNIDADES_ALERTA) {
    add('R2', 'alerta', 'Consume más que sus pares',
      pnlFmt_(t.mia) + ' ' + item.unidad + ' cada 1000 min vs. mediana ' + pnlFmt_(t.ref) + ' de ' + t.nPares + ' pares en la tarea ' + tareaRef + ' (×' + pnlFmt_(t.mia / t.ref) + ').');
  } else if (t.ref === 0 && t.unidadesMias >= C.MIN_UNIDADES_ALERTA) {
    add('R2', 'alerta', 'Sus pares casi no lo usan', 'Los ' + t.nPares + ' pares en la tarea ' + tareaRef + ' no retiraron este material en ' + C.VENTANA_DIAS + ' días.');
  } else {
    add('R2', 'ok', 'Dentro de lo de sus pares', pnlFmt_(t.mia) + ' cada 1000 min vs. mediana ' + pnlFmt_(t.ref) + ' (' + t.nPares + ' pares).');
  }

  // R3 — Su propio ritmo: últimos 30 días vs. los 150 anteriores (por minuto trabajado)
  var u30 = d.cantidad, uPrev = 0;
  propios.forEach(function (r) {
    if (r.dia >= hoy.dia - C.VENTANA_RECIENTE) u30 += r.cant;
    else if (r.dia >= hoy.dia - C.VENTANA_DIAS) uPrev += r.cant;
  });
  var estadPropio = { u30: pnlRedondear_(u30, 2), uPrev: pnlRedondear_(uPrev, 2), min30: mo ? Math.round(mo.tot30) : 0, minPrev: mo ? Math.round(mo.tot180 - mo.tot30) : 0 };
  if (mo && mo.tot30 > 0 && mo.tot180 - mo.tot30 > 0) {
    var r30 = u30 / mo.tot30 * 1000, rPrev = uPrev / (mo.tot180 - mo.tot30) * 1000;
    estadPropio.r30 = pnlRedondear_(r30, 3); estadPropio.rPrev = pnlRedondear_(rPrev, 3);
    if (rPrev > 0 && r30 > rPrev * C.FACTOR_PROPIO && u30 >= C.MIN_UNIDADES_ALERTA) {
      add('R3', 'alerta', 'Subió su propio consumo', 'Últimos 30 días: ' + pnlFmt_(r30) + ' cada 1000 min vs. ' + pnlFmt_(rPrev) + ' antes (×' + pnlFmt_(r30 / rPrev) + ').');
    } else if (rPrev === 0 && u30 >= C.MIN_UNIDADES_ALERTA * 2) {
      add('R3', 'alerta', 'Antes no lo usaba', 'Lleva ' + pnlFmt_(u30) + ' ' + item.unidad + ' en 30 días y no había retirado en los 150 anteriores.');
    } else {
      add('R3', 'ok', 'Ritmo propio normal', '30 días: ' + pnlFmt_(r30) + ' · antes: ' + pnlFmt_(rPrev) + ' cada 1000 min.');
    }
  } else if (mo && mo.tot30 === 0 && u30 > d.cantidad) {
    add('R3', 'aviso', 'Sin minutos en los últimos 30 días', 'Retira material pero no tiene tiempos cargados en los últimos 30 días.');
  } else {
    add('R3', 'ok', 'Sin base para comparar', 'No hay minutos suficientes en TIEMPOS para medir su ritmo.');
  }

  // R4 — Cantidad por retiro
  var tam = eg.map(function (r) { return r.cant; });
  if (tam.length >= C.MIN_RETIROS_CANTIDAD) {
    var medT = pnlMediana_(tam), p90 = pnlPercentil_(tam, 0.9);
    var lim = Math.max(p90, medT * 2);
    if (d.cantidad > lim) add('R4', 'alerta', 'Cantidad mayor a la habitual', 'Pide ' + pnlFmt_(d.cantidad) + '; lo habitual por retiro es ' + pnlFmt_(medT) + ' (90% de los retiros ≤ ' + pnlFmt_(p90) + ').');
    else add('R4', 'ok', 'Cantidad habitual', 'Habitual por retiro: ' + pnlFmt_(medT) + ' ' + item.unidad + '.');
  }

  // R5 — Stock. Pañol operativo: se repone por CONSUMO (mínimo = consumo de la semana del pase).
  //      Mayorista (entrega directa): se controla contra el stock CRÍTICO (por debajo hay que comprar).
  var saldo = item.stock - d.cantidad;
  var consumo = pnlConsumoOperativo_(eg, hoy.dia), reponer = false;
  if (d.cantidad > item.stock) {
    add('R5', 'alerta', 'Stock del sistema insuficiente', 'El sistema tiene ' + pnlFmt_(item.stock) + ' ' + item.unidad + (item.esMayorista ? ' en el mayorista' : '') + '. Si el material está físicamente, justificá y avisá a administración para ajustar.');
  } else if (item.esMayorista) {
    if (item.critico > 0 && saldo <= item.critico) add('R5', 'aviso', 'El mayorista queda en stock crítico', 'Después de la entrega quedan ' + pnlFmt_(saldo) + ' (crítico: ' + pnlFmt_(item.critico) + '): hay que comprar. Se avisa a administración.');
  } else if (consumo.minimo > 0 && saldo < consumo.minimo) {
    reponer = true;
    add('R5', 'aviso', 'Queda poco en el pañol', 'Después del retiro quedan ' + pnlFmt_(saldo) + ' ' + item.unidad + ': alcanza para ~' + Math.floor(Math.max(saldo, 0) / consumo.diario) +
      ' día(s) al ritmo de los últimos 90 días (mínimo: consumo de ' + consumo.semanas + ' semana/s = ' + pnlFmt_(consumo.minimo) + '). Se avisa a administración para reponer con un pase.');
  } else if (saldo <= 0) {
    reponer = true;
    add('R5', 'aviso', 'El pañol queda en 0', 'Después del retiro no queda stock en el pañol. Se avisa a administración.');
  }

  var anormal = reglas.some(function (r) { return r.nivel === 'alerta'; });
  return {
    item: pnlItemCliente_(item),
    cantidad: d.cantidad,
    saldo: pnlRedondear_(saldo, 3),
    previos: previos,
    hoyCant: pnlRedondear_(hoyCant, 2),
    reglas: reglas,
    anormal: anormal,
    consumo: consumo, reponer: reponer,
    estad: {
      diasDesde: diasDesde, frecPropia: medPropia, frecPlanta: medPlanta,
      pares: estadPares, propio: estadPropio
    },
    operario: idx.porLeg[d.legajo] ? idx.porLeg[d.legajo].disp : d.legajo
  };
}

/** Tasas (unidades cada 1000 min, 180 días) del operario, de la planta y de sus pares en la tarea. */
function pnlTasasCodigo_(cod, leg, tarea, M, U, extra) {
  var C = PANOL_CFG;
  var usos = U[cod] || {};
  var mo = M.porOp[leg];
  var unidadesMias = (usos[leg] || 0) + (extra || 0);
  var mia = mo && mo.tot180 > 0 ? unidadesMias / mo.tot180 * 1000 : null;
  var planta = [], pares = [];
  Object.keys(M.porOp).forEach(function (l) {
    if (l === leg) return;
    var m = M.porOp[l];
    if (m.tot180 < C.MIN_MIN_TOTAL_PAR) return;
    var tasa = (usos[l] || 0) / m.tot180 * 1000;
    planta.push(tasa);
    if (tarea && (m.tareas[tarea] || 0) >= C.MIN_MIN_TAREA_PAR) pares.push(tasa);
  });
  var medPares = pares.length ? pnlMediana_(pares) : null;
  var p75 = pares.length ? pnlPercentil_(pares, 0.75) : null;
  var ref = medPares === null ? 0 : (medPares > 0 ? medPares : (p75 || 0));
  return {
    mia: mia === null ? null : pnlRedondear_(mia, 3),
    unidadesMias: unidadesMias,
    medPlanta: planta.length ? pnlRedondear_(pnlMediana_(planta), 3) : null,
    medPares: medPares === null ? null : pnlRedondear_(medPares, 3),
    nPares: pares.length,
    ref: pnlRedondear_(ref, 3)
  };
}

function pnlTareaPrincipal_(mo) {
  var best = '', max = 0;
  Object.keys(mo.tareas || {}).forEach(function (t) { if (mo.tareas[t] > max) { max = mo.tareas[t]; best = t; } });
  return best;
}

function pnlIntervalos_(filas) {
  var dias = [];
  filas.forEach(function (r) { if (dias.indexOf(r.dia) < 0) dias.push(r.dia); });
  dias.sort(function (a, b) { return a - b; });
  var out = [];
  for (var i = 1; i < dias.length; i++) out.push(dias[i] - dias[i - 1]);
  return out;
}

/* ------------------------------------------------------------------ */
/*  Lectura de datos                                                   */
/* ------------------------------------------------------------------ */

/** Egresos de un código en los últimos 365 días (todas las personas). Caché 10 min. */
function pnlEgresosCodigo_(cod) {
  var cache = CacheService.getScriptCache();
  var clave = 'pnl_eg3_' + pnlGenCache_() + '_' + cod;
  var c = pnlLeerCache_(cache, clave);
  if (c) return c;
  // Lectura directa de la hoja (no gviz): gviz deja afuera las celdas cuyo tipo no coincide con el de la mayoría
  // de la columna (códigos guardados como texto, fechas en texto), y eso escondía retiros del historial.
  var B = pnlMovsRecientes_(PANOL_CFG.HIST_DIAS), C = B.cols, hoy = pnlHoy_();
  var idx = pnlIndiceOperarios_(), memo = {}, out = [];
  B.filas.forEach(function (r) {
    if (pnlCodigo_(r[C.CODIGO]) !== String(cod)) return;
    var m = pnlMovConsumo_(r, C, hoy);
    if (!m) return;
    var orig = C.OPCORR !== null && r[C.OPCORR] ? String(r[C.OPCORR]) : String(r[C.OPERADOR] || '');
    var leg = memo.hasOwnProperty(orig) ? memo[orig] : (memo[orig] = pnlLegajoDe_(orig, pnlTextoDia_(m.dia), idx));
    out.push({ id: r[C.ID], dia: m.dia, y: m.y, m: m.m, hora: C.HORA !== null ? pnlHoraCelda_(r[C.HORA]) : '',
      cant: m.cant, leg: leg, original: orig,
      ot: C.OT !== null ? String(r[C.OT] === null || r[C.OT] === undefined ? '' : r[C.OT]) : '',
      tarea: C.TAREA !== null ? String(r[C.TAREA] === null || r[C.TAREA] === undefined ? '' : r[C.TAREA]) : '',
      motivo: C.MOTIVO !== null ? String(r[C.MOTIVO] || '') : '', tipo: m.tipo });
  });
  out.sort(function (a, b) { return a.dia - b.dia || (Number(a.id) || 0) - (Number(b.id) || 0); });
  pnlEscribirCache_(cache, clave, out, 21600);   // 6 h: se borra al registrar un movimiento del código o con "Actualizar datos"
  return out;
}

/** Tipos de movimiento que NO son consumo (no cuentan en historiales, tasas ni reglas). */
var PNL_TIPOS_NO_CONSUMO = ['INVENTARIO', 'AJUSTE', 'PASE A OPERATIVO', 'PASE RECIBIDO', 'DEVOLUCION PASE', 'INGRESO', 'COMPRA', 'CORRECCION TUBO',
  'INGRESO MANTENIMIENTO', 'AJUSTE MANTENIMIENTO', 'MANTENIMIENTO', 'DEVOLUCION'];

/** Un renglón de consumos es un retiro (consumo) del pañol? Devuelve { dia, y, m, cant, tipo } o null. */
function pnlMovConsumo_(r, C, hoy) {
  var cant = pnlNumero_(r[C.CANTIDAD]);
  if (!(cant < 0)) return null;
  var tipo = C.TIPO !== null ? String(r[C.TIPO] || '').trim().toUpperCase() : '';
  if (tipo && PNL_TIPOS_NO_CONSUMO.indexOf(tipo) >= 0) return null;
  var dep = C.DEPOSITO !== null ? String(r[C.DEPOSITO] || '').trim().toUpperCase() : '';
  if ((dep === 'MAYORISTA' || dep === 'MANTENIMIENTO') && tipo !== PANOL_CFG.TIPO_DIRECTA) return null;
  var f = pnlFechaCelda_(r[C.FECHA]);
  if (!f || f.dia > hoy.dia) return null;
  return { dia: f.dia, y: f.y, m: f.m, cant: Math.abs(cant), tipo: tipo };
}

/**
 * Renglones de consumos de los últimos N días, leídos de la hoja (las filas están en orden de ID / fecha).
 * Se busca desde el final la primera fila anterior al corte (con margen) y se lee de ahí al final.
 */
var PNL_BLOQUE_MEMO_ = {};
function pnlMovsRecientes_(dias) {
  if (PNL_BLOQUE_MEMO_[dias]) return PNL_BLOQUE_MEMO_[dias];
  var h = pnlHojaConsumos_(), n = h.getLastRow(), nc = h.getLastColumn();
  var C = pnlMapearIndices_(h.getRange(1, 1, 1, nc).getValues()[0], PNL_COLS_CONSUMOS);
  if (C.CODIGO === null || C.CANTIDAD === null || C.FECHA === null) throw new Error('consumos: faltan las columnas CODIGO INSUMO / CANTIDAD / FECHA.');
  var corte = pnlHoy_().dia - dias - 2, desde = 2, cache = CacheService.getScriptCache(), kc = 'pnl_desde_' + dias + '_' + pnlHoy_().iso;
  var cd = Number(cache.get(kc));
  if (cd >= 2 && cd <= n) desde = cd;
  else if (n >= 2) {
    var fechas = h.getRange(2, C.FECHA + 1, n - 1, 1).getValues(), viejas = 0;
    for (var i = fechas.length - 1; i >= 0; i--) {
      var f = pnlFechaCelda_(fechas[i][0]);
      if (f && f.dia < corte) { if (++viejas >= 50) { desde = i + 2 + 50; break; } } else viejas = 0;   // 50 seguidas anteriores = ya pasamos el corte
    }
    try { cache.put(kc, String(desde), 21600); } catch (e) {}
  }
  var filas = n >= desde ? h.getRange(desde, 1, n - desde + 1, nc).getValues() : [];
  return (PNL_BLOQUE_MEMO_[dias] = { filas: filas, cols: C, desde: desde });
}

/** Fecha de una celda (Date, o texto "6-ene-26", "06/01/2026", "2026-01-06") → { dia, y, m } en la zona del sistema. */
function pnlFechaCelda_(v) {
  if (v === null || v === undefined || v === '') return null;
  var y, m, d;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    var p = Utilities.formatDate(v, PANOL_CFG.TZ, 'yyyy-MM-dd').split('-').map(Number); y = p[0]; m = p[1]; d = p[2];
  } else {
    var s = pnlNorm_(v).toLowerCase(), x;
    var MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
    if ((x = s.match(/^(\d{1,2})[-\s/.]([a-z]{3})[a-z]*\.?[-\s/.](\d{2,4})/))) { d = +x[1]; m = MES[x[2]]; y = +x[3]; }
    else if ((x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { d = +x[1]; m = +x[2]; y = +x[3]; }
    else if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else return null;
    if (!m) return null;
    if (y < 100) y += 2000;
  }
  return { y: y, m: m, dia: Math.floor(Date.UTC(y, m - 1, d) / 864e5) };
}

/** Hora de una celda de la hoja (Date con fecha 1899 o texto) → "HH:mm". */
function pnlHoraCelda_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, PANOL_CFG.TZ, 'HH:mm');
  var x = String(v).match(/(\d{1,2}):(\d{2})/);
  if (!x) return String(v);
  var hh = +x[1]; if (/p\.?\s*m/i.test(String(v)) && hh < 12) hh += 12; if (/a\.?\s*m/i.test(String(v)) && hh === 12) hh = 0;
  return pnlPad2_(hh) + ':' + x[2];
}

/** Unidades egresadas por código y por legajo en 180 días. Caché 30 min. */
function pnlUso180_() {
  var cache = CacheService.getScriptCache();
  var c = pnlLeerCache_(cache, 'pnl_uso180_v2');
  if (c) return c;
  var B = pnlMovsRecientes_(PANOL_CFG.HIST_DIAS), C = B.cols, hoy = pnlHoy_(), desde = hoy.dia - PANOL_CFG.VENTANA_DIAS;
  var idx = pnlIndiceOperarios_(), memo = {}, out = {};
  B.filas.forEach(function (r) {
    var cod = pnlCodigo_(r[C.CODIGO]);
    if (!cod) return;
    var m = pnlMovConsumo_(r, C, hoy);
    if (!m || m.dia < desde) return;
    var orig = C.OPCORR !== null && r[C.OPCORR] ? String(r[C.OPCORR]) : String(r[C.OPERADOR] || '');
    var leg = memo.hasOwnProperty(orig) ? memo[orig] : (memo[orig] = pnlLegajoDe_(orig, '', idx));
    if (!leg) return;
    var o = out[cod] || (out[cod] = {});
    o[leg] = pnlRedondear_((o[leg] || 0) + m.cant, 3);
  });
  pnlEscribirCache_(cache, 'pnl_uso180_v2', out, 10800);   // 3 h (estadística de 180 días; se renueva con "Actualizar datos")
  return out;
}

/** Minutos trabajados por legajo y por tarea (TIEMPOS). Caché 30 min. */
function pnlMinutos_() {
  var cache = CacheService.getScriptCache();
  var c = pnlLeerCache_(cache, 'pnl_min_v2');
  if (c) return c;
  var out = null, errGviz = '';
  try { out = pnlMinutosGviz_(); } catch (e) { errGviz = String(e && e.message || e); }
  // Si la consulta rápida falla o vuelve vacía, se lee TIEMPOS directo (nunca se guarda un resultado vacío en caché).
  if (!out || !Object.keys(out.porOp).length) {
    try { out = pnlMinutosDirecto_(); out.fuente = 'directo'; if (errGviz) out.aviso = errGviz; }
    catch (e2) { return { porOp: {}, generado: pnlHoy_().iso, fuente: 'error', error: 'No pude leer TIEMPOS: ' + (errGviz || '') + ' / ' + (e2 && e2.message || e2) }; }
  }
  if (Object.keys(out.porOp).length) pnlEscribirCache_(cache, 'pnl_min_v2', out, 10800);   // 3 h
  return out;
}

function pnlMinOp_(porOp, leg) { return porOp[leg] || (porOp[leg] = { tot180: 0, tot30: 0, tareas: {}, ult: null }); }

/** Minutos por operario y tarea vía gviz (solo etapas cerradas: PARCIAL > 0). */
function pnlMinutosGviz_() {
  var L = pnlColumnasGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.TIEMPOS_GID, PNL_COLS_TIEMPOS, 'tiempos');
  // si se borró el encabezado CODIGO DE TAREAS (B1), la tarea es la columna que sigue a MODELO
  if (!L.TAREA && L.MODELO) L.TAREA = pnlLetraSiguiente_(L.MODELO);
  ['OPERARIO', 'TAREA', 'FECHA', 'PARCIAL'].forEach(function (k) { if (!L[k]) throw new Error('TIEMPOS: falta la columna ' + PNL_COLS_TIEMPOS[k]); });
  var hoy = pnlHoy_();
  var hasta = ' and ' + L.FECHA + ' <= date "' + hoy.iso + '" and ' + L.PARCIAL + ' > 0';
  var q1 = 'select ' + L.OPERARIO + ', ' + L.TAREA + ', sum(' + L.PARCIAL + ') where ' + L.FECHA + ' >= date "' + pnlIsoMenos_(PANOL_CFG.VENTANA_DIAS) + '"' +
    hasta + ' group by ' + L.OPERARIO + ', ' + L.TAREA;
  var q2 = 'select ' + L.OPERARIO + ', sum(' + L.PARCIAL + ') where ' + L.FECHA + ' >= date "' + pnlIsoMenos_(PANOL_CFG.VENTANA_RECIENTE) + '"' +
    hasta + ' group by ' + L.OPERARIO;
  var q3 = 'select ' + L.OPERARIO + ', max(' + L.FECHA + ') where ' + L.FECHA + ' <= date "' + hoy.iso + '" group by ' + L.OPERARIO;
  var t1 = pnlGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.TIEMPOS_GID, q1);
  var t2 = pnlGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.TIEMPOS_GID, q2);
  var t3 = null;
  try { t3 = pnlGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.TIEMPOS_GID, q3); } catch (e) { t3 = null; }
  var idx = pnlIndiceOperarios_();
  var memo = {};
  var legDe = function (x) { var s = String(x || ''); return memo.hasOwnProperty(s) ? memo[s] : (memo[s] = pnlLegajoDe_(s, '', idx)); };
  var porOp = {};
  t1.rows.forEach(function (r) {
    var leg = legDe(r[0]); if (!leg) return;
    var tarea = pnlCodigo_(r[1]); var min = pnlNumero_(r[2]) || 0;
    if (min <= 0) return;
    var o = pnlMinOp_(porOp, leg);
    o.tot180 += min;
    if (tarea) o.tareas[tarea] = (o.tareas[tarea] || 0) + min;
  });
  t2.rows.forEach(function (r) {
    var leg = legDe(r[0]); if (!leg) return;
    var min = pnlNumero_(r[1]) || 0;
    if (min > 0) pnlMinOp_(porOp, leg).tot30 += min;
  });
  if (t3) t3.rows.forEach(function (r) {
    var leg = legDe(r[0]); if (!leg || !r[1] || r[1].dia === undefined) return;
    var o = pnlMinOp_(porOp, leg);
    if (o.ult === null || r[1].dia > o.ult) o.ult = r[1].dia;
  });
  return { porOp: porOp, generado: hoy.iso, ts: Date.now(), fuente: 'gviz', filas: t1.rows.length, nombres: pnlNombresTiempos_(memo) };
}

/** Lectura directa de la hoja TIEMPOS (respaldo si gviz falla o vuelve vacío). */
function pnlMinutosDirecto_() {
  var ss = SpreadsheetApp.openById(PANOL_CFG.TIEMPOS_ID);
  var sh = null;
  ss.getSheets().forEach(function (h) { if (h.getSheetId() === PANOL_CFG.TIEMPOS_GID) sh = h; });
  if (!sh) sh = ss.getSheetByName('TIEMPOS');
  if (!sh) throw new Error('no encuentro la hoja TIEMPOS');
  var n = sh.getLastRow(), nc = sh.getLastColumn();
  if (n < 2) throw new Error('TIEMPOS está vacía');
  var enc = sh.getRange(1, 1, 1, nc).getValues()[0].map(pnlNorm_);
  var col = {};
  Object.keys(PNL_COLS_TIEMPOS).forEach(function (k) { col[k] = enc.indexOf(pnlNorm_(PNL_COLS_TIEMPOS[k])); });
  if (col.TAREA < 0 && col.MODELO >= 0 && !enc[col.MODELO + 1]) col.TAREA = col.MODELO + 1;   // encabezado B1 borrado
  ['OPERARIO', 'TAREA', 'FECHA', 'PARCIAL'].forEach(function (k) { if (col[k] < 0) throw new Error('TIEMPOS: falta la columna ' + PNL_COLS_TIEMPOS[k]); });
  var v = sh.getRange(2, 1, n - 1, nc).getValues();
  var hoy = pnlHoy_(), d180 = hoy.dia - PANOL_CFG.VENTANA_DIAS, d30 = hoy.dia - PANOL_CFG.VENTANA_RECIENTE;
  var idx = pnlIndiceOperarios_();
  var memo = {};
  var porOp = {};
  v.forEach(function (r) {
    var s = String(r[col.OPERARIO] || '').trim(); if (!s || s === 'x') return;
    var f = r[col.FECHA]; if (!(f instanceof Date) || isNaN(f.getTime())) return;
    var p = Utilities.formatDate(f, PANOL_CFG.TZ, 'yyyy-MM-dd').split('-').map(Number);
    var dia = Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
    if (dia > hoy.dia) return;
    var leg = memo.hasOwnProperty(s) ? memo[s] : (memo[s] = pnlLegajoDe_(s, '', idx));
    if (!leg) return;
    var o = pnlMinOp_(porOp, leg);
    if (o.ult === null || dia > o.ult) o.ult = dia;
    var min = pnlNumero_(r[col.PARCIAL]) || 0;
    if (min <= 0 || dia < d180) return;
    o.tot180 += min;
    if (dia >= d30) o.tot30 += min;
    var tarea = pnlCodigo_(r[col.TAREA]);
    if (tarea) o.tareas[tarea] = (o.tareas[tarea] || 0) + min;
  });
  return { porOp: porOp, generado: hoy.iso, ts: Date.now(), filas: v.length, nombres: pnlNombresTiempos_(memo) };
}

/** Textos de operario tal como figuran en TIEMPOS → legajo resuelto ('' si no se reconoce). Máx. 1500. */
function pnlNombresTiempos_(memo) {
  var out = {};
  Object.keys(memo).slice(0, 1500).forEach(function (k) { out[k] = memo[k] || ''; });
  return out;
}

/**
 * Cuando un operario no tiene minutos o retiros: pistas para entender por qué.
 * - último retiro en consumos (sin límite de fecha), por si es anterior al período elegido;
 * - textos de TIEMPOS y nombres de consumos con su apellido y nombre que no quedaron asociados a su legajo.
 */
function pnlPistasOperario_(op, leg, M, sinMovs, sinMin) {
  var out = { textos: [], ultimoRetiro: null };
  var ape = pnlNorm_(op.ape), nom1 = pnlNorm_(String(op.nom || '').split(/\s+/)[0] || '');
  var coincide = function (txt) { var n = pnlNorm_(txt); return n.indexOf(ape) >= 0 && (!nom1 || n.indexOf(nom1) >= 0); };
  if (!op.activo) out.textos.push('Figura de BAJA en RRHH.');
  if (sinMin && M.nombres) {
    Object.keys(M.nombres).forEach(function (t) {
      if (M.nombres[t] === leg || !coincide(t)) return;
      out.textos.push('En TIEMPOS hay registros como "' + t + '"' + (M.nombres[t] ? ' (se toman para el legajo ' + M.nombres[t] + ')' : ' (no se reconoce el legajo)') + '.');
    });
  }
  if (sinMovs) {
    try {
      var L = pnlColsConsumosGviz_();
      var conds = [];
      if (L.OPCORR) conds.push(L.OPCORR + " starts with '" + leg + " - '");
      pnlNombresOriginales_(leg, pnlIndiceOperarios_()).forEach(function (n) { conds.push(L.OPERADOR + ' = ' + pnlLiteral_(n)); });
      if (conds.length && L.FECHA) {
        var t = pnlGviz_(PANOL_CFG.CONSUMOS_ID, PANOL_CFG.CONSUMOS_GID, 'select ' + L.ID + ', ' + L.FECHA + ' where (' + conds.join(' or ') + ') order by ' + L.ID + ' desc limit 1');
        if (t.rows.length) out.ultimoRetiro = { id: t.rows[0][0], fecha: pnlTexto_(t.rows[0][1], 'FECHA') };
      }
      if (!out.ultimoRetiro && L.OPERADOR && op.ape) {
        var q = 'select ' + L.OPERADOR + ', count(' + L.ID + ') where upper(' + L.OPERADOR + ') contains ' + pnlLiteral_(String(op.ape).toUpperCase()) + ' group by ' + L.OPERADOR;
        pnlGviz_(PANOL_CFG.CONSUMOS_ID, PANOL_CFG.CONSUMOS_GID, q).rows.forEach(function (r) {
          if (r[0] && coincide(r[0])) out.textos.push('En consumos hay ' + (pnlNumero_(r[1]) || 0) + ' movimientos a nombre de "' + r[0] + '" que no quedaron asociados al legajo ' + leg + '.');
        });
      }
    } catch (e) { out.textos.push('No pude revisar consumos: ' + (e && e.message || e)); }
  }
  out.textos = out.textos.slice(0, 8);
  return out;
}

/**
 * Ejecutar desde el editor: por qué un código no aparece en el Historial insumo.
 * Cuenta en consumos las filas con ese código como número y como TEXTO (gviz no ve el texto en una columna
 * numérica), cuántas trae la consulta del modal y cuántas quedan afuera por ser del mayorista o ingresos.
 */
function panolDiagnosticoCodigo(codigo) {
  var cod = String(codigo || '3112').trim();
  var hoja = pnlHojaConsumos_(), cols = pnlColsConsumos_(), n = hoja.getLastRow() - 1;
  var v = hoja.getRange(2, cols.CODIGO + 1, n, 1).getValues();
  var num = 0, txt = 0, filasTxt = [];
  v.forEach(function (r, i) { var x = r[0]; if (typeof x === 'number' && String(x) === cod) num++; else if (typeof x === 'string' && x.trim() === cod) { txt++; if (filasTxt.length < 10) filasTxt.push(i + 2); } });
  panolLimpiarCache();
  var eg = pnlEgresosCodigo_(cod);
  var L = pnlColsConsumosGviz_();
  var todos = pnlGviz_(PANOL_CFG.CONSUMOS_ID, PANOL_CFG.CONSUMOS_GID, 'select count(' + L.ID + ') where ' + L.CODIGO + ' = ' + Number(cod));
  var lin = ['Código ' + cod + ' en consumos: ' + num + ' filas como número, ' + txt + ' como TEXTO' + (txt ? ' (filas ' + filasTxt.join(', ') + (txt > 10 ? '…' : '') + ': gviz no las ve; volvé a escribir el número o usá Formato › Número)' : ''),
    'Consulta gviz (todas las filas del código): ' + (todos.rows.length ? todos.rows[0][0] : 0),
    'Retiros del pañol que usa el modal (365 días, sin mayorista): ' + eg.length + (eg.length ? ' · último ' + pnlTextoDia_(eg[eg.length - 1].dia) : ''),
    'Historial insumo: ' + pnlRedondear_(eg.filter(function (x) { return x.dia >= pnlHoy_().dia - 90; }).reduce(function (a, x) { return a + x.cant; }, 0), 2) + ' egresados en 90 días'];
  try {
    var cat = depCatalogo_().filter(function (r) { return r[0] === cod; })[0];
    if (cat) lin.push('Plan de compras / Stock crítico: consumo 30 d ' + cat[7] + ' · 90 d ' + cat[8] + ' · 12 meses ' + cat[15] + ' (tiene que coincidir con el historial)');
  } catch (e) { lin.push('Plan de compras: ' + e.message); }
  Logger.log(lin.join('\n'));
  try { SpreadsheetApp.getActive().toast(lin.join(' · '), 'Pañol', 20); } catch (e) {}
  return lin.join('\n');
}

/** Ejecutar desde el editor: muestra qué devuelve TIEMPOS por las dos vías para un legajo. */
function panolDiagnosticoMinutos(legajo) {
  var leg = String(legajo || '373');
  pnlBorrarCache_(CacheService.getScriptCache(), 'pnl_min_v2');
  CacheService.getScriptCache().remove('pnl_cols_tiempos');
  var lin = [];
  try { var g = pnlMinutosGviz_(); var o = g.porOp[leg] || {};
    lin.push('gviz: ' + g.filas + ' filas, ' + Object.keys(g.porOp).length + ' operarios · legajo ' + leg + ': 30 d ' + Math.round(o.tot30 || 0) + ' min, 180 d ' + Math.round(o.tot180 || 0) + ' min, último ' + pnlTextoDia_(o.ult));
  } catch (e) { lin.push('gviz ERROR: ' + e.message); }
  try { var d = pnlMinutosDirecto_(); var o2 = d.porOp[leg] || {};
    lin.push('directo: ' + d.filas + ' filas, ' + Object.keys(d.porOp).length + ' operarios · legajo ' + leg + ': 30 d ' + Math.round(o2.tot30 || 0) + ' min, 180 d ' + Math.round(o2.tot180 || 0) + ' min, último ' + pnlTextoDia_(o2.ult));
  } catch (e) { lin.push('directo ERROR: ' + e.message); }
  Logger.log(lin.join('\n'));
  return lin.join('\n');
}

/** Tareas abiertas del operario en EN_CURSO (ACTIVA primero). */
function pnlEnCursoDe_(leg) {
  var L = pnlColumnasGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.EN_CURSO_GID, PNL_COLS_ENCURSO, 'encurso');
  if (!L.OPERARIO) return [];
  var keys = ['OPERARIO', 'OT', 'TAREA', 'MODELO', 'CANTIDAD', 'ESTADO', 'ULTIMA', 'MINEST', 'FINEST'].filter(function (k) { return L[k]; });
  var q = 'select ' + keys.map(function (k) { return L[k]; }).join(', ') + ' where ' + L.OPERARIO + " starts with '" + leg + " - '";
  var t = pnlGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.EN_CURSO_GID, q);
  var out = t.rows.map(function (r) {
    var o = {};
    keys.forEach(function (k, i) { o[k] = r[i]; });
    var tarea = pnlCodigo_(o.TAREA), modelo = pnlCodigo_(o.MODELO);
    return {
      ot: o.OT === null || o.OT === undefined ? '' : pnlCodigo_(o.OT) || String(o.OT),
      tarea: tarea, desc: pnlDescTarea_(tarea, modelo), modelo: modelo,
      cantidad: o.CANTIDAD === null || o.CANTIDAD === undefined ? '' : pnlNumero_(o.CANTIDAD),
      estado: String(o.ESTADO || ''), ultima: pnlTexto_(o.ULTIMA, 'FECHA'),
      minEst: o.MINEST === null || o.MINEST === undefined ? '' : pnlNumero_(o.MINEST),
      finEst: pnlTexto_(o.FINEST, 'FECHAHORA'), fuente: 'EN CURSO'
    };
  });
  out.sort(function (a, b) { return (a.estado === 'ACTIVA' ? 0 : 1) - (b.estado === 'ACTIVA' ? 0 : 1); });
  return out;
}

/** Si no hay nada en curso: última tarea registrada en TIEMPOS (7 días). */
function pnlUltimaTareaTiempos_(leg) {
  var L = pnlColumnasGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.TIEMPOS_GID, PNL_COLS_TIEMPOS, 'tiempos');
  if (!L.OPERARIO || !L.FECHA || !L.TAREA || !L.MODELO || !L.OT) return null;
  var hoy = pnlHoy_();
  var q = 'select ' + [L.MODELO, L.TAREA, L.OT, L.FECHA].join(', ') + ' where ' + L.OPERARIO + " starts with '" + leg + " - ' and " +
    L.FECHA + ' >= date "' + pnlIsoMenos_(7) + '" and ' + L.FECHA + ' <= date "' + hoy.iso + '" order by ' + L.FECHA + ' desc limit 1';
  var t = pnlGviz_(PANOL_CFG.TIEMPOS_ID, PANOL_CFG.TIEMPOS_GID, q);
  if (!t.rows.length) return null;
  var r = t.rows[0];
  var modelo = pnlCodigo_(r[0]), tarea = pnlCodigo_(r[1]);
  return { modelo: modelo, tarea: tarea, desc: pnlDescTarea_(tarea, modelo), ot: pnlCodigo_(r[2]) || String(r[2] || ''), fecha: pnlTexto_(r[3], 'FECHA'), fuente: 'TIEMPOS' };
}

/** Movimientos de un operario (todos los códigos) en los últimos N días. */
function pnlMovimientosOperario_(leg, dias, limite) {
  // Lectura directa (como el Historial insumo): gviz perdía renglones con código o fecha guardados como texto.
  var idx = pnlIndiceOperarios_();
  var nombres = {}; pnlNombresOriginales_(leg, idx).forEach(function (n) { nombres[pnlNorm_(n)] = 1; });
  var B = pnlMovsRecientes_(Math.max(Number(dias) || 0, PANOL_CFG.HIST_DIAS)), C = B.cols, hoy = pnlHoy_(), desde = hoy.dia - (Number(dias) || 0);
  var pre = String(leg) + ' - ', out = [];
  var g = function (r, k) { return C[k] === null || C[k] === undefined ? '' : r[C[k]]; };
  for (var i = B.filas.length - 1; i >= 0; i--) {
    var r = B.filas[i];
    var oc = String(g(r, 'OPCORR') || '');
    if (!(oc.indexOf(pre) === 0 || (!oc && nombres[pnlNorm_(g(r, 'OPERADOR'))]))) continue;
    var f = pnlFechaCelda_(g(r, 'FECHA'));
    if (!f || f.dia < desde || f.dia > hoy.dia) continue;
    var fv = g(r, 'FECHA');
    out.push({
      id: g(r, 'ID'), fecha: Object.prototype.toString.call(fv) === '[object Date]' ? pnlTexto_(fv, 'FECHA') : pnlTextoDia_(f.dia), hora: pnlHoraCelda_(g(r, 'HORA')),
      codigo: pnlCodigo_(g(r, 'CODIGO')), desc: String(g(r, 'DESCRIPCION') || ''), cantidad: pnlNumero_(g(r, 'CANTIDAD')) || 0, saldo: pnlNumero_(g(r, 'SALDO')),
      ot: String(g(r, 'OT') === null ? '' : g(r, 'OT')), tarea: String(g(r, 'TAREA') === null ? '' : g(r, 'TAREA')),
      tipo: String(g(r, 'TIPO') || ''), motivo: String(g(r, 'MOTIVO') || ''), obs: String(g(r, 'OBS') || ''), consola: String(g(r, 'CONSOLA') || '')
    });
  }
  out.sort(function (a, b) { return (Number(b.id) || 0) - (Number(a.id) || 0); });
  return out.slice(0, limite || 300);
}

/** Nombres con los que la consola vieja escribió a este legajo en la columna OPERADOR. */
function pnlNombresOriginales_(leg, idx) {
  var out = [];
  var op = idx.porLeg[leg];
  if (op) out.push(op.corto);
  if (typeof MAPEO_OPERARIOS !== 'undefined') {
    Object.keys(MAPEO_OPERARIOS).forEach(function (k) {
      var m = String(MAPEO_OPERARIOS[k]).match(/^(\d+)\s*-/);
      if (m && m[1] === leg && out.indexOf(k) < 0) out.push(k);
    });
  }
  return out.slice(0, 25);
}

/** Catálogo de pañol (EPP + Consumibles) para el combo. Caché 3 min. */
function pnlCatalogo_() {
  var cache = CacheService.getScriptCache();
  var c = pnlLeerCache_(cache, 'pnl_cat_v2');
  if (c) return c;
  var ss = SpreadsheetApp.openById(PANOL_CFG.INSUMOS_ID);
  var hoja = pnlHojaPorGid_(ss, PANOL_CFG.INSUMOS_GID);
  if (!hoja) throw new Error('No encuentro la hoja InsumosCod.');
  var datos = hoja.getDataRange().getValues();
  var I = pnlMapearIndices_(datos[0], PNL_COLS_INSUMOS);
  if (I.CODIGO === null || I.STOCK === null) throw new Error('InsumosCod: faltan las columnas Codigo de insumo / Stock.');
  var fam = pnlFamiliasPropuesto_(ss);
  var out = [];
  for (var i = 1; i < datos.length; i++) {
    var r = datos[i];
    var cod = pnlCodigo_(r[I.CODIGO]);
    if (!cod || cod.length > 4) continue;
    var f = fam[cod] || pnlFamiliaRegla_(cod);
    if (I.FAMILIA !== null && r[I.FAMILIA]) f = { familia: String(r[I.FAMILIA]), tipo: I.TIPO !== null ? String(r[I.TIPO]) : f.tipo };
    if (I.DEPOSITO !== null) {
      // Regla de Walter: lo que tiene 1 en la columna K (Deposito) es lo que se ve en el pañol
      if (pnlNumero_(r[I.DEPOSITO]) !== PNL_DEPOSITO_VISIBLE) continue;
    } else if (f.tipo !== 'EPP' && f.tipo !== 'Consumible') continue;
    out.push([
      cod, pnlDescConMedida_(r[I.DESCRIPCION], I.MEDIDA !== null ? r[I.MEDIDA] : ''), I.UNIDAD !== null ? String(r[I.UNIDAD] || '').trim() : '',
      pnlNumero_(r[I.STOCK]) || 0, I.CRITICO !== null ? (pnlNumero_(r[I.CRITICO]) || 0) : 0,
      f.familia, f.tipo, I.PRECIO !== null ? (pnlNumero_(r[I.PRECIO]) || 0) : 0,
      I.PROVEEDOR !== null ? String(r[I.PROVEEDOR] || '').trim() : ''
    ]);
  }
  out.sort(function (a, b) { return Number(a[0]) - Number(b[0]); });
  pnlEscribirCache_(cache, 'pnl_cat_v2', out, 180);
  return out;
}

/** Familias del catálogo visible, en el orden de la consola vieja. */
function pnlFamiliasPresentes_(cat) {
  var hay = {};
  cat.forEach(function (r) { if (r[5]) hay[r[5]] = true; });
  var out = PNL_ORDEN_FAMILIAS.filter(function (f) { return hay[f]; });
  Object.keys(hay).sort().forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); });
  return out;
}

/** Familia y tipo por código (no dependen del stock): caché de 6 h, aparte del catálogo que se borra en cada movimiento. */
function pnlFamTipo_() {
  var cache = CacheService.getScriptCache();
  var c = pnlLeerCache_(cache, 'pnl_famtipo_v1');
  if (c) return c;
  var m = {};
  pnlCatalogo_().forEach(function (r) { m[r[0]] = [r[5], r[6]]; });
  pnlEscribirCache_(cache, 'pnl_famtipo_v1', m, 21600);
  return m;
}
function pnlCatalogoMapa_() {
  var m = {};
  pnlCatalogo_().forEach(function (r) { m[r[0]] = { desc: r[1], unidad: r[2], familia: r[5], tipo: r[6] }; });
  return m;
}

function pnlFamiliasPropuesto_(ss) {
  var out = {};
  try {
    var h = pnlHojaPorGid_(ss, PANOL_CFG.INSUMOS_PROP_GID);
    if (!h) return out;
    var enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    var I = pnlMapearIndices_(enc, { CODIGO: 'CODIGO DE INSUMO', FAMILIA: 'FAMILIA', TIPO: 'TIPO' });
    if (I.CODIGO === null || I.FAMILIA === null || I.TIPO === null) return out;
    var n = h.getLastRow() - 1;
    var cods = h.getRange(2, I.CODIGO + 1, n, 1).getValues();
    var fam = h.getRange(2, I.FAMILIA + 1, n, 1).getValues();
    var tip = h.getRange(2, I.TIPO + 1, n, 1).getValues();
    for (var i = 0; i < n; i++) {
      var c = pnlCodigo_(cods[i][0]);
      if (c && c.length <= 4 && fam[i][0]) out[c] = { familia: String(fam[i][0]), tipo: String(tip[i][0]) };
    }
  } catch (e) {}
  return out;
}

/** Misma regla que Panol_Preparacion (por si la hoja propuesta no tiene la familia). */
function pnlFamiliaRegla_(codigo) {
  var c = Number(codigo);
  var F = function (familia, tipo) { return { familia: familia, tipo: tipo }; };
  if (!isFinite(c) || c === 0) return F('', '');
  if (String(Math.round(c)).length > 4) return F('Producción', 'Producción');
  if (c >= 3000 && c <= 3014) return F('Insumos Embalaje', 'Consumible');
  if (c >= 3050 && c <= 3099) return F('Soldadura y Plasma', 'Consumible');
  if (c >= 3110 && c <= 3148) return F('Discos y Corte', 'Consumible');
  if (c >= 3155 && c <= 3159) return F('Protección Personal', 'EPP');
  if (c >= 3149 && c <= 3189) return F('Soldadura y Plasma', 'Consumible');
  if (c === 3190) return F('Elementos Varios', 'Consumible');
  if (c >= 3200 && c <= 3299) return F('Protección Personal', 'EPP');
  if (c >= 3300 && c <= 3399) return F('Insumos Pintura', 'Consumible');
  if (c >= 3400 && c <= 3499) return F('Elementos Varios', 'Consumible');
  if (c >= 3500 && c <= 3699) return F('Mechas Varias', 'Consumible');
  if (c >= 3800 && c <= 3899) return F('Insumos Embalaje', 'Consumible');
  if (c >= 3996 && c <= 4001) return F('Insumos Zincado', 'Consumible');
  return F('Materia prima / Producción', 'Producción');
}

/** Lee el ítem directo de InsumosCod (stock en vivo, sin caché). */
function pnlItemVivo_(cod, conFila) {
  var ss = SpreadsheetApp.openById(PANOL_CFG.INSUMOS_ID);
  var hoja = pnlHojaPorGid_(ss, PANOL_CFG.INSUMOS_GID);
  var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var I = pnlMapearIndices_(enc, PNL_COLS_INSUMOS);
  var f = hoja.getRange(2, I.CODIGO + 1, hoja.getLastRow() - 1, 1).createTextFinder(String(cod)).matchEntireCell(true).findNext();
  if (!f) throw new Error('El código ' + cod + ' no está en InsumosCod.');
  var fila = f.getRow();
  var r = hoja.getRange(fila, 1, 1, enc.length).getValues()[0];
  var fam = pnlFamiliaRegla_(cod);
  try { var fp = pnlFamTipo_()[cod]; if (fp) fam = { familia: fp[0], tipo: fp[1] }; } catch (e) {}
  var item = {
    codigo: cod, desc: pnlDescConMedida_(r[I.DESCRIPCION], I.MEDIDA !== null ? r[I.MEDIDA] : ''),
    descBase: String(r[I.DESCRIPCION] || '').trim(), medida: I.MEDIDA !== null ? pnlMedidaTexto_(r[I.MEDIDA]) : '', unidad: I.UNIDAD !== null ? String(r[I.UNIDAD] || '').trim() : '',
    stock: pnlNumero_(r[I.STOCK]) || 0, critico: I.CRITICO !== null ? (pnlNumero_(r[I.CRITICO]) || 0) : 0,
    precio: I.PRECIO !== null ? (pnlNumero_(r[I.PRECIO]) || 0) : 0, proveedor: I.PROVEEDOR !== null ? String(r[I.PROVEEDOR] || '') : '',
    familia: fam.familia, tipo: fam.tipo,
    stockMay: I.MAYORISTA !== null ? (pnlNumero_(r[I.MAYORISTA]) || 0) : null
  };
  if (conFila) { item._hoja = hoja; item._fila = fila; item._colStock = I.STOCK + 1; item._colMay = I.MAYORISTA !== null ? I.MAYORISTA + 1 : null; }
  return item;
}

function pnlItemCliente_(it) {
  return { codigo: it.codigo, desc: it.desc, unidad: it.unidad, stock: it.stock, critico: it.critico, precio: it.precio, proveedor: it.proveedor, familia: it.familia, tipo: it.tipo };
}

/** Medida como texto (los números con coma decimal). */
function pnlMedidaTexto_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return String(v).trim();
}

/** Descripción + medida (muchos insumos sólo se distinguen por la medida). */
function pnlDescConMedida_(desc, medida) {
  var d = String(desc || '').trim(), m = pnlMedidaTexto_(medida);
  return m && d.indexOf(m) < 0 ? d + ' ' + m : d;
}

function pnlDescMovimiento_(item) { return item.desc + (item.unidad ? ' x ' + item.unidad : ''); }

/* ------------------------------------------------------------------ */
/*  Escritura                                                          */
/* ------------------------------------------------------------------ */

/**
 * Próximo ID de consumos. No depende del orden de la hoja: toma el mayor entre las últimas y las primeras
 * 30 filas y el último ID entregado (ScriptProperties pnl_ult_id). Así, si la hoja quedó ordenada al revés
 * (lo más nuevo arriba), no vuelve a numerar desde IDs viejos. Se llama con el lock tomado.
 */
function pnlProximoId_(hoja, cols, ult) {
  var maxId = 0;
  var ver = function (desde, n) { if (n > 0) hoja.getRange(desde, cols.ID + 1, n, 1).getValues().forEach(function (x) { var v = pnlNumero_(x[0]); if (v !== null && v > maxId) maxId = v; }); };
  if (ult >= 2) { var d = Math.max(2, ult - 30); ver(d, ult - d + 1); ver(2, Math.min(30, ult - 1)); }
  var props = PropertiesService.getScriptProperties();
  var guardado = pnlNumero_(props.getProperty('pnl_ult_id'));
  if (guardado !== null && guardado > maxId) maxId = guardado;
  props.setProperty('pnl_ult_id', String(maxId + 1));
  return maxId + 1;
}

function pnlEscribirMovimiento_(m) {
  var hoja = pnlHojaConsumos_();
  var cols = pnlColsConsumos_();
  if ((m.puesto || m.maquina) && (cols.PUESTO === null || cols.MAQUINA === null) && typeof depAsegurarColumna_ === 'function') {
    depAsegurarColumna_(hoja, PNL_COLS_CONSUMOS.PUESTO); depAsegurarColumna_(hoja, PNL_COLS_CONSUMOS.MAQUINA);
    cols = pnlColsConsumos_();
    CacheService.getScriptCache().remove('pnl_cols_consumos');
  }
  ['ID', 'FECHA', 'HORA', 'CODIGO', 'CANTIDAD', 'SALDO', 'OPERADOR'].forEach(function (k) {
    if (cols[k] === null) throw new Error('consumos: falta la columna ' + PNL_COLS_CONSUMOS[k]);
  });
  var ancho = hoja.getLastColumn();
  var ult = hoja.getLastRow();
  var id = pnlProximoId_(hoja, cols, ult);
  var ahora = new Date();
  var y = Number(Utilities.formatDate(ahora, PANOL_CFG.TZ, 'yyyy'));
  var mo = Number(Utilities.formatDate(ahora, PANOL_CFG.TZ, 'M')) - 1;
  var d = Number(Utilities.formatDate(ahora, PANOL_CFG.TZ, 'd'));
  var hh = Number(Utilities.formatDate(ahora, PANOL_CFG.TZ, 'H'));
  var mi = Number(Utilities.formatDate(ahora, PANOL_CFG.TZ, 'm'));
  var ss = Number(Utilities.formatDate(ahora, PANOL_CFG.TZ, 's'));
  var fila = new Array(ancho);
  for (var i = 0; i < ancho; i++) fila[i] = '';
  var put = function (k, v) { if (cols[k] !== null && cols[k] < ancho) fila[cols[k]] = (v === undefined || v === null) ? '' : v; };
  put('ID', id);
  put('FECHA', new Date(y, mo, d));
  put('HORA', new Date(1899, 11, 30, hh, mi, ss));
  put('CODIGO', Number(m.codigo));
  put('DESCRIPCION', m.descripcion);
  put('CANTIDAD', m.cantidad);
  put('SALDO', m.saldo);
  put('OPERADOR', m.operador);
  put('CONSOLA', m.consola);
  put('LOTE', m.lote || '');
  put('PESO', m.peso === undefined ? '' : m.peso);
  put('TUBO', m.tubo || '');
  put('OBS', m.obs || '');
  put('OPCORR', m.opcorr || '');
  put('OT', m.ot ? (isFinite(Number(m.ot)) ? Number(m.ot) : m.ot) : '');
  put('TAREA', m.tarea ? (isFinite(Number(m.tarea)) ? Number(m.tarea) : m.tarea) : '');
  put('TIPO', m.tipo || '');
  put('ORIGEN', m.origen || PANOL_CFG.ORIGEN);
  put('MOTIVO', m.motivo || '');
  put('DEPOSITO', m.deposito || 'OPERATIVO');
  put('PUESTO', m.puesto || '');
  put('MAQUINA', m.maquina || '');
  var nueva = ult + 1;
  hoja.getRange(nueva, 1, 1, ancho).setValues([fila]);
  if (ult >= 2) hoja.getRange(ult, 1, 1, ancho).copyFormatToRange(hoja, 1, ancho, nueva, nueva);
  SpreadsheetApp.flush();
  return { id: id, fila: nueva };
}

function pnlActualizarStock_(item, delta) {
  var celda = item._hoja.getRange(item._fila, item._colStock);
  if (celda.getFormula()) throw new Error('La celda Stock del código ' + item.codigo + ' tiene fórmula: no se modifica. Avisá a administración.');
  var actual = pnlNumero_(celda.getValue()) || 0;
  celda.setValue(pnlRedondear_(actual + delta, 3));
  pnlBorrarCache_(CacheService.getScriptCache(), 'pnl_cat_v2');
}

function pnlLimpiarCacheCodigo_(cod) {
  var c = CacheService.getScriptCache();
  PNL_BLOQUE_MEMO_ = {};
  pnlBorrarCache_(c, 'pnl_eg3_' + pnlGenCache_() + '_' + cod);
}

function pnlHojaAlertas_() {
  var ss = SpreadsheetApp.openById(PANOL_CFG.CONSUMOS_ID);
  var h = ss.getSheetByName(PANOL_CFG.HOJA_ALERTAS);
  if (!h) {
    h = ss.insertSheet(PANOL_CFG.HOJA_ALERTAS);
    h.getRange(1, 1, 1, PNL_ENC_ALERTAS.length).setValues([PNL_ENC_ALERTAS])
      .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    h.setFrozenRows(1);
  }
  return h;
}

function pnlCrearAlerta_(a) {
  var h = pnlHojaAlertas_();
  var ahora = new Date();
  var id = 'AP-' + Utilities.formatDate(ahora, PANOL_CFG.TZ, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  var fila = [id, Utilities.formatDate(ahora, PANOL_CFG.TZ, 'dd/MM/yyyy'), Utilities.formatDate(ahora, PANOL_CFG.TZ, 'HH:mm'),
    a.tipo, a.nivel, a.operario || '', a.codigo || '', a.descripcion || '', a.cantidad === undefined ? '' : a.cantidad,
    a.ot || '', a.tarea || '', a.reglas || '', a.motivo || '', a.observacion || '', a.idMov || '', a.por || '',
    'PENDIENTE', '', '', ''];
  h.appendRow(fila);
  if (PANOL_CFG.MAIL_ALERTAS && a.tipo === 'DESVIO') {
    try {
      MailApp.sendEmail(PANOL_CFG.MAIL_ALERTAS, 'Pañol · Desvío en retiro de ' + a.codigo + ' ' + a.descripcion,
        'Operario: ' + a.operario + '\nCantidad: ' + a.cantidad + '\nOT: ' + (a.ot || '-') + ' · Tarea: ' + (a.tarea || '-') +
        '\nReglas: ' + a.reglas + '\nMotivo: ' + a.motivo + '\nObservación: ' + a.observacion + '\nRegistró: ' + a.por + '\nAlerta: ' + id);
    } catch (e) {}
  }
  return { id: id, tipo: a.tipo };
}

/** ¿Hay una alerta PENDIENTE de este tipo para este código? (una sola por código y tipo) */
function pnlAlertaPendiente_(tipo, codigo) {
  var h = pnlHojaAlertas_();
  if (h.getLastRow() < 2) return false;
  var desde = Math.max(2, h.getLastRow() - 499);
  var v = h.getRange(desde, 1, h.getLastRow() - desde + 1, PNL_ENC_ALERTAS.length).getValues();
  var iT = PNL_ENC_ALERTAS.indexOf('TIPO'), iC = PNL_ENC_ALERTAS.indexOf('CODIGO'), iE = PNL_ENC_ALERTAS.indexOf('ESTADO');
  for (var i = 0; i < v.length; i++) if (v[i][iT] === tipo && String(v[i][iC]) === String(codigo) && v[i][iE] === 'PENDIENTE') return true;
  return false;
}

/**
 * Stock CRÍTICO = mínimo del depósito MAYORISTA: por debajo hay que COMPRAR (Plan de compras).
 * Se controla cada vez que baja el mayorista (pase al operativo, entrega directa, ajuste, inventario).
 */
function pnlAlertaStock_(item, may, idMov, por) {
  if (!(item.critico > 0) || may === null || may === undefined || may > item.critico) return null;
  if (pnlAlertaPendiente_('STOCK_CRITICO', item.codigo)) return null;
  return pnlCrearAlerta_({
    tipo: 'STOCK_CRITICO', nivel: may <= 0 ? 'ALERTA' : 'AVISO', codigo: item.codigo, descripcion: item.desc,
    cantidad: pnlRedondear_(may, 3), reglas: 'Mayorista ' + pnlRedondear_(may, 3) + ' ≤ crítico ' + item.critico,
    motivo: 'COMPRA', observacion: 'El depósito mayorista llegó al stock crítico: revisar el Plan de compras.', idMov: idMov, por: por
  });
}

/** Consumo del pañol operativo (egresos de 90 días, sin entregas directas ni ajustes) y mínimo = consumo de las semanas del pase. */
function pnlConsumoOperativo_(eg, hoyDia) {
  var tot = 0;
  (eg || []).forEach(function (r) {
    var t = String(r.tipo || '').toUpperCase();
    if (r.dia < hoyDia - 90 || t === PANOL_CFG.TIPO_DIRECTA || /^AJUSTE|^INVENTARIO/.test(t)) return;
    tot += r.cant;
  });
  var semanas = typeof PNL_DEP !== 'undefined' && PNL_DEP.SEMANAS_PASE ? PNL_DEP.SEMANAS_PASE : 1;
  var diario = tot / 90;
  return { u90: pnlRedondear_(tot, 3), diario: diario, semanas: semanas, minimo: pnlRedondear_(diario * 7 * semanas, 2) };
}

/** El operativo quedó por debajo de su mínimo (consumo de la semana): hay que reponerlo con un PASE del mayorista. */
function pnlAlertaReponer_(item, saldo, c, idMov, por) {
  if (pnlAlertaPendiente_('REPONER OPERATIVO', item.codigo)) return null;
  var may = item.stockMay, dias = c && c.diario > 0 ? Math.floor(Math.max(saldo, 0) / c.diario) : null;
  var hayMay = may !== null && may !== undefined && may > 0;
  return pnlCrearAlerta_({
    tipo: 'REPONER OPERATIVO', nivel: saldo <= 0 ? 'ALERTA' : 'AVISO', codigo: item.codigo, descripcion: item.desc,
    cantidad: pnlRedondear_(saldo, 3),
    reglas: 'Operativo ' + pnlRedondear_(saldo, 3) + ' · mínimo ' + (c ? c.minimo : 0) + ' (consumo de ' + (c ? c.semanas : 1) + ' semana/s)' +
      (dias !== null ? ' · alcanza ~' + dias + ' d' : '') + (may !== null && may !== undefined ? ' · mayorista ' + pnlRedondear_(may, 3) : ''),
    motivo: hayMay ? 'PASE' : 'SIN STOCK EN MAYORISTA',
    observacion: hayMay ? 'El mayorista tiene ' + pnlRedondear_(may, 3) + ': reponer con un pase.' : 'El mayorista no tiene: ver el Plan de compras.',
    idMov: idMov, por: por
  });
}

function pnlContarAlertasPendientes_() {
  try {
    var ss = SpreadsheetApp.openById(PANOL_CFG.CONSUMOS_ID);
    var h = ss.getSheetByName(PANOL_CFG.HOJA_ALERTAS);
    if (!h || h.getLastRow() < 2) return 0;
    var iE = PNL_ENC_ALERTAS.indexOf('ESTADO') + 1;
    return h.getRange(2, iE, h.getLastRow() - 1, 1).getValues().filter(function (r) { return r[0] === 'PENDIENTE'; }).length;
  } catch (e) { return 0; }
}

/* ------------------------------------------------------------------ */
/*  Operarios (RRHH) y tareas (Consolidado)                            */
/* ------------------------------------------------------------------ */

/** Operarios de RRHH. fresco = true (al abrir un modal) lee la planilla y renueva la caché: un alta nueva aparece al reabrir. */
function pnlOperarios_(fresco) {
  var cache = CacheService.getScriptCache();
  var c = fresco ? null : pnlLeerCache_(cache, 'pnl_ops_v1');
  if (c) return c;
  var hoja = pnlHojaPorGid_(SpreadsheetApp.openById(PANOL_CFG.RRHH_ID), PANOL_CFG.RRHH_GID);
  var datos = hoja.getDataRange().getValues();
  var I = pnlMapearIndices_(datos[0], PNL_COLS_RRHH);
  if (I.LEGAJO === null || I.APELLIDO === null || I.NOMBRE === null) throw new Error('RRHH: faltan columnas Legajo / Apellido / Nombre.');
  var lista = [];
  for (var i = 1; i < datos.length; i++) {
    var r = datos[i];
    var leg = pnlCodigo_(r[I.LEGAJO]);
    var ape = String(r[I.APELLIDO] || '').trim(), nom = String(r[I.NOMBRE] || '').trim();
    if (!leg || !ape) continue;
    var est = I.ESTADO !== null ? String(r[I.ESTADO] || '').trim().toLowerCase() : 'activo';
    lista.push({ leg: leg, ape: ape, nom: nom, corto: ape + ', ' + nom, disp: leg + ' - ' + ape + ', ' + nom,
      puesto: I.PUESTO !== null ? String(r[I.PUESTO] || '').trim() : '', activo: est !== 'baja' });
  }
  lista.sort(function (a, b) { return (b.activo - a.activo) || a.ape.localeCompare(b.ape); });
  var out = { lista: lista };
  pnlEscribirCache_(cache, 'pnl_ops_v1', out, 600);
  PNL_IDX_MEMO_ = null;
  return out;
}

var PNL_IDX_MEMO_ = null;
function pnlIndiceOperarios_() {
  if (PNL_IDX_MEMO_) return PNL_IDX_MEMO_;
  var ops = pnlOperarios_().lista;
  var porLeg = {}, porNombre = {};
  ops.forEach(function (o) {
    porLeg[o.leg] = o;
    var k = pnlNorm_(o.corto);
    if (!porNombre[k] || o.activo) porNombre[k] = o.leg;
  });
  PNL_IDX_MEMO_ = { porLeg: porLeg, porNombre: porNombre };
  return PNL_IDX_MEMO_;
}

/** "340 - AREVALO, ..." → 340 · nombre de consola → legajo (mapeo aprobado o RRHH). */
function pnlLegajoDe_(txt, fecha, idx) {
  var s = String(txt === null || txt === undefined ? '' : txt).trim();
  if (!s) return '';
  var m = s.match(/^(\d+)\s*-/);
  if (m) return m[1];
  if (typeof resolverOperario_ === 'function') {
    try {
      var r = resolverOperario_(s, fecha || '');
      if (r && r.ok) { m = String(r.valor).match(/^(\d+)\s*-/); if (m) return m[1]; }
    } catch (e) {}
  }
  var k = pnlNorm_(s);
  return idx.porNombre[k] || '';
}

/** Descripción de la tarea según la familia del modelo (Consolidado › TAREAS). */
function pnlDescTarea_(tarea, modelo) {
  if (!tarea) return '';
  var T = pnlTareas_();
  var r = T[String(tarea)];
  if (!r) return '';
  var m = String(modelo || '');
  var col = 'dis';
  if (m === '9090201') col = 'her';
  else if (m === '9090101') col = 'acc';
  else if (m === '9090301') col = 'np';
  else if (/^11/.test(m)) col = 'rur';
  else if (/^1[567]/.test(m)) col = 'pot';
  return r[col] || r.dis || r.pot || r.rur || r.acc || r.her || r.np || '';
}

function pnlTareas_() {
  var cache = CacheService.getScriptCache();
  var c = pnlLeerCache_(cache, 'pnl_tareas_v1');
  if (c) return c;
  var out = {};
  try {
    var h = SpreadsheetApp.openById(PANOL_CFG.CONSOLIDADO_ID).getSheetByName(PANOL_CFG.HOJA_TAREAS);
    var v = h.getDataRange().getValues();
    var fEnc = -1;
    for (var i = 0; i < Math.min(10, v.length); i++) if (pnlNorm_(v[i][0]) === 'COD DE TAREA') { fEnc = i; break; }
    if (fEnc >= 0) {
      var I = pnlMapearIndices_(v[fEnc], { dis: 'DISTRIBUCION', pot: 'POTENCIA', rur: 'RURALES', her: 'HERRAJES - 9090201', acc: 'ACCESORIOS - 9090101', np: 'NO PRODUCTIVO - 9090301' });
      for (var j = fEnc + 1; j < v.length; j++) {
        var cod = pnlCodigo_(v[j][0]);
        if (!cod) continue;
        var o = {};
        Object.keys(I).forEach(function (k) { if (I[k] !== null && v[j][I[k]]) o[k] = String(v[j][I[k]]).trim(); });
        out[cod] = o;
      }
    }
  } catch (e) {}
  pnlEscribirCache_(cache, 'pnl_tareas_v1', out, 21600);
  return out;
}

/* ------------------------------------------------------------------ */
/*  Query de Google (gviz)                                             */
/* ------------------------------------------------------------------ */

function pnlGviz_(ssId, gid, query) {
  var url = 'https://docs.google.com/spreadsheets/d/' + ssId + '/gviz/tq?tqx=out:json&headers=1&gid=' + gid + '&tq=' + encodeURIComponent(query);
  var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  var txt = resp.getContentText();
  if (resp.getResponseCode() !== 200) throw new Error('Consulta de Google (' + resp.getResponseCode() + '): ' + txt.slice(0, 200));
  var json;
  var k = txt.indexOf('setResponse(');
  if (k >= 0) json = JSON.parse(txt.substring(k + 12, txt.lastIndexOf(')')));
  else json = JSON.parse(txt.replace(/^\)\]\}'\s*/, ''));
  if (json.status === 'error') {
    throw new Error('Consulta de Google: ' + (json.errors || []).map(function (e) { return e.detailed_message || e.message; }).join(' | ') + ' [' + query + ']');
  }
  var t = json.table || { cols: [], rows: [] };
  return {
    cols: (t.cols || []).map(function (c) { return { id: c.id, label: c.label, type: c.type }; }),
    rows: (t.rows || []).map(function (r) { return (r.c || []).map(pnlCelda_); })
  };
}

function pnlCelda_(c) {
  if (!c) return null;
  var v = c.v;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.indexOf('Date(') === 0) {
    var p = v.slice(5, -1).split(',').map(Number);
    return { y: p[0], m: p[1] + 1, d: p[2], h: p[3] || 0, mi: p[4] || 0, s: p[5] || 0, dia: Math.floor(Date.UTC(p[0], p[1], p[2]) / 864e5) };
  }
  if (Object.prototype.toString.call(v) === '[object Array]') return { h: v[0] || 0, mi: v[1] || 0, s: v[2] || 0, hora: true };
  return v;
}

/** Letras de columna por nombre de encabezado (caché 6 h). */
/** 'A' → 'B', 'Z' → 'AA' (letras de columna de gviz). */
function pnlLetraSiguiente_(l) {
  var n = 0; String(l).toUpperCase().split('').forEach(function (ch) { n = n * 26 + (ch.charCodeAt(0) - 64); });
  n++; var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function pnlColumnasGviz_(ssId, gid, def, clave) {
  var cache = CacheService.getScriptCache();
  var k = 'pnl_cols_' + clave;
  var c = cache.get(k);
  if (c) return JSON.parse(c);
  var t = pnlGviz_(ssId, gid, 'select * limit 0');
  var out = {};
  Object.keys(def).forEach(function (key) {
    var objetivo = pnlNorm_(def[key]);
    out[key] = null;
    for (var i = 0; i < t.cols.length; i++) if (pnlNorm_(t.cols[i].label) === objetivo) { out[key] = t.cols[i].id; break; }
  });
  cache.put(k, JSON.stringify(out), 21600);
  return out;
}

/**
 * Excluye los movimientos del depósito mayorista (compras, pases, ajustes) de las estadísticas de consumo.
 * Las ENTREGAS DIRECTAS del mayorista a un operario sí son consumo: entran.
 */
function pnlFiltroOperativo_(L) {
  if (!L.DEPOSITO) return '';
  // "not (… = …)" también deja pasar las celdas vacías (con "is null" gviz las descartaba)
  return ' and not (' + L.DEPOSITO + " = 'MAYORISTA'" + (L.TIPO ? ' and not ' + L.TIPO + " = '" + PANOL_CFG.TIPO_DIRECTA + "'" : '') + ')';
}

function pnlColsConsumosGviz_() {
  var L = pnlColumnasGviz_(PANOL_CFG.CONSUMOS_ID, PANOL_CFG.CONSUMOS_GID, PNL_COLS_CONSUMOS, 'consumos');
  ['ID', 'FECHA', 'CODIGO', 'CANTIDAD', 'OPERADOR'].forEach(function (k) { if (!L[k]) throw new Error('consumos: falta la columna ' + PNL_COLS_CONSUMOS[k]); });
  return L;
}

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

function pnlEnvolver_(fn) {
  try { return { ok: true, data: fn() }; }
  catch (err) { return { ok: false, error: String(err && err.message ? err.message : err) }; }
}

function pnlHojaConsumos_() {
  var h = pnlHojaPorGid_(SpreadsheetApp.openById(PANOL_CFG.CONSUMOS_ID), PANOL_CFG.CONSUMOS_GID);
  if (!h) throw new Error('No encuentro la hoja de movimientos de consumos.');
  return h;
}

function pnlColsConsumos_() {
  var h = pnlHojaConsumos_();
  return pnlMapearIndices_(h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0], PNL_COLS_CONSUMOS);
}

function pnlHojaPorGid_(ss, gid) {
  var hs = ss.getSheets();
  for (var i = 0; i < hs.length; i++) if (hs[i].getSheetId() === Number(gid)) return hs[i];
  return null;
}

function pnlNorm_(s) {
  return String(s === null || s === undefined ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function pnlMapearIndices_(enc, def) {
  var n = enc.map(pnlNorm_);
  var out = {};
  Object.keys(def).forEach(function (k) { var i = n.indexOf(pnlNorm_(def[k])); out[k] = i >= 0 ? i : null; });
  return out;
}

function pnlCodigo_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? String(Math.round(v)) : '';
  var s = String(v).trim().replace(/\.0+$/, '');
  return /^\d+$/.test(s) ? s : '';
}

function pnlNumero_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (s === '-' || s === '') return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s);
  return isFinite(n) ? n : null;
}

function pnlRedondear_(n, d) { if (n === null || n === undefined || !isFinite(n)) return null; var f = Math.pow(10, d); return Math.round(n * f) / f; }
function pnlPad2_(n) { n = Number(n); return (n < 10 ? '0' : '') + n; }
function pnlFmt_(n) { if (n === null || n === undefined) return '—'; var r = pnlRedondear_(n, n >= 10 ? 1 : 2); return String(r).replace('.', ','); }

function pnlMediana_(a) { return pnlPercentil_(a, 0.5); }
function pnlPercentil_(a, p) {
  if (!a || !a.length) return 0;
  var s = a.slice().sort(function (x, y) { return x - y; });
  var pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function pnlHoy_() {
  var iso = Utilities.formatDate(new Date(), PANOL_CFG.TZ, 'yyyy-MM-dd');
  var p = iso.split('-').map(Number);
  return { iso: iso, dia: Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5) };
}
function pnlIsoMenos_(dias) {
  var h = pnlHoy_();
  var d = new Date((h.dia - dias) * 864e5);
  return d.getUTCFullYear() + '-' + pnlPad2_(d.getUTCMonth() + 1) + '-' + pnlPad2_(d.getUTCDate());
}
function pnlTextoDia_(dia) {
  if (dia === null || dia === undefined) return '';
  var d = new Date(dia * 864e5);
  return pnlPad2_(d.getUTCDate()) + '/' + pnlPad2_(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
}
function pnlHoraTexto_(h) {
  if (!h) return '';
  if (typeof h === 'object' && h.h !== undefined) return pnlPad2_(h.h) + ':' + pnlPad2_(h.mi);
  return String(h);
}

/** Cualquier valor (celda gviz o de hoja) a texto para el cliente. Nunca un Date. */
function pnlTexto_(v, tipo) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, PANOL_CFG.TZ, tipo === 'FECHAHORA' ? 'dd/MM/yyyy HH:mm' : (tipo === 'HORA' ? 'HH:mm' : 'dd/MM/yyyy'));
  }
  if (typeof v === 'object') {
    if (v.hora) return pnlPad2_(v.h) + ':' + pnlPad2_(v.mi);
    if (v.y !== undefined) {
      var f = pnlPad2_(v.d) + '/' + pnlPad2_(v.m) + '/' + v.y;
      return tipo === 'FECHAHORA' && (v.h || v.mi) ? f + ' ' + pnlPad2_(v.h) + ':' + pnlPad2_(v.mi) : f;
    }
    return JSON.stringify(v);
  }
  return typeof v === 'number' ? v : String(v);
}

function pnlNumOTexto_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  return /^\d+$/.test(s) ? Number(s) : s;
}

function pnlLiteral_(s) {
  s = String(s);
  return s.indexOf("'") < 0 ? "'" + s + "'" : '"' + s.replace(/"/g, '') + '"';
}

/* CacheService admite 100 KB por clave: se guarda en trozos. */
function pnlEscribirCache_(cache, clave, obj, seg) {
  try {
    var txt = JSON.stringify(obj);
    var tam = 90000, n = Math.ceil(txt.length / tam), m = {};
    if (n > 50) return;
    for (var i = 0; i < n; i++) m[clave + '_' + i] = txt.substr(i * tam, tam);
    m[clave + '_n'] = String(n);
    cache.putAll(m, seg);
  } catch (e) {}
}
function pnlLeerCache_(cache, clave) {
  try {
    var n = Number(cache.get(clave + '_n'));
    if (!n) return null;
    var ks = []; for (var i = 0; i < n; i++) ks.push(clave + '_' + i);
    var m = cache.getAll(ks), txt = '';
    for (var j = 0; j < n; j++) { if (m[ks[j]] === undefined || m[ks[j]] === null) return null; txt += m[ks[j]]; }
    return JSON.parse(txt);
  } catch (e) { return null; }
}
function pnlBorrarCache_(cache, clave) {
  var n = Number(cache.get(clave + '_n')) || 0;
  var ks = [clave + '_n'];
  for (var i = 0; i < n; i++) ks.push(clave + '_' + i);
  cache.removeAll(ks);
}
