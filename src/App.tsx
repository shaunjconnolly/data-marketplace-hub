import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Listings from "./pages/Listings.tsx";
import ListingNew from "./pages/ListingNew.tsx";
import ListingEdit from "./pages/ListingEdit.tsx";
import Marketplace from "./pages/Marketplace.tsx";
import ListingDetail from "./pages/ListingDetail.tsx";
import Requests from "./pages/Requests.tsx";
import Purchases from "./pages/Purchases.tsx";
import Notifications from "./pages/Notifications.tsx";
import Settings from "./pages/Settings.tsx";
import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminWaitlist from "./pages/admin/AdminWaitlist.tsx";
import AdminListings from "./pages/admin/AdminListings.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminPages from "./pages/admin/AdminPages.tsx";
import AdminRequests from "./pages/admin/AdminRequests.tsx";
import AdminMonitoring from "./pages/admin/AdminMonitoring.tsx";
import AdminAnonymisation from "./pages/admin/AdminAnonymisation.tsx";
import AdminGdpr from "./pages/admin/AdminGdpr.tsx";
import AdminPayouts from "./pages/admin/AdminPayouts.tsx";
import AdminSql from "./pages/admin/AdminSql.tsx";
import AnonymisationJob from "./pages/AnonymisationJob.tsx";
import Payouts from "./pages/Payouts.tsx";
import Setup from "./pages/Setup.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public marketplace */}
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:id" element={<ListingDetail />} />

            {/* Onboarding: requires auth but NOT onboarding-complete */}
            <Route element={<ProtectedRoute requireOnboarded={false} />}>
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>

            {/* Dashboard area: requires auth + onboarding */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/listings" element={<Listings />} />
                <Route path="/dashboard/listings/new" element={<ListingNew />} />
                <Route
                  path="/dashboard/listings/:id/edit"
                  element={<ListingEdit />}
                />
                <Route path="/dashboard/requests" element={<Requests />} />
                <Route path="/dashboard/purchases" element={<Purchases />} />
                <Route path="/dashboard/payouts" element={<Payouts />} />
                <Route
                  path="/dashboard/notifications"
                  element={<Notifications />}
                />
                <Route path="/dashboard/settings" element={<Settings />} />
                <Route path="/dashboard/anonymisation/:jobId" element={<AnonymisationJob />} />
              </Route>
            </Route>

            {/* Admin console */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/waitlist" element={<AdminWaitlist />} />
                <Route path="/admin/listings" element={<AdminListings />} />
                <Route path="/admin/requests" element={<AdminRequests />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/monitoring" element={<AdminMonitoring />} />
                <Route path="/admin/anonymisation" element={<AdminAnonymisation />} />
                <Route path="/admin/gdpr" element={<AdminGdpr />} />
                <Route path="/admin/payouts" element={<AdminPayouts />} />
                <Route path="/admin/sql" element={<AdminSql />} />
                <Route path="/admin/pages" element={<AdminPages />} />
              </Route>
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <CookieConsentBanner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
