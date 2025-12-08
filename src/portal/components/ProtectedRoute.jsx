import { Navigate } from 'react-router-dom';
import { usePortalAuth } from '../context/PortalAuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, clienteCorporativo, loading } = usePortalAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !clienteCorporativo) {
    return <Navigate to="/portal/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
