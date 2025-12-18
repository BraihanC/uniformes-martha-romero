import { useState } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';

const CambiarContrasena = () => {
  const { currentUser } = usePortalAuth();
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const validarContrasena = (password) => {
    const errores = [];

    if (password.length < 6) {
      errores.push('La contraseña debe tener al menos 6 caracteres');
    }

    return errores;
  };

  const handleCambiarContrasena = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });

    // Validaciones
    if (!contrasenaActual || !contrasenaNueva || !confirmarContrasena) {
      setMensaje({ tipo: 'error', texto: 'Todos los campos son obligatorios' });
      return;
    }

    if (contrasenaNueva !== confirmarContrasena) {
      setMensaje({ tipo: 'error', texto: 'Las contraseñas nuevas no coinciden' });
      return;
    }

    if (contrasenaNueva === contrasenaActual) {
      setMensaje({ tipo: 'error', texto: 'La nueva contraseña debe ser diferente a la actual' });
      return;
    }

    const erroresValidacion = validarContrasena(contrasenaNueva);
    if (erroresValidacion.length > 0) {
      setMensaje({ tipo: 'error', texto: erroresValidacion[0] });
      return;
    }

    setLoading(true);

    try {
      // Reautenticar al usuario con su contraseña actual
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        contrasenaActual
      );

      await reauthenticateWithCredential(currentUser, credential);

      // Cambiar la contraseña
      await updatePassword(currentUser, contrasenaNueva);

      setMensaje({
        tipo: 'success',
        texto: '¡Contraseña actualizada exitosamente!'
      });

      // Limpiar formulario
      setContrasenaActual('');
      setContrasenaNueva('');
      setConfirmarContrasena('');

    } catch (error) {
      console.error('Error al cambiar contraseña:', error);

      let errorMessage = 'Error al cambiar la contraseña';

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'La contraseña actual es incorrecta';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es muy débil. Debe tener al menos 6 caracteres';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Por seguridad, debes cerrar sesión y volver a iniciar antes de cambiar tu contraseña';
      }

      setMensaje({ tipo: 'error', texto: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full" style={{ backgroundColor: '#FDE7F0' }}>
            <Shield size={24} style={{ color: '#D50565' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cambiar Contraseña</h1>
            <p className="text-sm text-gray-600">Actualiza tu contraseña de acceso al portal</p>
          </div>
        </div>

        {/* Mensaje de alerta */}
        {mensaje.texto && (
          <div
            className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
              mensaje.tipo === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {mensaje.tipo === 'success' ? (
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        )}

        {/* Información de seguridad */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Lock size={16} />
            Requisitos de seguridad
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 ml-6">
            <li className="list-disc">La contraseña debe tener al menos 6 caracteres</li>
            <li className="list-disc">Debe ser diferente a tu contraseña actual</li>
            <li className="list-disc">Se recomienda usar una combinación de letras y números</li>
          </ul>
        </div>

        {/* Formulario */}
        <form onSubmit={handleCambiarContrasena} className="space-y-5">
          {/* Contraseña Actual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña Actual *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type={showActual ? 'text' : 'password'}
                value={contrasenaActual}
                onChange={(e) => setContrasenaActual(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Ingresa tu contraseña actual"
              />
              <button
                type="button"
                onClick={() => setShowActual(!showActual)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showActual ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Contraseña Nueva */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type={showNueva ? 'text' : 'password'}
                value={contrasenaNueva}
                onChange={(e) => setContrasenaNueva(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Ingresa tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowNueva(!showNueva)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showNueva ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirmar Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Nueva Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Confirma tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirmar(!showConfirmar)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setContrasenaActual('');
                setContrasenaNueva('');
                setConfirmarContrasena('');
                setMensaje({ tipo: '', texto: '' });
              }}
              className="w-full sm:flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:flex-1 px-6 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D50565' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Actualizando...
                </span>
              ) : (
                'Actualizar Contraseña'
              )}
            </button>
          </div>
        </form>

        {/* Información adicional */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Si tienes problemas para cambiar tu contraseña o has olvidado tu contraseña actual,
              contacta al administrador del sistema.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CambiarContrasena;
