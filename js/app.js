// SmartCustoms NI - funciones generales
// Este archivo se carga en todas las paginas (despues de datos.js).
// Al final esta el DOMContentLoaded que decide que se ejecuta en cada pagina.

var CLAVE_EDITAR = 'smartcustoms_editar';   // marca para editar desde la busqueda

// ---------- menu lateral ----------

// arma el menu lateral segun el rol del usuario
function dibujarMenu() {
    var pagina = document.body.getAttribute('data-pagina');
    var enDecl = (pagina == 'nueva' || pagina == 'buscar');
    var ses = sesionActual();
    var rol = ses.rol;

    // devuelve el <li> solo si el rol puede entrar a esa pagina
    function item(clave, texto, enlace, ico) {
        if (!puedeVerPagina(clave, rol)) return '';
        return '<li class="' + (pagina == clave ? 'activo' : '') + '"><a href="' + enlace + '">' + icono(ico) + texto + '</a></li>';
    }

    var html = '';
    html += '<div class="logo"><img src="img/logo-recortado.png" alt="SmartCustoms NI"></div>';
    html += '<ul>';
    html += item('inicio', 'Dashboard', 'index.html', 'dashboard');
    html += item('clientes', 'Clientes', 'clientes.html', 'users');
    html += item('productos', 'Productos', 'productos.html', 'package');

    html += '<li class="' + (enDecl ? 'activo abierto' : '') + '" id="itemDeclaraciones">';
    html += '<span id="btnDecl">' + icono('file-text') + 'Declaraciones <b class="flecha">&#9660;</b></span>';
    html += '<ul id="submenuDeclaraciones" class="submenu' + (enDecl ? ' show' : '') + '">';
    html += item('nueva', 'Nueva Declaración', 'nueva_declaracion.html', 'plus');
    html += item('buscar', 'Buscar Declaración', 'buscar_declaracion.html', 'file-search');
    html += '</ul></li>';

    html += item('reportes', 'Reportes', 'reportes.html', 'chart');
    html += item('configuracion', 'Configuración', 'configuracion.html', 'settings');
    html += item('ayuda', 'Ayuda', 'ayuda.html', 'help');
    html += '</ul>';

    html += '<div class="usuario-box">';
    html += '<b>' + escaparHTML(ses.nombre) + '</b>';
    html += '<small>' + ses.rol + '</small>';
    html += '<button id="btnClave" class="btn-claro">' + icono('shield') + 'Cambiar contraseña</button>';
    html += '<button id="btnSalirMenu" class="btn-claro">' + icono('logout') + 'Cerrar sesión</button>';
    html += '</div>';

    $('menu').innerHTML = html;
    $('btnDecl').onclick = toggleMenu;
    $('btnClave').onclick = cambiarClave;
    $('btnSalirMenu').onclick = cerrarSesion;
}

// abre o cierra el submenu de declaraciones
function toggleMenu() {
    $('submenuDeclaraciones').classList.toggle('show');
}

// ---------- celular ----------

// abre (true) o cierra (false) el menu en pantallas chicas
function menuMovil(abrir) {
    $('menu').classList.toggle('abierta', abrir);
    $('fondoMenu').classList.toggle('visible', abrir);
}

// eventos del menu para celular: boton, fondo oscuro, escape y cambio de tamano
function prepararMovil() {
    var fondo = document.createElement('div');
    fondo.id = 'fondoMenu';
    fondo.className = 'fondo-menu';
    document.body.appendChild(fondo);

    fondo.onclick = function () { menuMovil(false); };
    $('btnMenu').onclick = function () {
        menuMovil(!$('menu').classList.contains('abierta'));
    };

    // al tocar un enlace del menu se cierra
    $('menu').addEventListener('click', function (e) {
        if (e.target.tagName == 'A') menuMovil(false);
    });

    // si giran el telefono o agrandan la ventana
    window.addEventListener('resize', function () {
        if (window.innerWidth > 800) menuMovil(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key == 'Escape') menuMovil(false);
    });
}

// pone data-label en cada celda para que la tabla se vea como fichas en el celular
function etiquetarTablas() {
    var tablas = document.querySelectorAll('table');
    for (var t = 0; t < tablas.length; t++) {
        var ths = tablas[t].querySelectorAll('th');
        if (ths.length == 0) continue;
        tablas[t].classList.add('apilar');

        var filas = tablas[t].querySelectorAll('tr');
        for (var f = 0; f < filas.length; f++) {
            var celdas = filas[f].querySelectorAll('td');
            for (var c = 0; c < celdas.length; c++) {
                if (ths[c] && !celdas[c].hasAttribute('colspan')) celdas[c].setAttribute('data-label', ths[c].textContent);
            }
        }
    }
}

// ---------- utilidades ----------

// mensajito que sale abajo a la derecha y se quita solo
function mostrarAviso(texto) {
    var aviso = $('aviso');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'aviso';
        aviso.className = 'aviso';
        document.body.appendChild(aviso);
    }
    aviso.textContent = texto;
    aviso.classList.add('ver-aviso');
    clearTimeout(aviso.temporizador);
    aviso.temporizador = setTimeout(function () {
        aviso.classList.remove('ver-aviso');
    }, 2800);
}

// trae las declaraciones guardadas, si algo falla devuelve lista vacia
function leerDeclaraciones() {
    return leerLista(K.declaraciones);
}

// guarda la lista completa en localStorage
function guardarDeclaraciones(lista) {
    return guardarLista(K.declaraciones, lista);
}

// busca una declaracion guardada por su id
function buscarRegistro(id) {
    return porId(leerDeclaraciones(), id) || null;
}

// fecha de hoy como dd/mm/yyyy
function fechaHoy() {
    return new Date().toLocaleDateString('en-GB');   // dd/mm/yyyy
}

// cambia & < > y comillas para que el texto no rompa el html
function escaparHTML(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// crea el archivo en memoria y lo baja con un link falso
function descargar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo || 'text/plain' });
    var enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

// devuelve el fondo oscuro de las ventanas (lo crea la primera vez)
function fondoModal() {
    var fondo = $('modalFondo');
    if (!fondo) {
        fondo = document.createElement('div');
        fondo.id = 'modalFondo';
        fondo.className = 'modal-fondo';
        // clic en la parte oscura la cierra
        fondo.onclick = function (e) { if (e.target == fondo) cerrarModal(); };
        document.body.appendChild(fondo);
    }
    return fondo;
}

// abre la ventana emergente con el html que le pasen
function abrirModal(html) {
    var fondo = fondoModal();
    fondo.innerHTML = html;
    fondo.classList.add('visible');
}

function cerrarModal() {
    fondoModal().classList.remove('visible');
}

// ventana de detalle: titulo y filas [etiqueta, valor]
function mostrarVentana(titulo, filas) {
    var html = '<div class="modal"><h2>' + escaparHTML(titulo) + '</h2><table>';
    filas.forEach(function (f) {
        html += '<tr><td>' + escaparHTML(f[0]) + '</td><td>' + escaparHTML(f[1] || '-') + '</td></tr>';
    });
    abrirModal(html + '</table><div class="botones"><button id="btnCerrarVentana">Cerrar</button></div></div>');
    $('btnCerrarVentana').onclick = cerrarModal;
}

// ventana para cambiar la contraseña del usuario que esta dentro
function cambiarClave() {
    abrirModal('<div class="modal"><h2>Cambiar contraseña</h2>' +
        '<label>Contraseña actual</label><input type="password" id="claveActual">' +
        '<label style="margin-top:10px">Contraseña nueva (mínimo 6 caracteres)</label><input type="password" id="claveNueva">' +
        '<label style="margin-top:10px">Repetir contraseña nueva</label><input type="password" id="claveRepetida">' +
        '<p id="errorClave" class="error-texto"></p>' +
        '<div class="botones"><button id="btnGuardarClave">Guardar</button>' +
        '<button class="volver" id="btnCancelarClave">Cancelar</button></div></div>');

    $('btnCancelarClave').onclick = cerrarModal;
    $('btnGuardarClave').onclick = function () {
        var actual = $('claveActual').value;
        var nueva = $('claveNueva').value;
        var error = $('errorClave');
        var lista = leerLista(K.usuarios);
        var u = porId(lista, sesionActual().id);

        if (!u || u.claveHash != hashClave(actual)) { error.textContent = 'La contraseña actual no es correcta'; return; }
        if (nueva.length < 6 || nueva.length > 64) { error.textContent = 'La contraseña debe tener entre 6 y 64 caracteres'; return; }
        if (nueva == actual) { error.textContent = 'La nueva contraseña debe ser distinta a la actual'; return; }
        if (nueva != $('claveRepetida').value) { error.textContent = 'Las contraseñas nuevas no coinciden'; return; }

        u.claveHash = hashClave(nueva);
        guardarLista(K.usuarios, lista);
        cerrarModal();
        mostrarAviso('Contraseña actualizada');
    };
}

// de dd/mm/yyyy a yyyy-mm-dd para poder comparar fechas
function convertirFecha(texto) {
    var p = texto.split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
}

// suma 1 al contador de recibos generados
function sumarRecibo() {
    localStorage.setItem(K.recibos, leerRecibos() + 1);
}

// ---------- al cargar la pagina ----------

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;   // ya lo mando al login

    var pagina = document.body.getAttribute('data-pagina');

    dibujarMenu();
    pintarIconos();    // iconos que estan escritos en el html como <i data-ico>
    prepararMovil();

    if (pagina == 'nueva') iniciarNueva();
    if (pagina == 'buscar') iniciarBusqueda();
    if (pagina == 'inicio') iniciarInicio();

    etiquetarTablas();
});
