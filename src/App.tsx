import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ContractsPage from "./pages/Contracts";
import TransactionsPage from "./pages/Transactions";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import { NotificationProvider } from "./contexts/NotificationContext";
import AdminRoute from "./components/AdminRoute";
import AdminPage from "./pages/Admin";
import UsersPage from "./pages/admin/UsersPage";
import SettingsPage from "./pages/admin/SettingsPage";
import PendingDepositsPage from "./pages/admin/PendingDepositsPage";
import PendingWithdrawalsPage from "./pages/admin/PendingWithdrawalsPage";
import PendingRefundsPage from "./pages/admin/PendingRefundsPage";
import AdminContractsPage from "./pages/admin/Contracts";
import AdminUserContractsPage from "./pages/admin/AdminUserContractsPage";
import HowItWorksPage from "./pages/HowItWorks";
import ProfilePage from "./pages/Profile";
import Logout from "./pages/Logout";
import { ProfileCompletionGuard } from "./components/ProfileCompletionGuard";
import UpdatePassword from "./pages/UpdatePassword";
import Setup2FA from "./pages/Setup2FA";
import LoginAuditPage from "./pages/admin/LoginAuditPage";
import SupportPage from "./pages/SupportPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminKnowledgePage from "./pages/admin/AdminKnowledgePage";
import { ChatButton } from "./components/ChatButton";

import Terms from "./pages/Terms";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NotificationProvider>
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
              path="/admin/refunds"
              element={
                <AdminRoute>
                  <AppLayout>
                    <PendingRefundsPage />
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
        </NotificationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
