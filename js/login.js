// SmartCustoms NI - pagina de login

if (sesionActual()) {
    window.location.replace('index.html');
}

document.getElementById('formLogin').addEventListener('submit', function (e) {
    e.preventDefault();

    var usuario = document.getElementById('usuario').value.trim();
    var clave = document.getElementById('clave').value;
    var error = document.getElementById('errorLogin');

    if (usuario == '' || clave == '') {
        error.textContent = 'Escriba el usuario y la contraseña';
        return;
    }

    var mensaje = iniciarSesion(usuario, clave);
    if (mensaje != '') {
        error.textContent = mensaje;
        document.getElementById('clave').value = '';
        return;
    }
    window.location.href = 'index.html';
});
