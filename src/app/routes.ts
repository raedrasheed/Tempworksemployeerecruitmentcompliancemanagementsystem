import { createBrowserRouter } from 'react-router';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { DriversList } from './pages/drivers/DriversList';
import { DriverProfile } from './pages/drivers/DriverProfile';
import { AddDriver } from './pages/drivers/AddDriver';
import { EditDriver } from './pages/drivers/EditDriver';
import { DriverCertifications } from './pages/drivers/DriverCertifications';
import { DriverTrainingHistory } from './pages/drivers/DriverTrainingHistory';
import { DriverComplianceTimeline } from './pages/drivers/DriverComplianceTimeline';
import { DriverPerformanceReview } from './pages/drivers/DriverPerformanceReview';
import { ApplicantsList } from './pages/applicants/ApplicantsList';
import { ApplicantProfile } from './pages/applicants/ApplicantProfile';
import { AddApplicant } from './pages/applicants/AddApplicant';
import { EditApplicant } from './pages/applicants/EditApplicant';
import { ApplicationsList } from './pages/applications/ApplicationsList';
import { ApplicationDetails } from './pages/applications/ApplicationDetails';
import { DriverApplicationForm } from './pages/applications/DriverApplicationForm';
import { DocumentsDashboard } from './pages/documents/DocumentsDashboard';
import { DocumentUpload } from './pages/documents/DocumentUpload';
import { DocumentPreview } from './pages/documents/DocumentPreview';
import { DocumentVerification } from './pages/documents/DocumentVerification';
import { DriverDocumentExplorer } from './pages/documents/DriverDocumentExplorer';
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
import { AgencyUsersManagement } from './pages/agencies/AgencyUsersManagement';
import { ComplianceDashboard } from './pages/compliance/ComplianceDashboard';
import { ComplianceAlerts } from './pages/compliance/ComplianceAlerts';
import { DriverCompliance } from './pages/compliance/DriverCompliance';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { NotificationCenter } from './pages/notifications/NotificationCenter';
import { UsersList } from './pages/users/UsersList';
import { AddUser } from './pages/users/AddUser';
import { EditUser } from './pages/users/EditUser';
import { RolesList } from './pages/roles/RolesList';
import { CreateRole } from './pages/roles/CreateRole';
import { PermissionsMatrix } from './pages/roles/PermissionsMatrix';
import { LogsDashboard } from './pages/logs/LogsDashboard';
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

// Public pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { PublicDriverApplication } from './pages/public/PublicDriverApplication';
import { ApplicationSuccess } from './pages/public/ApplicationSuccess';

export const router = createBrowserRouter([
  // Public routes (no MainLayout)
  { path: '/', Component: LandingPage },
  { path: '/login', Component: LoginPage },
  { path: '/apply', Component: PublicDriverApplication },
  { path: '/application-success', Component: ApplicationSuccess },
  
  // Protected routes (with MainLayout)
  {
    path: '/dashboard',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      
      // Employees routes (formerly Drivers)
      { path: 'employees', Component: DriversList },
      { path: 'employees/add', Component: AddDriver },
      { path: 'employees/:id', Component: DriverProfile },
      { path: 'employees/:id/edit', Component: EditDriver },
      { path: 'employees/:id/certifications', Component: DriverCertifications },
      { path: 'employees/:id/training', Component: DriverTrainingHistory },
      { path: 'employees/:id/compliance-timeline', Component: DriverComplianceTimeline },
      { path: 'employees/:id/performance', Component: DriverPerformanceReview },
      
      // Keep legacy driver routes for backward compatibility
      { path: 'drivers', Component: DriversList },
      { path: 'drivers/add', Component: AddDriver },
      { path: 'drivers/:id', Component: DriverProfile },
      { path: 'drivers/:id/edit', Component: EditDriver },
      { path: 'drivers/:id/certifications', Component: DriverCertifications },
      { path: 'drivers/:id/training', Component: DriverTrainingHistory },
      { path: 'drivers/:id/compliance-timeline', Component: DriverComplianceTimeline },
      { path: 'drivers/:id/performance', Component: DriverPerformanceReview },
      
      // Applicants routes
      { path: 'applicants', Component: ApplicantsList },
      { path: 'applicants/add', Component: AddApplicant },
      { path: 'applicants/:id', Component: ApplicantProfile },
      { path: 'applicants/:id/edit', Component: EditApplicant },
      
      // Applications routes
      { path: 'applications', Component: ApplicationsList },
      { path: 'applications/:id', Component: ApplicationDetails },
      { path: 'apply', Component: DriverApplicationForm },
      
      // Documents routes
      { path: 'documents', Component: DocumentsDashboard },
      { path: 'documents/upload', Component: DocumentUpload },
      { path: 'documents/:id', Component: DocumentPreview },
      { path: 'documents/:id/verify', Component: DocumentVerification },
      { path: 'document-explorer', Component: DriverDocumentExplorer },
      { path: 'documents-compliance', Component: DocumentsCompliance },
      
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
      { path: 'agencies/:id/users', Component: AgencyUsersManagement },
      
      // Compliance routes
      { path: 'compliance', Component: ComplianceDashboard },
      { path: 'compliance/alerts', Component: ComplianceAlerts },
      { path: 'compliance/drivers/:id', Component: DriverCompliance },
      
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
      
      // System Logs routes
      { path: 'logs', Component: LogsDashboard },
      
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
      
      // Profile routes
      { path: 'profile', Component: Profile },
      { path: 'profile/change-password', Component: ChangePassword },
      { path: 'change-password', Component: ChangePassword },
    ],
  },
]);