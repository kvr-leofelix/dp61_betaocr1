import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { SchoolsManagement } from './pages/admin/SchoolsManagement';
import { UsersManagement } from './pages/admin/UsersManagement';
import { AcademicConfig } from './pages/admin/AcademicConfig';
import { AuditLogs } from './pages/admin/AuditLogs';
import { PrincipalDashboard } from './pages/principal/PrincipalDashboard';
import { TeacherAssignments } from './pages/principal/TeacherAssignments';
import { CurriculumOversight } from './pages/principal/CurriculumOversight';
import { PrincipalReports } from './pages/principal/PrincipalReports';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { MyClasses } from './pages/teacher/MyClasses';
import { AssessmentBuilder } from './pages/teacher/AssessmentBuilder';
import { CurriculumPlanner180 } from './pages/teacher/CurriculumPlanner180';
import { ScanReview } from './pages/teacher/ScanReview';
import { RemediationManager } from './pages/teacher/RemediationManager';
import { TimeAwareEngine } from './pages/time-aware/TimeAwareEngine';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { ParentDashboard } from './pages/parent/ParentDashboard';
import { NotFoundPage } from './pages/shared/NotFoundPage';
import { UnauthorizedPage } from './pages/shared/UnauthorizedPage';
import { getDefaultDashboardPath } from './lib/permissions';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const DefaultRedirect: React.FC = () => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDefaultDashboardPath(currentUser.role)} replace />;
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DefaultRedirect />} />

      {/* Main Authenticated Layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/schools" element={<SchoolsManagement />} />
        <Route path="/admin/users" element={<UsersManagement />} />
        <Route path="/admin/academic-config" element={<AcademicConfig />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />

        {/* Principal Routes */}
        <Route path="/principal/dashboard" element={<PrincipalDashboard />} />
        <Route path="/principal/teachers" element={<TeacherAssignments />} />
        <Route path="/principal/curriculum" element={<CurriculumOversight />} />
        <Route path="/principal/reports" element={<PrincipalReports />} />

        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/classes" element={<MyClasses />} />
        <Route path="/teacher/assessments" element={<AssessmentBuilder />} />
        <Route path="/teacher/curriculum-180" element={<CurriculumPlanner180 />} />
        <Route path="/teacher/time-aware" element={<TimeAwareEngine />} />
        <Route path="/teacher/scan-review" element={<ScanReview />} />
        <Route path="/teacher/remediation" element={<RemediationManager />} />

        {/* Student Routes */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />

        {/* Parent Routes */}
        <Route path="/parent/dashboard" element={<ParentDashboard />} />

        {/* Error Pages */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

