import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = () => {
  const location = useLocation();
  const isPOS = location.pathname === '/pos';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className={`flex-1 overflow-y-auto bg-bg-beige ${isPOS ? '' : 'p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
