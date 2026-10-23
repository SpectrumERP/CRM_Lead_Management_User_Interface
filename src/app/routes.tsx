import { lazy, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCrmSelector } from '../contexts/CrmStoreContext'
import { useToast } from '../contexts/ToastContext'
import AppShell from './AppShell'
import { AdminGuard, AuthGuard } from './guards'
import { paths } from './paths'
import { isLeadLocked, leadLockedReason } from '../data/leads'
import { FORM_NO } from '../api/formRights'
import { useFormRights } from '../contexts/FormRightsContext'

const Dashboard = lazy(() => import('../pages/Dashboard'))
const LeadsList = lazy(() => import('../pages/LeadsList'))
const OpportunitiesList = lazy(() => import('../pages/OpportunitiesList'))
const OpportunityDetail = lazy(() => import('../pages/OpportunityDetail'))
const EditOpportunity = lazy(() => import('../pages/EditOpportunity'))
const CreateOpportunity = lazy(() => import('../pages/CreateOpportunity'))
const CreateLead = lazy(() => import('../pages/CreateLead'))
const LeadDetail = lazy(() => import('../pages/LeadDetail'))
const ActivitiesPage = lazy(() => import('../pages/Activities'))
const MeetingsPage = lazy(() => import('../pages/Meetings'))
const BusinessEntitiesList = lazy(() => import('../pages/BusinessEntitiesList'))
const CreateBusinessEntity = lazy(() => import('../pages/CreateBusinessEntity'))
const ContactsList = lazy(() => import('../pages/ContactsList'))
const CreateContact = lazy(() => import('../pages/CreateContact'))
const ContactDetail = lazy(() => import('../pages/ContactDetail'))
const SearchResults = lazy(() => import('../pages/SearchResults'))
const Settings = lazy(() => import('../pages/Settings'))
const Notifications = lazy(() => import('../pages/Notifications'))
const AuditLog = lazy(() => import('../pages/AuditLog'))
const Login = lazy(() => import('../pages/Login'))
const Forbidden = lazy(() => import('../pages/Forbidden'))

function DashboardPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <Dashboard
      onOpenLead={(id) => navigate(paths.lead(id))}
      onOpenOpportunity={(id) => navigate(paths.opportunity(id))}
      onLeadStage={(stage) => navigate(`${paths.leads}?${new URLSearchParams({ stage, status: 'Open' })}`)}
      onOpportunityStage={(stage) => navigate(`${paths.opportunities}?${new URLSearchParams({ stage })}`)}
      onToast={addToast}
    />
  )
}

/** Business entity screens need the Open right on form 1550 (see formRights.ts). */
function EntityRightsGate({ children }: { children: ReactNode }) {
  const rights = useFormRights(FORM_NO.businessEntity)
  if (rights.ready && !rights.isOpen) return <Navigate to={paths.forbidden} replace />
  return children
}

function EntitiesListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <EntityRightsGate>
      <BusinessEntitiesList
        onCreate={() => navigate(paths.entityNew)}
        onEdit={(no) => navigate(paths.entityEdit(String(no)))}
        onToast={addToast}
      />
    </EntityRightsGate>
  )
}

function CreateEntityPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <EntityRightsGate>
      <CreateBusinessEntity
        onBack={() => navigate(paths.entities)}
        onSuccess={() => {
          navigate(paths.entities)
          addToast('success', 'Data saved successfully.')
        }}
        onToast={addToast}
      />
    </EntityRightsGate>
  )
}

function EditEntityPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const businessEntityNo = Number(id)
  if (!Number.isInteger(businessEntityNo) || businessEntityNo < 1) return <Navigate to={paths.entities} replace />
  return (
    <EntityRightsGate>
      <CreateBusinessEntity
        key={businessEntityNo}
        businessEntityNo={businessEntityNo}
        onBack={() => navigate(paths.entities)}
        onSuccess={() => {
          navigate(paths.entities)
          addToast('success', 'Data saved successfully.')
        }}
        onToast={addToast}
      />
    </EntityRightsGate>
  )
}

/** Entities open straight in their form (as in Task Management); old detail links land there. */
function EntityDetailRedirect() {
  const { id = '' } = useParams()
  return <Navigate to={paths.entityEdit(id)} replace />
}

function ContactsListPage() {
  const navigate = useNavigate()
  return (
    <ContactsList
      onCreate={() => navigate(paths.contactNew)}
      onView={(id) => navigate(paths.contact(id))}
      onEdit={(id) => navigate(paths.contactEdit(id))}
    />
  )
}

function CreateContactPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <CreateContact
      onBack={() => navigate(paths.contacts)}
      onSuccess={() => {
        navigate(paths.contacts)
        addToast('success', 'Contact Created', 'New contact has been saved successfully.')
      }}
    />
  )
}

function EditContactPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const existing = useCrmSelector((state) => state.contacts.find((contact) => contact.id === id) ?? null)
  return (
    <CreateContact
      existing={existing}
      onBack={() => navigate(paths.contact(id))}
      onSuccess={() => {
        navigate(paths.contact(id))
        addToast('success', 'Contact Updated', 'Changes saved successfully.')
      }}
    />
  )
}

function ContactDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <ContactDetail
      contactId={id}
      onBack={() => navigate(paths.contacts)}
      onEdit={(contactId) => navigate(paths.contactEdit(contactId))}
      onViewLead={(leadId) => navigate(paths.lead(leadId))}
      onToast={addToast}
    />
  )
}

function LeadsListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <LeadsList
      onCreateLead={() => navigate(paths.leadNew)}
      onViewLead={(id) => navigate(paths.lead(id))}
      onEditLead={(id) => navigate(paths.leadEdit(id))}
      onToast={addToast}
    />
  )
}

function CreateLeadPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <CreateLead
      onBack={() => navigate(paths.leads)}
      onSuccess={() => {
        navigate(paths.leads)
        addToast('success', 'Lead Created', 'New lead has been added to the pipeline.')
      }}
    />
  )
}

function EditLeadPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const existing = useCrmSelector((state) => state.leads.find((lead) => lead.id === id) ?? null)
  // A converted / completed-stage lead is read-only: an old edit link goes back to its view page.
  const locked = existing ? isLeadLocked(existing) : false
  const reason = existing && locked ? leadLockedReason(existing) : ''
  useEffect(() => {
    if (reason) addToast('info', 'Lead Locked', `${reason}.`)
  }, [reason, addToast])
  if (!existing) return <Navigate to={paths.leads} replace />
  if (locked) return <Navigate to={paths.lead(id)} replace />
  return (
    <CreateLead
      existing={existing}
      onBack={() => navigate(paths.lead(id))}
      onSuccess={() => {
        navigate(paths.lead(id))
        addToast('success', 'Lead Updated', 'Changes saved successfully.')
      }}
    />
  )
}

function LeadDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <LeadDetail
      leadId={id}
      onBack={() => navigate(paths.leads)}
      onEdit={() => navigate(paths.leadEdit(id))}
      onToast={addToast}
      onViewEntity={(entityId) => navigate(paths.entity(entityId))}
      onViewContact={(contactId) => navigate(paths.contact(contactId))}
      onViewOpportunity={(opportunityId) => navigate(paths.opportunity(opportunityId))}
    />
  )
}

function OpportunitiesListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <OpportunitiesList
      onView={(id) => navigate(paths.opportunity(id))}
      onEdit={(id) => navigate(paths.opportunityEdit(id))}
      onCreate={() => navigate(paths.opportunityNew)}
      onToast={addToast}
    />
  )
}

function CreateOpportunityPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <CreateOpportunity
      onBack={() => navigate(paths.opportunities)}
      onSuccess={(id) => {
        navigate(paths.opportunity(id))
        addToast('success', 'Opportunity Created', 'Opportunity saved successfully.')
      }}
    />
  )
}

function OpportunityDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <OpportunityDetail
      opportunityId={id}
      onBack={() => navigate(paths.opportunities)}
      onEdit={(opportunityId) => navigate(paths.opportunityEdit(opportunityId))}
      onViewLead={(leadId) => navigate(paths.lead(leadId))}
      onToast={addToast}
    />
  )
}

function EditOpportunityPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const existing = useCrmSelector((state) => state.opportunities.find((item) => item.id === id) ?? null)
  if (!existing) return <Navigate to={paths.opportunities} replace />
  return (
    <EditOpportunity
      existing={existing}
      onBack={() => navigate(paths.opportunity(id))}
      onSuccess={() => {
        navigate(paths.opportunity(id))
        addToast('success', 'Opportunity Updated', 'Changes saved successfully.')
      }}
    />
  )
}

function ActivitiesListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <ActivitiesPage
      onViewLead={(id) => navigate(paths.lead(id))}
      onToast={addToast}
    />
  )
}

function MeetingsListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  return (
    <MeetingsPage
      onViewLead={(id) => navigate(paths.lead(id))}
      onToast={addToast}
    />
  )
}

function SearchPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  return (
    <SearchResults
      query={query}
      onViewLead={(id) => navigate(paths.lead(id))}
      onViewContact={(id) => navigate(paths.contact(id))}
      onViewEntity={(id) => navigate(paths.entity(id))}
      onViewActivity={() => navigate(paths.activities)}
      onViewMeeting={() => navigate(paths.meetings)}
      onNewSearch={(q) => setParams({ q })}
    />
  )
}

function SettingsPage() {
  const { addToast } = useToast()
  return <Settings onToast={addToast} />
}

function AuditLogPage() {
  const navigate = useNavigate()
  return (
    <AuditLog
      onViewLead={(id) => navigate(paths.lead(id))}
      onViewContact={(id) => navigate(paths.contact(id))}
      onViewEntity={(id) => navigate(paths.entity(id))}
      onViewActivity={() => navigate(paths.activities)}
      onViewMeeting={() => navigate(paths.meetings)}
      onViewOpportunity={(id) => navigate(paths.opportunity(id))}
    />
  )
}

function NotificationsPage() {
  const navigate = useNavigate()
  return (
    <Notifications
      onNavigateLead={(id) => navigate(paths.lead(id))}
      onNavigateActivity={() => navigate(paths.activities)}
      onNavigateMeeting={() => navigate(paths.meetings)}
    />
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="entities" element={<EntitiesListPage />} />
          <Route path="entities/new" element={<CreateEntityPage />} />
          <Route path="entities/:id" element={<EntityDetailRedirect />} />
          <Route path="entities/:id/edit" element={<EditEntityPage />} />
          <Route path="contacts" element={<ContactsListPage />} />
          <Route path="contacts/new" element={<CreateContactPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="contacts/:id/edit" element={<EditContactPage />} />
          <Route path="leads" element={<LeadsListPage />} />
          <Route path="leads/new" element={<CreateLeadPage />} />
          <Route path="leads/:id/edit" element={<EditLeadPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="opportunities" element={<OpportunitiesListPage />} />
          <Route path="opportunities/new" element={<CreateOpportunityPage />} />
          <Route path="opportunities/:id/edit" element={<EditOpportunityPage />} />
          <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
          <Route path="activities" element={<ActivitiesListPage />} />
          <Route path="meetings" element={<MeetingsListPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          {/* The profile page is not available: an old link or typed address lands on the dashboard. */}
          <Route path="profile" element={<Navigate to={paths.dashboard} replace />} />
          <Route path="forbidden" element={<Forbidden />} />
          <Route element={<AdminGuard />}>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to={paths.leads} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
