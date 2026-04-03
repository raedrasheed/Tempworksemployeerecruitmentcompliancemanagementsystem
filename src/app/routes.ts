import { createBrowserRouter } from 'react-router';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { EmployeesList } from './pages/employees/EmployeesList';
import { EmployeeProfile } from './pages/employees/EmployeeProfile';
import { AddEmployee } from './pages/employees/AddEmployee';
import { EditEmployee } from './pages/employees/EditEmployee';
import { EmployeeCertifications } from './pages/employees/EmployeeCertifications';
import { EmployeeTrainingHistory } from './pages/employees/EmployeeTrainingHistory';
import { EmployeeComplianceTimeline } from './pages/employees/EmployeeComplianceTimeline';
import { EmployeePerformanceReview } from './pages/employees/EmployeePerformanceReview';
import { ApplicantsList } from './pages/applicants/ApplicantsList';
import { ApplicantProfile } from './pages/applicants/ApplicantProfile';
import { AddApplicant } from './pages/applicants/AddApplicant';
import { EditApplicant } from './pages/applicants/EditApplicant';

import { DocumentsDashboard } from './pages/documents/DocumentsDashboard';
import { DocumentUpload } from './pages/documents/DocumentUpload';
import { DocumentPreview } from './pages/documents/DocumentPreview';
import { EditDocument } from './pages/documents/EditDocument';
import { DocumentVerification } from './pages/documents/DocumentVerification';
import { EmployeeDocumentExplorer } from './pages/documents/EmployeeDocumentExplorer';
import { DocumentsCompliance } from './pages/documents/DocumentsCompliance';
import { WorkflowOverview } from './pages/workflow/WorkflowOverview';
import { WorkPermitTracking } from './pages/workflow/WorkPermitTracking';
import { VisaTracking } from './pages/workflow/VisaTracking';
import { WorkflowStageDetail } from './pages/workflow/WorkflowStageDetail';
import { WorkflowTimeline } from './pages/workflow/WorkflowTimeline';
import { WorkflowAnalytics } from './pages/workflow/WorkflowAnalytics';
import { WorkflowManagement } from './pages/workflow/WorkflowManagement';
import { StageDetails } from './pages/workflow/StageDetails';
import { AgenciesList } from './pages/agencies/AgenciesList';
import { AgencyProfile } from './pages/agencies/AgencyProfile';
import { AddAgency } from './pages/agencies/AddAgency';
import { EditAgency } from './pages/agencies/EditAgency';
import { AgencyUsersManagement } from './pages/agencies/AgencyUsersManagement';
import { ComplianceDashboard } from './pages/compliance/ComplianceDashboard';
import { ComplianceAlerts } from './pages/compliance/ComplianceAlerts';
import { EmployeeCompliance } from './pages/compliance/EmployeeCompliance';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { NotificationCenter } from './pages/notifications/NotificationCenter';
import { UsersList } from './pages/users/UsersList';
import { AddUser } from './pages/users/AddUser';
import { EditUser } from './pages/users/EditUser';
import { RolesList } from './pages/roles/RolesList';
import { CreateRole } from './pages/roles/CreateRole';
import { PermissionsMatrix } from './pages/roles/PermissionsMatrix';
import { LogsDashboard } from './pages/logs/LogsDashboard';
import { FinanceDashboard } from './pages/finance/FinanceDashboard';
import { Settings } from './pages/settings/Settings';
import { ColorScheme } from './pages/settings/ColorScheme';
import { WorkflowSettings } from './pages/settings/WorkflowSettings';
import { WorkflowConfiguration } from './pages/settings/WorkflowConfiguration';
import { DocumentTypes } from './pages/settings/DocumentTypes';
import { DocumentTypeNew } from './pages/settings/DocumentTypeNew';
import { DocumentTypeView } from './pages/settings/DocumentTypeView';
import { DocumentTypeEdit } from './pages/settings/DocumentTypeEdit';
import { NotificationRules } from './pages/settings/NotificationRules';
import { SecuritySettings } from './pages/settings/SecuritySettings';
import { JobTypes } from './pages/settings/JobTypes';

// Profile pages
import { Profile } from './pages/profile/Profile';
import { ChangePassword } from './pages/profile/ChangePassword';

// Job Ads dashboard pages
import { JobAdsList } from './pages/job-ads/JobAdsList';
import { JobAdForm } from './pages/job-ads/JobAdForm';
import { DeletedRecords } from './pages/recycle-bin/DeletedRecords';
import { DatabaseCleanup } from './pages/settings/DatabaseCleanup';

// Pipeline pages
import { WorkflowsPage } from './pages/pipelines/WorkflowsPage';
import { WorkflowBoardPage } from './pages/pipelines/WorkflowBoardPage';
import { WorkflowSettingsPage } from './pages/pipelines/WorkflowSettingsPage';

// Public pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { PublicEmployeeApplication } from './pages/public/PublicEmployeeApplication';
import { ApplicationSuccess } from './pages/public/ApplicationSuccess';
import { JobListings } from './pages/public/JobListings';
import { JobDetail } from './pages/public/JobDetail';

// Attendance pages
import { AttendanceList } from './pages/attendance/AttendanceList';
import { AttendanceSheet } from './pages/attendance/AttendanceSheet';

export const router = createBrowserRouter([
  // Public routes (no MainLayout)
  { path: '/', Component: LandingPage },
  { path: '/login', Component: LoginPage },
  { path: '/apply', Component: PublicEmployeeApplication },
  { path: '/application-success', Component: ApplicationSuccess },
  { path: '/jobs', Component: JobListings },
  { path: '/jobs/:slug', Component: JobDetail },
  
  // Protected routes (with MainLayout)
  {
    path: '/dashboard',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      
      // Employees routes
      { path: 'employees', Component: EmployeesList },
      { path: 'employees/add', Component: AddEmployee },
      { path: 'employees/:id', Component: EmployeeProfile },
      { path: 'employees/:id/edit', Component: EditEmployee },
      { path: 'employees/:id/certifications', Component: EmployeeCertifications },
      { path: 'employees/:id/training', Component: EmployeeTrainingHistory },
      { path: 'employees/:id/compliance-timeline', Component: EmployeeComplianceTimeline },
      { path: 'employees/:id/performance', Component: EmployeePerformanceReview },
      
      // Applicants routes
      { path: 'applicants', Component: ApplicantsList },
      { path: 'applicants/add', Component: AddApplicant },
      { path: 'applicants/:id', Component: ApplicantProfile },
      { path: 'applicants/:id/edit', Component: EditApplicant },
      
      // Documents routes
      { path: 'documents', Component: DocumentsDashboard },
      { path: 'documents/upload', Component: DocumentUpload },
      { path: 'documents/:id/edit', Component: EditDocument },
      { path: 'documents/:id', Component: DocumentPreview },
      { path: 'documents/:id/verify', Component: DocumentVerification },
      { path: 'document-explorer', Component: EmployeeDocumentExplorer },
      { path: 'documents-compliance', Component: DocumentsCompliance },
      
      // Workflow (recruitment pipeline) routes
      { path: 'workflows', Component: WorkflowsPage },
      { path: 'workflows/:id', Component: WorkflowBoardPage },
      { path: 'settings/workflows/:id', Component: WorkflowSettingsPage },

      // Workflow routes
      { path: 'workflow', Component: WorkflowOverview },
      { path: 'workflow/work-permits', Component: WorkPermitTracking },
      { path: 'workflow/visas', Component: VisaTracking },
      { path: 'workflow/stage/:stageId', Component: StageDetails },
      { path: 'workflow/timeline', Component: WorkflowTimeline },
      { path: 'workflow/analytics', Component: WorkflowAnalytics },
      { path: 'workflow-management', Component: WorkflowManagement },
      
      // Agencies routes
      { path: 'agencies', Component: AgenciesList },
      { path: 'agencies/add', Component: AddAgency },
      { path: 'agencies/:id', Component: AgencyProfile },
      { path: 'agencies/:id/edit', Component: EditAgency },
      { path: 'agencies/:id/users', Component: AgencyUsersManagement },
      
      // Compliance routes
      { path: 'compliance', Component: ComplianceDashboard },
      { path: 'compliance/alerts', Component: ComplianceAlerts },
      { path: 'compliance/employees/:id', Component: EmployeeCompliance },
      
      // Reports routes
      { path: 'reports', Component: ReportsDashboard },
      
      // Notifications routes
      { path: 'notifications', Component: NotificationCenter },
      
      // Users routes
      { path: 'users', Component: UsersList },
      { path: 'users/add', Component: AddUser },
      { path: 'users/:id/edit', Component: EditUser },
      
      // Roles & Permissions routes
      { path: 'roles', Component: RolesList },
      { path: 'roles/create', Component: CreateRole },
      { path: 'roles/:id/edit', Component: CreateRole },
      { path: 'roles/permissions-matrix', Component: PermissionsMatrix },
      
      // Attendance routes
      { path: 'attendance', Component: AttendanceList },
      { path: 'attendance/:id', Component: AttendanceSheet },

      // Finance routes
      { path: 'finance', Component: FinanceDashboard },

      // Job Ads routes
      { path: 'job-ads', Component: JobAdsList },
      { path: 'job-ads/new', Component: JobAdForm },
      { path: 'job-ads/:id/edit', Component: JobAdForm },

      // System Logs routes
      { path: 'logs', Component: LogsDashboard },

      // Recycle Bin
      { path: 'recycle-bin', Component: DeletedRecords },

      // Settings routes
      { path: 'settings', Component: Settings },
      { path: 'settings/job-types', Component: JobTypes },
      { path: 'settings/workflow', Component: WorkflowSettings },
      { path: 'settings/workflow-configuration', Component: WorkflowConfiguration },
      { path: 'settings/document-types', Component: DocumentTypes },
      { path: 'settings/document-types/new', Component: DocumentTypeNew },
      { path: 'settings/document-types/:id', Component: DocumentTypeView },
      { path: 'settings/document-types/:id/edit', Component: DocumentTypeEdit },
      { path: 'settings/notifications', Component: NotificationRules },
      { path: 'settings/security', Component: SecuritySettings },
      { path: 'settings/color-scheme', Component: ColorScheme },
      { path: 'settings/database-cleanup', Component: DatabaseCleanup },

      // Profile routes
      { path: 'profile', Component: Profile },
      { path: 'profile/change-password', Component: ChangePassword },
      { path: 'change-password', Component: ChangePassword },
    ],
  },
]);