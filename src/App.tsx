import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Database } from './pages/Database';
import { Authentication } from './pages/Authentication';
import { Storage } from './pages/Storage';
import { Functions } from './pages/Functions';
import { Realtime } from './pages/Realtime';
import { Apis } from './pages/Apis';
import { Analytics } from './pages/Analytics';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { Members } from './pages/Members';
import { Billing } from './pages/Billing';
import { Documentation } from './pages/Documentation';
import { PlatformExpansion } from './pages/PlatformExpansion';
import { Projects } from './pages/Projects';
import { EnvironmentsReal } from './pages/EnvironmentsReal';
import { isRealMode } from './services/runtime';
import { BackupsPage } from './brisabase/pages/BackupsPage';
import { BillingPage as RealBillingPage } from './brisabase/pages/BillingPage';
import { EnterprisePage } from './brisabase/pages/EnterprisePage';
import { GraphqlPage } from './brisabase/pages/GraphqlPage';
import { HostingPage } from './brisabase/pages/HostingPage';
import { InfrastructurePage } from './brisabase/pages/InfrastructurePage';
import { MessagingPage } from './brisabase/pages/MessagingPage';
import { MonitoringPage } from './brisabase/pages/MonitoringPage';
import { ObservabilityPage } from './brisabase/pages/ObservabilityPage';
import { PreviewDatabasePage } from './brisabase/pages/PreviewDatabasePage';
import { SecurityPage } from './brisabase/pages/SecurityPage';
import { DeveloperPlatformPage } from './brisabase/pages/DeveloperPlatformPage';
import { DatabasePage as RealDatabasePage } from './brisabase/pages/DatabasePage';
import { DashboardPage as RealDashboardPage } from './brisabase/pages/DashboardPage';
import { DocumentationPage as RealDocumentationPage } from './brisabase/pages/DocumentationPage';
import { AuthPage as RealAuthPage } from './brisabase/pages/AuthPage';
import { StoragePage as RealStoragePage } from './brisabase/pages/StoragePage';
import { FunctionsPage as RealFunctionsPage } from './brisabase/pages/FunctionsPage';
import { RealtimePage as RealRealtimePage } from './brisabase/pages/RealtimePage';
import { ApisPage as RealApisPage } from './brisabase/pages/ApisPage';
import { LogsPage as RealLogsPage } from './brisabase/pages/LogsPage';
import { TeamPage as RealTeamPage } from './brisabase/pages/TeamPage';
import { AdvancedPlatformPage } from './brisabase/pages/AdvancedPlatformPage';

// Auth Pages
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { UserPasswordReset } from './pages/auth/UserPasswordReset';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/v1/password-reset" element={<UserPasswordReset />} />

          {/* SaaS App Protected Layout Routes */}
          <Route
            path="/"
            element={
              <AppLayout>
                {isRealMode ? <RealDashboardPage /> : <Dashboard />}
              </AppLayout>
            }
          />
          <Route
            path="/projects"
            element={
              <AppLayout>
                <Projects />
              </AppLayout>
            }
          />
          <Route
            path="/database/*"
            element={
              <AppLayout>
                {isRealMode ? <RealDatabasePage /> : <Database />}
              </AppLayout>
            }
          />
          <Route
            path="/auth"
            element={
              <AppLayout>
                {isRealMode ? <RealAuthPage /> : <Authentication />}
              </AppLayout>
            }
          />
          <Route
            path="/storage"
            element={
              <AppLayout>
                {isRealMode ? <RealStoragePage /> : <Storage />}
              </AppLayout>
            }
          />
          <Route
            path="/functions"
            element={
              <AppLayout>
                {isRealMode ? <RealFunctionsPage /> : <Functions />}
              </AppLayout>
            }
          />
          <Route
            path="/realtime"
            element={
              <AppLayout>
                {isRealMode ? <RealRealtimePage /> : <Realtime />}
              </AppLayout>
            }
          />
          <Route
            path="/apis"
            element={
              <AppLayout>
                {isRealMode ? <RealApisPage /> : <Apis />}
              </AppLayout>
            }
          />
          <Route
            path="/data-platform"
            element={
              <AppLayout>
                {isRealMode ? <Navigate to="/" replace /> : <PlatformExpansion module="data-platform" />}
              </AppLayout>
            }
          />
          <Route
            path="/security"
            element={
              <AppLayout>
                {isRealMode ? <SecurityPage /> : <PlatformExpansion module="security" />}
              </AppLayout>
            }
          />
          <Route
            path="/environments"
            element={
              <AppLayout>
                {isRealMode ? <EnvironmentsReal /> : <PlatformExpansion module="environments" />}
              </AppLayout>
            }
          />
          <Route
            path="/developer-tools"
            element={
              <AppLayout>
                {isRealMode ? <DeveloperPlatformPage /> : <PlatformExpansion module="developer-tools" />}
              </AppLayout>
            }
          />
          <Route
            path="/hosting"
            element={
              <AppLayout>
                {isRealMode ? <HostingPage /> : <PlatformExpansion module="hosting" />}
              </AppLayout>
            }
          />
          <Route
            path="/messaging"
            element={
              <AppLayout>
                {isRealMode ? <MessagingPage /> : <PlatformExpansion module="messaging" />}
              </AppLayout>
            }
          />
          <Route
            path="/experiments"
            element={
              <AppLayout>
                {isRealMode ? <AdvancedPlatformPage module="experiments" /> : <PlatformExpansion module="experiments" />}
              </AppLayout>
            }
          />
          <Route
            path="/app-quality"
            element={
              <AppLayout>
                {isRealMode ? <AdvancedPlatformPage module="app-quality" /> : <PlatformExpansion module="app-quality" />}
              </AppLayout>
            }
          />
          <Route
            path="/search-ai"
            element={
              <AppLayout>
                {isRealMode ? <AdvancedPlatformPage module="search-ai" /> : <PlatformExpansion module="search-ai" />}
              </AppLayout>
            }
          />
          <Route
            path="/enterprise"
            element={
              <AppLayout>
                {isRealMode ? <EnterprisePage /> : <PlatformExpansion module="enterprise" />}
              </AppLayout>
            }
          />

          <Route
            path="/usage"
            element={
              <AppLayout>
                {isRealMode ? <Navigate to="/" replace /> : <PlatformExpansion module="usage" />}
              </AppLayout>
            }
          />

          <Route
            path="/graphql"
            element={
              <AppLayout>
                {isRealMode ? <GraphqlPage /> : <PlatformExpansion module="data-platform" />}
              </AppLayout>
            }
          />
          <Route
            path="/backups"
            element={
              <AppLayout>
                <BackupsPage />
              </AppLayout>
            }
          />
          <Route
            path="/previews"
            element={
              <AppLayout>
                {isRealMode ? <PreviewDatabasePage /> : <PlatformExpansion module="environments" />}
              </AppLayout>
            }
          />
          <Route
            path="/observability"
            element={
              <AppLayout>
                {isRealMode ? <ObservabilityPage /> : <Analytics />}
              </AppLayout>
            }
          />
          <Route
            path="/infrastructure"
            element={
              <AppLayout>
                {isRealMode ? <InfrastructurePage /> : <PlatformExpansion module="hosting" />}
              </AppLayout>
            }
          />

          <Route
            path="/analytics"
            element={
              <AppLayout>
                {isRealMode ? <AdvancedPlatformPage module="analytics" /> : <Analytics />}
              </AppLayout>
            }
          />
          <Route
            path="/logs"
            element={
              <AppLayout>
                {isRealMode ? <RealLogsPage /> : <Logs />}
              </AppLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <AppLayout>
                <Settings />
              </AppLayout>
            }
          />
          <Route
            path="/members"
            element={
              <AppLayout>
                {isRealMode ? <RealTeamPage /> : <Members />}
              </AppLayout>
            }
          />
          <Route
            path="/billing"
            element={
              <AppLayout>
                {isRealMode ? <RealBillingPage /> : <Billing />}
              </AppLayout>
            }
          />
          <Route
            path="/docs"
            element={
              <AppLayout>
                {isRealMode ? <RealDocumentationPage /> : <Documentation />}
              </AppLayout>
            }
          />

          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
