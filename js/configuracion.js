// SmartCustoms NI - configuracion (solo administrador)

function guardarDatosDeclarante() {
    guardarConfig({
        empresa: document.getElementById('cfEmpresa').value.trim(),
        codigoDeclarante: document.getElementById('cfCodigo').value.trim(),
        aduanaDefecto: document.getElementById('cfAduana').value.trim()
    });
    mostrarAviso('Datos guardados');
}



function cuantosAdminActivos(lista) {
    var n = 0;
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].rol == 'administrador' && lista[i].activo) n++;
    }
    return n;
}

function crearUsuario() {
    var error = document.getElementById('errorUsuario');
    var usuario = document.getElementById('uUsuario').value.trim();
    var nombre = document.getElementById('uNombre').value.trim();
    var rol = document.getElementById('uRol').value;
    var clave = document.getElementById('uClave').value;
    var lista = leerLista(K.usuarios);

    if (usuario == '' || nombre == '') { error.textContent = 'Escriba el usuario y el nombre'; return; }
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(usuario)) { error.textContent = 'El usuario necesita 3 caracteres o más, sin espacios'; return; }
    if (clave.length < 6) { error.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].usuario.toLowerCase() == usuario.toLowerCase()) {
            error.textContent = 'Ese usuario ya existe';
            return;
        }
    }

    lista.push({ id: nuevoId(), usuario: usuario, nombre: nombre, rol: rol, claveHash: hashClave(clave), activo: true });
    guardarLista(K.usuarios, lista);

    error.textContent = '';
    document.getElementById('uUsuario').value = '';
    document.getElementById('uNombre').value = '';
    document.getElementById('uClave').value = '';
    mostrarUsuarios();
    mostrarAviso('Usuario creado');
}

function buscarUsuario(lista, id) {
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) return lista[i];
    }
    return null;
}

function cambiarRolUsuario(id, rol) {
    var lista = leerLista(K.usuarios);
    var u = buscarUsuario(lista, id);
    if (u.rol == 'administrador' && rol != 'administrador' && cuantosAdminActivos(lista) <= 1) {
        mostrarAviso('Debe quedar al menos un administrador activo');
        mostrarUsuarios();
        return;
    }
    u.rol = rol;
    guardarLista(K.usuarios, lista);
    mostrarAviso('Rol actualizado');
}

function activarUsuario(id) {
    var lista = leerLista(K.usuarios);
    var u = buscarUsuario(lista, id);
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

function restablecerClave(id) {
    var lista = leerLista(K.usuarios);
    var u = buscarUsuario(lista, id);
    var nueva = prompt('Nueva contraseña para ' + u.usuario + ' (mínimo 6 caracteres):');
    if (nueva === null) return;
    if (nueva.length < 6) { mostrarAviso('La contraseña es muy corta'); return; }
    u.claveHash = hashClave(nueva);
    guardarLista(K.usuarios, lista);
    mostrarAviso('Contraseña restablecida');
}

function borrarUsuario(id) {
    var lista = leerLista(K.usuarios);
    var u = buscarUsuario(lista, id);
    if (u.id == sesionActual().id) { mostrarAviso('No puede eliminar su propio usuario'); return; }
    if (u.rol == 'administrador' && cuantosAdminActivos(lista) <= 1) {
        mostrarAviso('Debe quedar al menos un administrador activo');
        return;
    }
    if (!confirm('¿Eliminar al usuario ' + u.usuario + '?')) return;
    guardarLista(K.usuarios, lista.filter(function (x) { return x.id != id; }));
    mostrarUsuarios();
}

function mostrarUsuarios() {
    var lista = leerLista(K.usuarios);
    var html = '';

    for (var i = 0; i < lista.length; i++) {
        var u = lista[i];
        var opciones = '';
        for (var r = 0; r < ROLES.length; r++) {
            opciones += '<option' + (ROLES[r] == u.rol ? ' selected' : '') + '>' + ROLES[r] + '</option>';
        }

        html += '<tr>' +
            '<td>' + escaparXML(u.usuario) + '</td>' +
            '<td>' + escaparXML(u.nombre) + '</td>' +
            '<td><select onchange="cambiarRolUsuario(' + u.id + ', this.value)">' + opciones + '</select></td>' +
            '<td>' + (u.activo ? 'Activo' : 'Desactivado') + '</td>' +
            '<td class="acciones">' +
            '<button class="editar" onclick="restablecerClave(' + u.id + ')">Clave</button>' +
            '<button class="estado-btn" onclick="activarUsuario(' + u.id + ')">' + (u.activo ? 'Desactivar' : 'Activar') + '</button>' +
            '<button class="borrar" onclick="borrarUsuario(' + u.id + ')">Eliminar</button>' +
            '</td></tr>';
    }
    document.getElementById('listaUsuarios').innerHTML = html;
    etiquetarTablas();
}



function exportarRespaldo() {
    var copia = {
        fecha: new Date().toISOString(),
        usuarios: leerLista(K.usuarios),
        clientes: leerLista(K.clientes),
        productos: leerLista(K.productos),
        declaraciones: leerLista(K.declaraciones),
        config: leerConfig(),
        xmlGenerados: parseInt(localStorage.getItem(K.xml)) || 0
    };
    var blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'respaldo_smartcustoms.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importarRespaldo(archivo) {
    var lector = new FileReader();
    lector.onload = function () {
        try {
            var d = JSON.parse(lector.result);
            if (!Array.isArray(d.usuarios) || d.usuarios.length == 0) throw new Error('sin usuarios');
            if (!confirm('Esto reemplaza todos los datos actuales. ¿Continuar?')) return;

            guardarLista(K.usuarios, d.usuarios);
            guardarLista(K.clientes, d.clientes || []);
            guardarLista(K.productos, d.productos || []);
            guardarLista(K.declaraciones, d.declaraciones || []);
            guardarConfig(d.config || {});
            localStorage.setItem(K.xml, d.xmlGenerados || 0);
            mostrarAviso('Respaldo cargado');
            setTimeout(function () { window.location.reload(); }, 800);
        } catch (e) {
            mostrarAviso('El archivo no es un respaldo válido');
        }
    };
    lector.readAsText(archivo);
}

function borrarDatos() {
    if (!confirm('Se borrarán todas las declaraciones, clientes y productos. Los usuarios se mantienen. ¿Continuar?')) return;
    localStorage.removeItem(K.declaraciones);
    localStorage.removeItem(K.clientes);
    localStorage.removeItem(K.productos);
    localStorage.removeItem(K.xml);
    mostrarAviso('Datos borrados');
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;

    var conf = leerConfig();
    document.getElementById('cfEmpresa').value = conf.empresa || '';
    document.getElementById('cfCodigo').value = conf.codigoDeclarante || '';
    document.getElementById('cfAduana').value = conf.aduanaDefecto || '';

    document.getElementById('btnGuardarConfig').onclick = guardarDatosDeclarante;
    document.getElementById('btnCrearUsuario').onclick = crearUsuario;
    document.getElementById('btnExportar').onclick = exportarRespaldo;
    document.getElementById('btnBorrarDatos').onclick = borrarDatos;

    var archivo = document.getElementById('archivoRespaldo');
    document.getElementById('btnImportar').onclick = function () { archivo.click(); };
    archivo.onchange = function () {
        if (archivo.files.length) importarRespaldo(archivo.files[0]);
    };

    mostrarUsuarios();
});
