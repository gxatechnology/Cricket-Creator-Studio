import React, { Suspense, lazy } from 'react';
import { RouterProvider, useRouter } from './router/RouterContext';
import { AuthProvider } from './auth/AuthContext';
import { StudioProvider, useStudio } from './context/StudioContext';
import { HomePage } from './pages/HomePage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NewProjectWizardModal } from './components/NewProjectWizardModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AccountModal } from './components/AccountModal';

// Route-level code splitting: keep the heavy video production engine
// and WebCodecs render workers isolated from public homepage
const StudioWorkspaceShell = lazy(() => import('./components/StudioWorkspaceShell'));

function StudioLoadingScreen() {
  return (
    <div className="h-screen w-screen bg-[#080E1A] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] animate-pulse">
        <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="text-sm font-display font-semibold text-slate-200">
        Loading Cricket Creator Studio...
      </div>
      <div className="text-xs text-slate-500 font-mono">
        Initializing audio synthesis & WebCodecs pipeline
      </div>
    </div>
  );
}

function MainAppRoutes() {
  const { currentPath, navigate } = useRouter();
  const { accountModalOpen, setAccountModalOpen } = useStudio();

  // If user navigates to /settings, open the Account Settings modal
  React.useEffect(() => {
    if (currentPath === '/settings') {
      setAccountModalOpen(true);
    }
  }, [currentPath, setAccountModalOpen]);

  const handleCloseAccountModal = () => {
    setAccountModalOpen(false);
    if (currentPath === '/settings') {
      navigate('/dashboard');
    }
  };

  return (
    <>
      {currentPath === '/' && <HomePage />}
      {(currentPath === '/dashboard' || currentPath === '/settings') && <CreatorDashboardPage />}
      {(currentPath === '/login' || currentPath === '/get-started') && <LoginPage />}
      {currentPath.startsWith('/studio') && (
        <Suspense fallback={<StudioLoadingScreen />}>
          <StudioWorkspaceShell />
        </Suspense>
      )}

      {/* Global Modals accessible across all routes */}
      <NewProjectWizardModal />
      <CommandPaletteModal />
      <AccountModal
        isOpen={accountModalOpen}
        onClose={handleCloseAccountModal}
      />
    </>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <StudioProvider>
          <MainAppRoutes />
        </StudioProvider>
      </AuthProvider>
    </RouterProvider>
  );
}
