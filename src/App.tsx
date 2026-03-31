import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Loader2 } from "lucide-react";
import { isRecoveryFlow, clearNavigationState } from "@/services/navigationService";
import { useNavigationState } from "@/hooks/useNavigationState";
import { getMaintenanceMode } from "@/services/maintenanceService";
import { supabase } from "@/integrations/supabase/client";

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Terms = lazy(() => import("./pages/Terms"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorks"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContractsPage = lazy(() => import("./pages/Contracts"));
const TransactionsPage = lazy(() => import("./pages/Transactions"));
const NotFound = lazy(() => import("./pages/NotFound"));
import ProtectedRoute from "./components/ProtectedRoute";
import { NotificationProvider } from "./contexts/NotificationContext";
import AdminRoute from "./components/AdminRoute";
const AdminPage = lazy(() => import("./pages/Admin"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const PendingDepositsPage = lazy(() => import("./pages/admin/PendingDepositsPage"));
const PendingWithdrawalsPage = lazy(() => import("./pages/admin/PendingWithdrawalsPage"));

const AdminContractsPage = lazy(() => import("./pages/admin/Contracts"));
const AdminUserContractsPage = lazy(() => import("./pages/admin/AdminUserContractsPage"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const Logout = lazy(() => import("./pages/Logout"));
import { ProfileCompletionGuard } from "./components/ProfileCompletionGuard";
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Setup2FA = lazy(() => import("./pages/Setup2FA"));
const LoginAuditPage = lazy(() => import("./pages/admin/LoginAuditPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminKnowledgePage = lazy(() => import("./pages/admin/AdminKnowledgePage"));
const AdminTransactionsPage = lazy(() => import("./pages/admin/AdminTransactionsPage"));
const AccountingPage = lazy(() => import("./pages/admin/accounting/AccountingPage"));
const PaymentSchedulerPage = lazy(() => import("./pages/admin/accounting/PaymentSchedulerPage"));
const LedgerPage = lazy(() => import("./pages/admin/accounting/LedgerPage"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings").then(module => ({ default: module.NotificationSettings }))); // Corrected import
const MaintenancePage = lazy(() => import("./pages/Maintenance").then(module => ({ default: module.MaintenancePage }))); // Import MaintenancePage
import { ChatButton } from "./components/ChatButton";
import InstallPWA from "./components/InstallPWA";

const queryClient = new QueryClient();

// MaintenanceGuard component to protect routes
const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const [isMaintenance, setIsMaintenance] = React.useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false); // Default to false

  React.useEffect(() => {
    const checkStatus = async () => {
      // Fetch maintenance status
      const maintenanceStatus = await getMaintenanceMode();
      setIsMaintenance(maintenanceStatus);
      console.log("MaintenanceGuard: Maintenance mode status fetched:", maintenanceStatus);

      // Fetch user role only if maintenance mode is active
      if (maintenanceStatus) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error("MaintenanceGuard: Error fetching user role:", error);
            setIsAdmin(false); // Assume not admin if error fetching role
          } else {
            const isAdminUser = roleData?.role === 'admin';
            setIsAdmin(isAdminUser);
            console.log("MaintenanceGuard: Admin check:", isAdminUser, "for user ID:", user.id);
          }
        } else {
          setIsAdmin(false); // No user logged in, so not an admin
          console.log("MaintenanceGuard: No user logged in, assuming not admin.");
        }
      } else {
        setIsAdmin(false); // If maintenance is off, admin status doesn't matter for redirect logic
        console.log("MaintenanceGuard: Maintenance mode is off, admin check skipped.");
      }
    };
    checkStatus();
  }, []);

  // Show loader while checking status
  if (isMaintenance === null) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to maintenance page if maintenance is ON and user is NOT admin
  if (isMaintenance && !isAdmin) {
    console.log("MaintenanceGuard: Redirecting to MaintenancePage.");
    return <MaintenancePage />;
  }

  // Otherwise, render the children (the application)
  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <ProfileCompletionGuard>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
        <ChatButton />
      </div>
    </ProfileCompletionGuard>
  </SidebarProvider>
);

/**
 * AppInitializer - Initialize application state and handle navigation redirects
 * 
 * This component:
 * 1. Forces application to start on index ("/") on initial mount/refresh
 * 2. Skips redirect for password recovery flows
 * 3. Clears saved navigation state on app initialization
 */
const AppInitializer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasInitializedRef = React.useRef(false);
  const { clearState } = useNavigationState();

  React.useEffect(() => {
    // Only run once on initial mount
    if (hasInitializedRef.current) return;
    
    const hash = window.location.hash;
    // Clear any saved navigation state on fresh app load
    clearState();

    // Redirect to index if there's a hash but it's not the root and it's not a known route
    // We keep this light to avoid breaking legitimate navigations
    if (hash && hash !== '#/' && hash !== '#') {
      const knownRoutes = ['/auth', '/dashboard', '/contracts', '/transactions', '/profile', '/admin', '/terms', '/how-it-works'];
      const currentPath = hash.replace('#', '').split('?')[0];
      
      if (!knownRoutes.some(route => currentPath === route || currentPath.startsWith(route + '/'))) {
        console.log("AppInitializer: Redirecting unknown hash to index:", hash);
        navigate('/', { replace: true });
      }
    }

    hasInitializedRef.current = true;
  }, [navigate, location.pathname, clearState]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <AppInitializer />
        <InstallPWA />
        <NotificationProvider>
          <Suspense fallback={
            <div className="flex items-center justify-center h-screen w-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <MaintenanceGuard> {/* MaintenanceGuard now wraps all routes */}
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/setup-2fa" element={<ProtectedRoute><Setup2FA /></ProtectedRoute>} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Dashboard />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contracts"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <ContractsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <TransactionsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <ProfilePage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/notifications" // New route for notification settings
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <NotificationSettings />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <UsersPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <SettingsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/deposits"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <PendingDepositsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/withdrawals"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <PendingWithdrawalsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/contracts"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminContractsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/user-contracts"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminUserContractsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/login-audit"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <LoginAuditPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/support"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminSupportPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/knowledge"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminKnowledgePage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/transactions"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminTransactionsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/accounting"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AccountingPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/accounting/scheduler"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <PaymentSchedulerPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/accounting/ledger"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <LedgerPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/support"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <SupportPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="/logout" element={<Logout />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceGuard>
          </Suspense>
        </NotificationProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;