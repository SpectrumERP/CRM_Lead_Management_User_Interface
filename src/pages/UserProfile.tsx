import { useState, useRef, useEffect } from 'react';
import { ToastType } from '../components/Toast';
import FormDrawer from '../components/FormDrawer';
import { useAuth } from '../auth/AuthContext';
import type { AuthUser } from '../auth/types';
import { Button, Field as UiField, Select, Switch, TextField, TextInput } from '../ui';

interface Props {
  onToast: (type: ToastType, title: string, message?: string) => void;
  onNavigateNotifications: () => void;
}

// ── Seed user data ────────────────────────────────────────────────────────────
function profileFromUser(user: AuthUser | null) {
  const parts = (user?.name ?? 'User').split(' ')
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' ') || '',
    email: user?.email ?? '',
    mobile: '+91 98201 45678',
    jobTitle: user?.jobTitle ?? '',
    department: 'Sales & Business Development',
    role: `${user?.role ?? 'Sales Manager'}`,
    reportingManager: user?.role === 'Admin' ? 'Board' : 'Rajiv Anand (VP – Sales)',
    territory: 'West India – Maharashtra & Gujarat',
    employeeId: user?.id ?? '',
    language: 'English (India)',
    timezone: 'Asia/Kolkata (IST, UTC+5:30)',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12-hour (AM/PM)',
    status: 'Active' as const,
  }
}

const INITIAL_NOTIF_PREFS = {
  taskReminders: true,
  meetingReminders: true,
  followUpReminders: true,
  leadUpdates: true,
  systemNotifications: false,
};

// ── Shared atoms ──────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dce4f2', background: '#fff' }}>
      <div className="px-6 py-4" style={{ borderBottom: '1px solid #f0f4fb' }}>
        <h3 className="text-sm font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#7a8494' }}>{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <UiField label={label} layout="inline">
      {children}
    </UiField>
  );
}

function ReadValue({ value }: { value: string }) {
  return <p className="text-sm font-medium py-1.5" style={{ color: '#0c1a3a' }}>{value || '—'}</p>;
}

function FormInput({ value, onChange, type = 'text', placeholder, error }: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <TextInput type={type} value={value} onValueChange={onChange} placeholder={placeholder} invalid={Boolean(error)} />
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

function FormSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange} options={options} />
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="py-3 border-b border-line-subtle">
      <Switch checked={checked} onCheckedChange={onChange} label={label} description={description} />
    </div>
  );
}

// ── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.current) e.current = 'Current password is required';
    if (!form.newPwd) e.newPwd = 'New password is required';
    else if (form.newPwd.length < 8) e.newPwd = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(form.newPwd)) e.newPwd = 'Must contain at least one uppercase letter';
    else if (!/[0-9]/.test(form.newPwd)) e.newPwd = 'Must contain at least one number';
    if (!form.confirm) e.confirm = 'Please confirm your new password';
    else if (form.confirm !== form.newPwd) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => { setSaving(false); onSuccess(); }, 900);
  }

  const strength = (() => {
    const p = form.newPwd;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#c41e1e', '#f59e0b', '#2955a3', '#1a8040'][strength];

  return (
    <FormDrawer
      title="Change Password"
      subtitle="Choose a strong password for your account"
      onClose={onClose}
      widthClass="w-[26rem]"
      icon={
        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      }
      footer={(requestClose) => (
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Password'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <TextField
          label="Current Password"
          type="password"
          value={form.current}
          onValueChange={(v) => setForm((f) => ({ ...f, current: v }))}
          error={errors.current}
          autoComplete="current-password"
        />
        <TextField
          label="New Password"
          type="password"
          value={form.newPwd}
          onValueChange={(v) => setForm((f) => ({ ...f, newPwd: v }))}
          error={errors.newPwd}
          autoComplete="new-password"
        />

        {form.newPwd ? (
          <div className="-mt-2">
            <div className="mb-1 flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{ background: i <= strength ? strengthColor : '#edf1fa' }}
                />
              ))}
            </div>
            <p className="text-xs font-semibold" style={{ color: strengthColor }}>{strengthLabel}</p>
          </div>
        ) : null}

        <div className="rounded-lg border border-line bg-surface p-3">
          <p className="mb-2 text-xs font-semibold text-ink-soft">Password must contain:</p>
          {[
            ['At least 8 characters', form.newPwd.length >= 8],
            ['One uppercase letter', /[A-Z]/.test(form.newPwd)],
            ['One number', /[0-9]/.test(form.newPwd)],
            ['One special character (recommended)', /[^A-Za-z0-9]/.test(form.newPwd)],
          ].map(([label, met]) => (
            <div key={label as string} className="mt-1 flex items-center gap-1.5">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={met ? '#1a8040' : '#c8d4e8'} strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs" style={{ color: met ? '#1a8040' : '#9aaccc' }}>{label as string}</span>
            </div>
          ))}
        </div>

        <TextField
          label="Confirm New Password"
          type="password"
          value={form.confirm}
          onValueChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
          error={errors.confirm}
          autoComplete="new-password"
        />
      </div>
    </FormDrawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type Section = 'personal' | 'work' | 'photo' | 'preferences' | 'notifications';

export default function UserProfile({ onToast, onNavigateNotifications }: Props) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('personal');
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [draft, setDraft] = useState(() => profileFromUser(user));
  const [notifPrefs, setNotifPrefs] = useState(INITIAL_NOTIF_PREFS);
  const [draftNotif, setDraftNotif] = useState(INITIAL_NOTIF_PREFS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = profileFromUser(user)
    setProfile(next)
    setDraft(next)
  }, [user])

  const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'personal', label: 'Personal Information', icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'work', label: 'Work Information', icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
    { id: 'photo', label: 'Profile Photo', icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'preferences', label: 'Account Preferences', icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { id: 'notifications', label: 'Notification Preferences', icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
  ];

  function startEdit() {
    setDraft({ ...profile });
    setDraftNotif({ ...notifPrefs });
    setErrors({});
    setEditing(true);
  }

  function cancelEdit() {
    setDraft({ ...profile });
    setDraftNotif({ ...notifPrefs });
    setErrors({});
    setEditing(false);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!draft.firstName.trim()) e.firstName = 'First name is required';
    if (!draft.lastName.trim()) e.lastName = 'Last name is required';
    if (!draft.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) e.email = 'Enter a valid email address';
    if (!draft.mobile.trim()) e.mobile = 'Mobile number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      setProfile({ ...draft });
      setNotifPrefs({ ...draftNotif });
      setSaving(false);
      setEditing(false);
      onToast('success', 'Profile Updated', 'Your changes have been saved successfully.');
    }, 800);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    onToast('success', 'Photo Updated', 'Profile photo has been changed.');
  }

  function handlePhotoRemove() {
    setPhotoUrl(null);
    onToast('info', 'Photo Removed', 'Profile photo has been removed.');
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`;
  const fullName = `${profile.firstName} ${profile.lastName}`;

  // ── Sections content ────────────────────────────────────────────────────────
  function PersonalSection() {
    return (
      <SectionCard title="Personal Information" subtitle="Your basic personal and contact details">
        <Field label="First Name">
          {editing
            ? <FormInput value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} error={errors.firstName} />
            : <ReadValue value={profile.firstName} />}
        </Field>
        <Field label="Last Name">
          {editing
            ? <FormInput value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} error={errors.lastName} />
            : <ReadValue value={profile.lastName} />}
        </Field>
        <Field label="Email Address">
          {editing
            ? <FormInput value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} type="email" error={errors.email} />
            : <ReadValue value={profile.email} />}
        </Field>
        <Field label="Mobile Number">
          {editing
            ? <FormInput value={draft.mobile} onChange={(v) => setDraft({ ...draft, mobile: v })} error={errors.mobile} />
            : <ReadValue value={profile.mobile} />}
        </Field>
        <Field label="Job Title">
          {editing
            ? <FormInput value={draft.jobTitle} onChange={(v) => setDraft({ ...draft, jobTitle: v })} />
            : <ReadValue value={profile.jobTitle} />}
        </Field>
        <Field label="Department">
          {editing
            ? <FormSelect value={draft.department} onChange={(v) => setDraft({ ...draft, department: v })}
                options={['Sales & Business Development', 'Marketing', 'Operations', 'Finance', 'Human Resources', 'Technology']} />
            : <ReadValue value={profile.department} />}
        </Field>
        <div className="pt-2">
          <button
            onClick={() => setShowPwdModal(true)}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: '#2955a3', background: '#eef2fb', border: '1px solid #c7d6f0' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#dce9fb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#eef2fb')}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Change Password
          </button>
        </div>
      </SectionCard>
    );
  }

  function WorkSection() {
    return (
      <SectionCard title="Work Information" subtitle="Role, reporting structure and territory details">
        <Field label="Role">
          {editing
            ? <FormSelect value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })}
                options={['Sales Manager', 'Sales Executive', 'Solutions Engineer', 'Account Manager', 'Regional Head']} />
            : <ReadValue value={profile.role} />}
        </Field>
        <Field label="Reporting Manager">
          {editing
            ? <FormInput value={draft.reportingManager} onChange={(v) => setDraft({ ...draft, reportingManager: v })} />
            : <ReadValue value={profile.reportingManager} />}
        </Field>
        <Field label="Territory / Region">
          {editing
            ? <FormSelect value={draft.territory} onChange={(v) => setDraft({ ...draft, territory: v })}
                options={[
                  'West India – Maharashtra & Gujarat',
                  'North India – Delhi NCR & Punjab',
                  'South India – Karnataka & Tamil Nadu',
                  'East India – West Bengal & Odisha',
                  'Pan India',
                ]} />
            : <ReadValue value={profile.territory} />}
        </Field>
        <Field label="Employee ID">
          <ReadValue value={profile.employeeId} />
          {editing && <p className="text-xs mt-0.5" style={{ color: '#9aaccc' }}>Employee ID cannot be changed. Contact HR.</p>}
        </Field>
      </SectionCard>
    );
  }

  function PhotoSection() {
    return (
      <SectionCard title="Profile Photo" subtitle="A photo helps your team recognise you">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover" style={{ border: '3px solid #dce4f2' }} />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#2955a3,#c41e1e)', fontFamily: 'DM Sans, sans-serif' }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1" style={{ color: '#0c1a3a' }}>{fullName}</p>
            <p className="text-xs mb-4" style={{ color: '#7a8494' }}>
              Recommended: square image, at least 200×200 px, JPG or PNG, max 5 MB.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => photoRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#2955a3', color: '#fff', boxShadow: '0 2px 8px rgba(41,85,163,0.2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3f87')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2955a3')}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {photoUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              {photoUrl && (
                <button
                  onClick={handlePhotoRemove}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: '#fef2f2', color: '#c41e1e', border: '1px solid #fecaca' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fef2f2')}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Photo
                </button>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
        </div>
      </SectionCard>
    );
  }

  function PreferencesSection() {
    const d = editing ? draft : profile;
    return (
      <SectionCard title="Account Preferences" subtitle="Display and localisation settings">
        <Field label="Language">
          {editing
            ? <FormSelect value={draft.language} onChange={(v) => setDraft({ ...draft, language: v })}
                options={['English (India)', 'English (US)', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada']} />
            : <ReadValue value={d.language} />}
        </Field>
        <Field label="Time Zone">
          {editing
            ? <FormSelect value={draft.timezone} onChange={(v) => setDraft({ ...draft, timezone: v })}
                options={[
                  'Asia/Kolkata (IST, UTC+5:30)',
                  'Asia/Dubai (GST, UTC+4)',
                  'Asia/Singapore (SGT, UTC+8)',
                  'Europe/London (GMT, UTC+0)',
                  'America/New_York (EST, UTC-5)',
                ]} />
            : <ReadValue value={d.timezone} />}
        </Field>
        <Field label="Date Format">
          {editing
            ? <FormSelect value={draft.dateFormat} onChange={(v) => setDraft({ ...draft, dateFormat: v })}
                options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY']} />
            : <ReadValue value={d.dateFormat} />}
        </Field>
        <Field label="Time Format">
          {editing
            ? <FormSelect value={draft.timeFormat} onChange={(v) => setDraft({ ...draft, timeFormat: v })}
                options={['12-hour (AM/PM)', '24-hour']} />
            : <ReadValue value={d.timeFormat} />}
        </Field>
      </SectionCard>
    );
  }

  function NotificationsSection() {
    const prefs = editing ? draftNotif : notifPrefs;
    function toggle(key: keyof typeof INITIAL_NOTIF_PREFS) {
      if (editing) setDraftNotif((p) => ({ ...p, [key]: !p[key] }));
    }
    return (
      <SectionCard title="Notification Preferences" subtitle="Choose which alerts and reminders you receive">
        {!editing && (
          <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: '#f8faff', border: '1px solid #edf1fa' }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#9aaccc" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs" style={{ color: '#9aaccc' }}>Click "Edit Profile" to change your notification preferences.</p>
          </div>
        )}
        <Toggle label="Task Reminders" description="Receive alerts for tasks due today and overdue tasks"
          checked={prefs.taskReminders} onChange={() => toggle('taskReminders')} />
        <Toggle label="Meeting Reminders" description="Get notified before scheduled meetings start"
          checked={prefs.meetingReminders} onChange={() => toggle('meetingReminders')} />
        <Toggle label="Follow-up Reminders" description="Alerts when follow-up activities are due"
          checked={prefs.followUpReminders} onChange={() => toggle('followUpReminders')} />
        <Toggle label="Lead Updates" description="Notify me when a lead's stage or status changes"
          checked={prefs.leadUpdates} onChange={() => toggle('leadUpdates')} />
        <Toggle label="System Notifications" description="Platform announcements and maintenance alerts"
          checked={prefs.systemNotifications} onChange={() => toggle('systemNotifications')} />
        <div className="mt-4 pt-1">
          <button
            onClick={onNavigateNotifications}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: '#2955a3' }}
          >
            View all notifications →
          </button>
        </div>
      </SectionCard>
    );
  }

  const sectionContent: Record<Section, React.ReactNode> = {
    personal: <PersonalSection />,
    work: <WorkSection />,
    photo: <PhotoSection />,
    preferences: <PreferencesSection />,
    notifications: <NotificationsSection />,
  };

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col" style={{ background: '#f2f5fb' }}>
      {/* ── Profile hero ── */}
      <div className="page-gutter flex-shrink-0 py-6" style={{ background: '#fff', borderBottom: '1px solid #dce4f2' }}>
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover" style={{ border: '3px solid #dce4f2' }} />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#2955a3,#c41e1e)', fontFamily: 'DM Sans, sans-serif' }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>{fullName}</h1>
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: '#edfbf1', color: '#1a8040', border: '1px solid #bbf0cf' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1a8040' }} />
                {profile.status}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#4a5d82' }}>{profile.jobTitle} · {profile.department}</p>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#7a8494' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {profile.email}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#7a8494' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {profile.mobile}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#7a8494' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {profile.role} · {profile.employeeId}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={cancelEdit}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: '#f0f4fb', color: '#4a5d82' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#dce4f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f0f4fb')}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: saving ? '#7a9fd4' : '#2955a3', boxShadow: '0 2px 8px rgba(41,85,163,0.25)' }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#1e3f87'; }}
                  onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = saving ? '#7a9fd4' : '#2955a3'; }}>
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <button onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: '#2955a3', boxShadow: '0 2px 8px rgba(41,85,163,0.25)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3f87')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2955a3')}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left nav */}
        <aside
          className="flex w-56 flex-shrink-0 flex-col self-stretch py-5 px-3"
          style={{ background: '#fff', borderRight: '1px solid #dce4f2' }}
        >
          <p className="mb-3 px-3 text-xs font-bold tracking-widest" style={{ color: '#9aaccc', letterSpacing: '0.08em', fontSize: 10 }}>
            PROFILE SECTIONS
          </p>
          <nav className="min-h-0 flex-1 space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors"
                style={
                  activeSection === s.id
                    ? { background: '#eef2fb', color: '#2955a3' }
                    : { color: '#4a5d82' }
                }
                onMouseEnter={(e) => { if (activeSection !== s.id) e.currentTarget.style.background = '#f5f7fb'; }}
                onMouseLeave={(e) => { if (activeSection !== s.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: activeSection === s.id ? '#2955a3' : '#9aaccc' }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {editing && (
            <div className="mx-3 mt-4 rounded-lg p-3" style={{ background: '#fff8e1', border: '1px solid #fde68a' }}>
              <p className="text-xs font-semibold" style={{ color: '#b45309' }}>Editing mode</p>
              <p className="mt-0.5 text-xs" style={{ color: '#d97706' }}>
                Navigate sections and save when done.
              </p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="page-gutter min-h-0 flex-1 overflow-y-auto py-6">
          {sectionContent[activeSection]}
        </main>
      </div>

      {showPwdModal && (
        <ChangePasswordModal
          onClose={() => setShowPwdModal(false)}
          onSuccess={() => {
            setShowPwdModal(false);
            onToast('success', 'Password Changed', 'Your password has been updated successfully.');
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
