// SmartCustoms NI - entrada al sistema
// Une login.js e inicio.js (pagina de login y dashboard).

// ============================================================
// 1. LOGIN (antes login.js)
// ============================================================

// se ejecuta al cargar login.html (igual que antes, sin esperar a DOMContentLoaded)
function iniciarLogin() {
    // si ya hay sesion no tiene sentido mostrar el login
    if (sesionActual()) {
        window.location.replace('index.html');
    }

    pintarIconos();   // los iconos que estan escritos en el html (<i data-ico>)

    // ojito: alterna entre ocultar y mostrar la contraseña
    $('verClave').addEventListener('click', function () {
        var campo = $('clave');
        campo.type = (campo.type == 'password') ? 'text' : 'password';
    });

    $('formLogin').addEventListener('submit', function (e) {
        e.preventDefault();   // para que el formulario no recargue la pagina

        var usuario = $('usuario').value.trim();
        var clave = $('clave').value;
        var error = $('errorLogin');

        if (usuario == '' || clave == '') {
            error.textContent = 'Escriba el usuario y la contraseña';
            return;
        }

        var mensaje = iniciarSesion(usuario, clave);
        if (mensaje != '') {
            error.textContent = mensaje;
            $('clave').value = '';   // se borra la clave por si se equivoco
            return;
        }
        window.location.href = 'index.html';
    });
}

if (document.body.getAttribute('data-pagina') == 'login') iniciarLogin();

// ============================================================
// 2. DASHBOARD (antes inicio.js)
// ============================================================

// cuenta desde 0 hasta el numero que tenga la tarjeta
function contarHasta(el) {
    var texto = el.textContent;
    var meta = parseFloat(texto);
    var sufijo = texto.indexOf('%') != -1 ? '%' : '';
    var duracion = 900;
    var inicio = null;

    if (isNaN(meta) || meta == 0) return;

    function paso(ahora) {
        if (inicio === null) inicio = ahora;
        var avance = Math.min((ahora - inicio) / duracion, 1);
        var suave = 1 - Math.pow(1 - avance, 3);   // empieza rapido y frena al final
        el.textContent = Math.round(meta * suave) + sufijo;
        if (avance < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

// anima los numeros de las tarjetas del dashboard
function animarContadores() {
    // si la persona tiene desactivadas las animaciones en su sistema, no se anima
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var tarjetas = document.querySelectorAll('.cards .card h2');
    for (var i = 0; i < tarjetas.length; i++) {
        contarHasta(tarjetas[i]);
    }
}

// llena los numeros y el saludo del dashboard
function iniciarInicio() {
    var ses = sesionActual();
    var lista = leerDeclaraciones();
    var hoy = fechaHoy();
    var deHoy = 0, aprobadas = 0;

    for (var i = 0; i < lista.length; i++) {
        if (lista[i].fecha == hoy) deHoy++;
        if (lista[i].estado == 'Aprobado') aprobadas++;
    }

    $('statHoy').textContent = deHoy;
    $('statRecibos').textContent = leerRecibos();
    $('statClientes').textContent = leerLista(K.clientes).length;
    $('statAprobadas').textContent =
        (lista.length == 0 ? 0 : Math.round(aprobadas * 100 / lista.length)) + '%';

    $('saludo').textContent = 'Bienvenido, ' + ses.nombre + ' (' + ses.rol + ')';
    $('btnSalir').onclick = cerrarSesion;

    var total = lista.length;
    $('resumenGuardadas').textContent = total == 0 ?
        'Todavía no hay declaraciones guardadas.' :
        'Hay ' + total + ' declaración(es) guardada(s) ' + (window.SC_DB && SC_DB.modo == 'servidor' ? 'en la base de datos.' : 'en este equipo.');

    if (window.location.search.indexOf('sinpermiso') != -1) {
        mostrarAviso('No tiene permiso para entrar a esa página');
    }

    // si el usuario sigue con la clave inicial del sistema, se le avisa
    var usuarios = leerLista(K.usuarios);
    for (var u = 0; u < usuarios.length; u++) {
        if (usuarios[u].id == ses.id && usuarios[u].claveHash == hashClave('admin123')) {
            $('alertaClave').style.display = 'block';
        }
    }

    animarContadores();
}
