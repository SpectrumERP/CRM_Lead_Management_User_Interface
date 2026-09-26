import ActivityDrawer from './ActivityDrawer';
import MeetingDrawer from './MeetingDrawer';
import NoteDrawer from './NoteDrawer';
import DocumentDrawer from './DocumentDrawer';
import OverlayShell from './OverlayShell';
import CreateLead from '../pages/CreateLead';
import CreateOpportunity from '../pages/CreateOpportunity';
import CreateBusinessEntity from '../pages/CreateBusinessEntity';
import CreateContact from '../pages/CreateContact';
import { useQuickCreate } from '../contexts/QuickCreateContext';
import { useCrmActions } from '../contexts/CrmStoreContext';
import type { ToastType } from './Toast';

export default function QuickCreateHost({ onToast }: { onToast: (type: ToastType, title: string, message?: string) => void }) {
  const { activeKind, close, prefill, page } = useQuickCreate();
  const store = useCrmActions();

  if (!activeKind) return null;

  const leadPrefill = prefill.leadId
    ? { id: prefill.leadId, name: prefill.leadName ?? '', contact: prefill.contactName ?? '' }
    : null;
  const entityPrefill = prefill.entityId
    ? { id: prefill.entityId, name: prefill.entityName ?? '' }
    : null;

  if (activeKind === 'activity') {
    return (
      <ActivityDrawer
        preselectedLead={leadPrefill}
        onClose={close}
        onSave={(a) => {
          store.addActivity(a);
          onToast('success', 'Activity Logged', `"${a.subject}" has been added.`);
        }}
      />
    );
  }

  if (activeKind === 'meeting') {
    return (
      <MeetingDrawer
        preselectedLead={leadPrefill}
        onClose={close}
        onSave={(m) => {
          store.addMeeting(m);
          onToast('success', 'Meeting Scheduled', `"${m.subject}" has been added.`);
        }}
      />
    );
  }

  if (activeKind === 'note') {
    return (
      <NoteDrawer
        preselectedLead={prefill.leadId ? { id: prefill.leadId, name: prefill.leadName ?? '' } : null}
        onClose={close}
        onSave={(note) => {
          store.addNote(note);
          onToast('success', 'Note Added', `"${note.title}" saved on ${note.relatedLeadName}.`);
        }}
      />
    );
  }

  if (activeKind === 'document') {
    const preferEntity = page === 'business-entity-detail';
    return (
      <DocumentDrawer
        preselectedLead={!preferEntity && prefill.leadId ? { id: prefill.leadId, name: prefill.leadName ?? '' } : null}
        preselectedEntity={preferEntity || !prefill.leadId ? entityPrefill : null}
        onClose={close}
        onSave={(doc) => {
          store.addDocument(doc);
          onToast('success', 'Document Uploaded', `"${doc.name}" has been attached.`);
        }}
      />
    );
  }

  if (activeKind === 'lead') {
    return (
      <OverlayShell title="New Lead" subtitle="Create without leaving this page" onClose={close}>
        {(requestClose) => (
          <CreateLead
            embedded
            prefillEntityId={prefill.entityId}
            prefillContactId={prefill.contactId}
            onBack={requestClose}
            onSuccess={() => {
              onToast('success', 'Lead Created', 'New lead has been added to the pipeline.');
              requestClose();
            }}
          />
        )}
      </OverlayShell>
    );
  }

  if (activeKind === 'opportunity') {
    return (
      <OverlayShell title="Create Opportunity" subtitle="Create without leaving this page" onClose={close}>
        {(requestClose) => (
          <CreateOpportunity
            embedded
            onBack={requestClose}
            onSuccess={() => {
              onToast('success', 'Opportunity Created', 'New opportunity has been added.');
              requestClose();
            }}
          />
        )}
      </OverlayShell>
    );
  }

  if (activeKind === 'entity') {
    return (
      <OverlayShell title="New Business Entity" subtitle="Create without leaving this page" onClose={close}>
        {(requestClose) => (
          <CreateBusinessEntity
            embedded
            onBack={requestClose}
            onSuccess={() => {
              onToast('success', 'Business Entity Created', 'New entity has been saved successfully.');
              requestClose();
            }}
          />
        )}
      </OverlayShell>
    );
  }

  return (
    <OverlayShell title="New Contact" subtitle="Create without leaving this page" onClose={close}>
      {(requestClose) => (
        <CreateContact
          embedded
          prefillEntityId={prefill.entityId}
          onBack={requestClose}
          onSuccess={() => {
            onToast('success', 'Contact Created', 'New contact has been saved successfully.');
            requestClose();
          }}
        />
      )}
    </OverlayShell>
  );
}
