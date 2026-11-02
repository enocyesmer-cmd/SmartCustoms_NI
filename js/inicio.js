// SmartCustoms NI - dashboard

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
    $('statXml').textContent = parseInt(localStorage.getItem(K.xml)) || 0;
    $('statClientes').textContent = leerLista(K.clientes).length;
    $('statAprobadas').textContent =
        (lista.length == 0 ? 0 : Math.round(aprobadas * 100 / lista.length)) + '%';

    $('saludo').textContent = 'Bienvenido, ' + ses.nombre + ' (' + ses.rol + ')';
    $('btnSalir').onclick = cerrarSesion;

    var total = lista.length;
    $('resumenGuardadas').textContent = total == 0 ?
        'Todavía no hay declaraciones guardadas.' :
        'Hay ' + total + ' declaración(es) guardada(s) en este equipo.';

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
