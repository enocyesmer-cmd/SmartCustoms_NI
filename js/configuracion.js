// SmartCustoms NI - configuracion (solo administrador)

// guarda los datos que se llenan solos al declarar
function guardarDatosDeclarante() {
    var empresa = limpiarEspacios($('cfEmpresa').value);
    var codigo = limpiarEspacios($('cfCodigo').value);
    var aduana = limpiarEspacios($('cfAduana').value);

    if (empresa.length > 80) { mostrarAviso('El nombre de la empresa es muy largo (máx. 80)'); return; }
    if (codigo != '' && !PATRON.codigo.test(codigo)) { mostrarAviso('Código declarante: solo letras, números, punto y guion (máx. 15)'); return; }
    if (aduana != '' && !PATRON.aduana.test(aduana)) { mostrarAviso('La aduana debe tener 4 dígitos, por ejemplo 0610'); return; }

    if (guardarLista(K.config, { empresa: empresa, codigoDeclarante: codigo, aduanaDefecto: aduana })) {
        mostrarAviso('Datos guardados');
    }
}

// ---------- usuarios ----------

// cuenta administradores activos (siempre debe quedar uno)
function cuantosAdminActivos(lista) {
    return lista.filter(function (u) { return u.rol == 'administrador' && u.activo; }).length;
}

// valida y agrega un usuario nuevo
function crearUsuario() {
    var error = $('errorUsuario');
    var usuario = $('uUsuario').value.trim();
    var nombre = limpiarEspacios($('uNombre').value);
    var rol = $('uRol').value;
    var clave = $('uClave').value;
    var lista = leerLista(K.usuarios);

    if (!PATRON.usuario.test(usuario)) { error.textContent = 'Usuario: de 3 a 20 caracteres, solo letras, números, punto, guion o guion bajo'; return; }
    if (!largoOk(nombre, 2, 60)) { error.textContent = 'El nombre es obligatorio (2 a 60 caracteres)'; return; }
    if (ROLES.indexOf(rol) == -1) { error.textContent = 'Elija un rol válido'; return; }
    if (clave.length < 6 || clave.length > 64) { error.textContent = 'La contraseña debe tener entre 6 y 64 caracteres'; return; }
    if (clave.toLowerCase() == usuario.toLowerCase()) { error.textContent = 'La contraseña no puede ser igual al usuario'; return; }
    if (lista.some(function (u) { return u.usuario.toLowerCase() == usuario.toLowerCase(); })) {
        error.textContent = 'Ese usuario ya existe';
        return;
    }

    lista.push({ id: nuevoId(), usuario: usuario, nombre: nombre, rol: rol, claveHash: hashClave(clave), activo: true });
    if (!guardarLista(K.usuarios, lista)) return;

    error.textContent = '';
    vaciarCampos(['uUsuario', 'uNombre', 'uClave']);
    mostrarUsuarios();
    mostrarAviso('Usuario creado');
}

// cambia el rol, sin dejar el sistema sin administrador
function cambiarRolUsuario(id, rol) {
    var lista = leerLista(K.usuarios);
    var u = porId(lista, id);
    if (u.rol == 'administrador' && rol != 'administrador' && cuantosAdminActivos(lista) <= 1) {
        mostrarAviso('Debe quedar al menos un administrador activo');
        mostrarUsuarios();
        return;
    }
    u.rol = rol;
    guardarLista(K.usuarios, lista);
    mostrarAviso('Rol actualizado');
}

// activa o desactiva a un usuario
function activarUsuario(id) {
    var lista = leerLista(K.usuarios);
    var u = porId(lista, id);
    if (u.activo && u.rol == 'administrador' && cuantosAdminActivos(lista) <= 1) {
        mostrarAviso('Debe quedar al menos un administrador activo');
        return;
    }
    if (u.activo && u.id == sesionActual().id) {
        mostrarAviso('No puede desactivar su propio usuario');
        return;
    }
    u.activo = !u.activo;
    guardarLista(K.usuarios, lista);
    mostrarUsuarios();
}

// el admin le pone una clave nueva a otro usuario
function restablecerClave(id) {
    var lista = leerLista(K.usuarios);
    var u = porId(lista, id);
    var nueva = prompt('Nueva contraseña para ' + u.usuario + ' (mínimo 6 caracteres):');
    if (nueva === null) return;
    if (nueva.length < 6 || nueva.length > 64) { mostrarAviso('La contraseña debe tener entre 6 y 64 caracteres'); return; }
    u.claveHash = hashClave(nueva);
    guardarLista(K.usuarios, lista);
    mostrarAviso('Contraseña restablecida');
}

// elimina un usuario (no a uno mismo)
function borrarUsuario(id) {
    var lista = leerLista(K.usuarios);
    var u = porId(lista, id);
    if (u.id == sesionActual().id) { mostrarAviso('No puede eliminar su propio usuario'); return; }
    if (u.rol == 'administrador' && cuantosAdminActivos(lista) <= 1) {
        mostrarAviso('Debe quedar al menos un administrador activo');
        return;
    }
    if (!confirm('¿Eliminar al usuario ' + u.usuario + '?')) return;
    guardarLista(K.usuarios, lista.filter(function (x) { return x.id != id; }));
    mostrarUsuarios();
}

// dibuja la tabla de usuarios
function mostrarUsuarios() {
    var lista = leerLista(K.usuarios);
    var html = '';

    lista.forEach(function (u) {
        var opciones = ROLES.map(function (r) {
            return '<option' + (r == u.rol ? ' selected' : '') + '>' + r + '</option>';
        }).join('');

        html += '<tr data-id="' + u.id + '">' +
            '<td>' + escaparHTML(u.usuario) + '</td>' +
            '<td>' + escaparHTML(u.nombre) + '</td>' +
            '<td><select>' + opciones + '</select></td>' +
            '<td>' + (u.activo ? 'Activo' : 'Desactivado') + '</td>' +
            '<td class="acciones">' +
            '<button class="editar">' + icono('shield') + 'Clave</button>' +
            '<button class="estado-btn">' + (u.activo ? 'Desactivar' : 'Activar') + '</button>' +
            '<button class="borrar">' + icono('trash') + 'Eliminar</button>' +
            '</td></tr>';
    });
    $('listaUsuarios').innerHTML = html;
    etiquetarTablas();
}

// un solo evento para los botones y el rol de todas las filas
function accionUsuario(e) {
    var fila = e.target.closest('tr[data-id]');
    var b = e.target.closest('button');
    if (!fila) return;
    if (e.target.tagName == 'SELECT') return;
    if (!b) return;
    ({ editar: restablecerClave, 'estado-btn': activarUsuario, borrar: borrarUsuario })[b.className](fila.dataset.id);
}

// ---------- respaldo ----------

// baja todos los datos en un json
function exportarRespaldo() {
    var copia = {
        fecha: new Date().toISOString(),
        usuarios: leerLista(K.usuarios),
        clientes: leerLista(K.clientes),
        productos: leerLista(K.productos),
        declaraciones: leerLista(K.declaraciones),
        config: leerConfig(),
        recibosGenerados: leerRecibos()
    };
    descargar('respaldo_smartcustoms.json', JSON.stringify(copia, null, 2), 'application/json');
}

// lee un json de respaldo y reemplaza los datos
// texto limpio y con largo maximo (lo que no sea texto queda vacio)
function textoSeguro(valor, max) {
    if (typeof valor != 'string' && typeof valor != 'number') return '';
    return limpiarEspacios(valor).slice(0, max);
}

// numero de id seguro (si no lo es, se genera uno)
function idSeguro(valor) {
    var n = Number(valor);
    return (isFinite(n) && n > 0 && n < 1e15) ? Math.floor(n) : nuevoId();
}

// revisa y limpia el respaldo antes de usarlo, para que un archivo raro no rompa la web.
// lo que no cumpla el formato se descarta. Devuelve los datos limpios y cuantos se descartaron.
function limpiarRespaldo(d) {
    if (!d || typeof d != 'object') throw new Error('formato');
    var limpio = { usuarios: [], clientes: [], productos: [], declaraciones: [], descartados: 0 };
    var estados = ['Pendiente', 'Revisado', 'Aprobado'];

    // usuarios: si alguno viene mal, no se acepta el respaldo (podria dejar sin acceso)
    if (!Array.isArray(d.usuarios) || d.usuarios.length == 0) throw new Error('sin usuarios');
    for (var i = 0; i < d.usuarios.length; i++) {
        var u = d.usuarios[i];
        if (!u || !PATRON.usuario.test(String(u.usuario)) || ROLES.indexOf(u.rol) == -1 ||
            !/^[0-9a-f]{1,16}$/.test(String(u.claveHash))) throw new Error('usuario');
        limpio.usuarios.push({
            id: idSeguro(u.id), usuario: u.usuario, nombre: textoSeguro(u.nombre, 60) || u.usuario,
            rol: u.rol, claveHash: u.claveHash, activo: u.activo !== false
        });
    }
    var hayAdmin = limpio.usuarios.some(function (u) { return u.rol == 'administrador' && u.activo; });
    if (!hayAdmin) throw new Error('sin administrador');

    // clientes
    (Array.isArray(d.clientes) ? d.clientes : []).forEach(function (c) {
        if (!c || !PATRON.codigo.test(String(c.codigo)) || !largoOk(textoSeguro(c.nombre, 80), 2, 80)) { limpio.descartados++; return; }
        limpio.clientes.push({
            id: idSeguro(c.id), codigo: c.codigo, nombre: textoSeguro(c.nombre, 80),
            tipo: ['Importador', 'Consignatario', 'Ambos'].indexOf(c.tipo) != -1 ? c.tipo : 'Importador',
            ruc: textoSeguro(c.ruc, 20), telefono: textoSeguro(c.telefono, 20),
            correo: textoSeguro(c.correo, 80), direccion: textoSeguro(c.direccion, 120)
        });
    });

    // productos
    (Array.isArray(d.productos) ? d.productos : []).forEach(function (p) {
        if (!p || !PATRON.partida.test(String(p.partida)) || !largoOk(textoSeguro(p.descripcion, 150), 3, 150)) { limpio.descartados++; return; }
        limpio.productos.push({
            id: idSeguro(p.id), partida: p.partida, descripcion: textoSeguro(p.descripcion, 150),
            origen: PATRON.pais.test(String(p.origen)) ? String(p.origen).toUpperCase() : '',
            procedimiento: PATRON.procedimiento.test(String(p.procedimiento)) ? String(p.procedimiento) : ''
        });
    });

    // declaraciones
    (Array.isArray(d.declaraciones) ? d.declaraciones : []).forEach(function (r) {
        if (!r || typeof r.campos != 'object' || !r.campos || !/^\d{2}\/\d{2}\/\d{4}$/.test(String(r.fecha)) ||
            estados.indexOf(r.estado) == -1 || textoSeguro(r.referencia, 20) == '') { limpio.descartados++; return; }

        var campos = {};
        Object.keys(r.campos).slice(0, 80).forEach(function (k) { campos[textoSeguro(k, 60)] = textoSeguro(r.campos[k], 200); });

        limpio.declaraciones.push({
            id: idSeguro(r.id), campos: campos, estado: r.estado, fecha: r.fecha,
            referencia: textoSeguro(r.referencia, 20), tipo: textoSeguro(r.tipo, 10),
            factura: textoSeguro(r.factura, 40), cliente: textoSeguro(r.cliente, 80),
            aduana: textoSeguro(r.aduana, 10), usuario: textoSeguro(r.usuario, 20),
            documentos: (Array.isArray(r.documentos) ? r.documentos : []).slice(0, 10).map(function (x) {
                x = x || {};
                return { codigo: textoSeguro(x.codigo, 10), documento: textoSeguro(x.documento, 60),
                    referencia: textoSeguro(x.referencia, 40), fecha: textoSeguro(x.fecha, 10) };
            }),
            mercancias: (Array.isArray(r.mercancias) ? r.mercancias : []).slice(0, 50).map(function (x) {
                x = x || {};
                return { partida: textoSeguro(x.partida, 8), descripcion: textoSeguro(x.descripcion, 200),
                    cantidad: textoSeguro(x.cantidad, 20), pesoBruto: textoSeguro(x.pesoBruto, 20),
                    pesoNeto: textoSeguro(x.pesoNeto, 20), fob: textoSeguro(x.fob, 20),
                    origen: textoSeguro(x.origen, 2), procedimiento: textoSeguro(x.procedimiento, 4) };
            }),
            historial: (Array.isArray(r.historial) ? r.historial : []).slice(0, 100).map(function (x) {
                x = x || {};
                return { usuario: textoSeguro(x.usuario, 20), fecha: textoSeguro(x.fecha, 10), estado: textoSeguro(x.estado, 20) };
            })
        });
    });

    limpio.config = {
        empresa: textoSeguro((d.config || {}).empresa, 80),
        codigoDeclarante: PATRON.codigo.test(String((d.config || {}).codigoDeclarante)) ? d.config.codigoDeclarante : '',
        aduanaDefecto: PATRON.aduana.test(String((d.config || {}).aduanaDefecto)) ? d.config.aduanaDefecto : ''
    };
    // los respaldos viejos guardaban el contador como xmlGenerados
    limpio.recibosGenerados = Math.max(0, Math.min(parseInt(d.recibosGenerados || d.xmlGenerados) || 0, 1e9));
    return limpio;
}

// lee un json de respaldo y reemplaza los datos
function importarRespaldo(archivo) {
    if (archivo.size > 5 * 1024 * 1024) {
        mostrarAviso('El archivo es demasiado grande (máx. 5 MB)');
        return;
    }
    var lector = new FileReader();
    lector.onload = function () {
        try {
            var d = limpiarRespaldo(JSON.parse(lector.result));
            var aviso = d.descartados > 0 ? ' (' + d.descartados + ' registros con datos inválidos se descartarán)' : '';
            if (!confirm('Esto reemplaza todos los datos actuales' + aviso + '. ¿Continuar?')) return;

            var ok = guardarLista(K.usuarios, d.usuarios) && guardarLista(K.clientes, d.clientes) &&
                guardarLista(K.productos, d.productos) && guardarLista(K.declaraciones, d.declaraciones) &&
                guardarLista(K.config, d.config);
            if (!ok) return;
            localStorage.setItem(K.recibos, d.recibosGenerados);
            localStorage.removeItem('sc_xml_generados');
            mostrarAviso('Respaldo cargado');
            setTimeout(function () { window.location.reload(); }, 800);
        } catch (e) {
            mostrarAviso('El archivo no es un respaldo válido');
        }
    };
    lector.readAsText(archivo);
}

// borra declaraciones, clientes y productos (los usuarios se quedan)
function borrarDatos() {
    if (!confirm('Se borrarán todas las declaraciones, clientes y productos. Los usuarios se mantienen. ¿Continuar?')) return;
    localStorage.removeItem(K.declaraciones);
    localStorage.removeItem(K.clientes);
    localStorage.removeItem(K.productos);
    localStorage.removeItem(K.recibos);
    localStorage.removeItem('sc_xml_generados');
    mostrarAviso('Datos borrados');
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    var conf = leerConfig();
    $('cfEmpresa').value = conf.empresa || '';
    $('cfCodigo').value = conf.codigoDeclarante || '';
    $('cfAduana').value = conf.aduanaDefecto || '';

    limitarCampos(document, 80);
    $('cfCodigo').setAttribute('maxlength', 15);
    $('cfAduana').setAttribute('maxlength', 4);
    $('uUsuario').setAttribute('maxlength', 20);
    $('uClave').setAttribute('maxlength', 64);
    $('listaUsuarios').addEventListener('click', accionUsuario);
    $('listaUsuarios').addEventListener('change', function (e) {
        cambiarRolUsuario(e.target.closest('tr').dataset.id, e.target.value);
    });
    $('btnGuardarConfig').onclick = guardarDatosDeclarante;
    $('btnCrearUsuario').onclick = crearUsuario;
    $('btnExportar').onclick = exportarRespaldo;
    $('btnBorrarDatos').onclick = borrarDatos;

    var archivo = $('archivoRespaldo');
    $('btnImportar').onclick = function () { archivo.click(); };
    archivo.onchange = function () {
        if (archivo.files.length) importarRespaldo(archivo.files[0]);
        archivo.value = '';   // para poder elegir el mismo archivo otra vez
    };

    mostrarUsuarios();
});
