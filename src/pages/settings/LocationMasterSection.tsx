import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../api/errors';
import {
  clearBusinessEntityFillValuesCache,
  getBusinessEntityFillValues,
  type CountryOption,
} from '../../api/businessEntityFillValues';
import { fetchCitiesByState, fetchStatesByCountry, type CityOption, type StateOption } from '../../api/geo';
import {
  LOCATION_MASTER_LIMITS,
  locationMasterErrors,
  type LocationMasterApi,
  type LocationMasterRow,
} from '../../api/locationMasters';
import ConfirmDialog from '../../components/ConfirmDialog';
import { FilterSearch } from '../../components/InlineFilterRow';
import Pagination from '../../components/Pagination';
import type { ToastType } from '../../components/Toast';
import { saveConfirm, useConfirm } from '../../contexts/ConfirmContext';
import { Checkbox, IconTooltip, SearchSelectField, Spinner, TextField } from '../../ui';
import { formatDate } from '../../utils/dateFormat';
import { C, EmptyRows, MasterTable, Modal, SectionHeader, Td, Th } from './atoms';
import type { LocationMasterState } from './useLocationMaster';

const PAGE_SIZE = 25;

interface Props {
  api: LocationMasterApi;
  state: LocationMasterState;
  title: string;
  subtitle: string;
  namePlaceholder: string;
  rights: { canAdd: boolean; canEdit: boolean; canDelete: boolean };
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

interface FormState {
  name: string;
  alias: string;
  gstStateCode: string;
  isUnionTerritory: boolean;
  countryNo: number | null;
  stateNo: number | null;
  cityNo: number | null;
}

const EMPTY_FORM: FormState = { name: '', alias: '', gstStateCode: '', isUnionTerritory: false, countryNo: null, stateNo: null, cityNo: null };

function ActionButton({ label, tone, onClick, d }: { label: string; tone: 'edit' | 'delete'; onClick: () => void; d: string }) {
  const hover = tone === 'edit' ? { color: C.blue, bg: C.blueBg } : { color: C.red, bg: '#fdf0f0' };
  return (
    <IconTooltip label={label}>
      <button type="button" onClick={onClick} aria-label={label}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#94a3b8' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = hover.color; e.currentTarget.style.background = hover.bg; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}>
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
      </button>
    </IconTooltip>
  );
}

const EDIT_ICON = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
const DELETE_ICON = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

/** State, City and Port masters: list + add / edit drawer with the country → state → city cascade. */
export default function LocationMasterSection({ api, state, title, subtitle, namePlaceholder, rights, onToast }: Props) {
  const confirm = useConfirm();
  const kind = api.kind;
  const noun = api.label;
  const { rows, loading, error, reload, companyNo } = state;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [editing, setEditing] = useState<LocationMasterRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LocationMasterRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Countries come with the business entity fill values (one cached call per head office).
  useEffect(() => {
    if (!companyNo) return;
    let cancelled = false;
    getBusinessEntityFillValues(companyNo)
      .then((fill) => { if (!cancelled) setCountries(fill.countries); })
      .catch((err) => { if (!cancelled) onToast?.('error', 'Could not load countries', toApiError(err).message); });
    return () => { cancelled = true; };
  }, [companyNo, onToast]);

  const countryName = useMemo(() => new Map(countries.map((c) => [c.countryNo, c.countryName])), [countries]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = query
      ? rows.filter((r) => [r.name, r.code, r.alias, r.countryName || countryName.get(r.countryNo ?? 0), r.stateName, r.cityName]
          .some((v) => v?.toLowerCase().includes(query)))
      : rows;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, query, countryName]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query]);

  async function loadStates(countryNo: number | null) {
    setStates([]);
    if (!countryNo) return;
    try {
      setStates(await fetchStatesByCountry(countryNo));
    } catch (err) {
      onToast?.('error', 'Could not load states', toApiError(err).message);
    }
  }

  async function loadCities(stateNo: number | null) {
    setCities([]);
    if (!stateNo || kind !== 'port') return;
    try {
      setCities(await fetchCitiesByState(stateNo));
    } catch (err) {
      onToast?.('error', 'Could not load cities', toApiError(err).message);
    }
  }

  function openAdd() {
    setIsNew(true); setEditing(null); setForm(EMPTY_FORM); setErrors({}); setStates([]); setCities([]);
  }

  async function openEdit(row: LocationMasterRow) {
    setIsNew(false); setEditing(row); setErrors({});
    setForm({ name: row.name, alias: row.alias, gstStateCode: row.gstStateCode, isUnionTerritory: row.isUnionTerritory,
      countryNo: row.countryNo, stateNo: row.stateNo, cityNo: row.cityNo });
    if (!companyNo) return;
    // Search rows can leave out parents (a city's country) — load-data has them all.
    setLoadingDetail(true);
    try {
      const detail = await api.load(row.no, companyNo);
      setForm({ name: detail.name || row.name, alias: detail.alias, gstStateCode: detail.gstStateCode, isUnionTerritory: detail.isUnionTerritory,
        countryNo: detail.countryNo, stateNo: detail.stateNo, cityNo: detail.cityNo });
      await Promise.all([kind !== 'state' ? loadStates(detail.countryNo) : null, loadCities(detail.stateNo)]);
    } catch (err) {
      onToast?.('error', `Could not load ${noun.toLowerCase()}`, toApiError(err).message);
      setEditing(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); setLoadingDetail(false); }

  function patch(next: Partial<FormState>, clear: string[]) {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((prev) => {
      const copy = { ...prev };
      for (const key of clear) delete copy[key];
      return copy;
    });
  }

  function changeCountry(country: CountryOption | null) {
    const countryNo = country?.countryNo ?? null;
    patch({ countryNo, stateNo: null, cityNo: null }, ['countryNo', 'stateNo', 'cityNo']);
    setCities([]);
    if (kind !== 'state') void loadStates(countryNo);
  }

  function changeState(option: StateOption | null) {
    const stateNo = option?.stateNo ?? null;
    patch({ stateNo, cityNo: null }, ['stateNo', 'cityNo']);
    void loadCities(stateNo);
  }

  function validate() {
    const e = locationMasterErrors(kind, { ...form, no: editing?.no });
    const name = form.name.trim().toLowerCase();
    // Same name under the same parent is a duplicate (cities repeat across states).
    const parent = (r: LocationMasterRow) => (kind === 'city' ? r.stateNo === form.stateNo : kind === 'state' ? r.countryNo === form.countryNo : true);
    if (!e.name && rows.some((r) => r.no !== editing?.no && r.name.toLowerCase() === name && parent(r))) {
      e.name = `This ${noun.toLowerCase()} already exists`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!companyNo || !validate()) return;
    if (!(await confirm(saveConfirm(noun, !isNew)))) return;
    setSaving(true);
    try {
      await api.save({ ...form, no: editing?.no ?? null }, companyNo);
      clearBusinessEntityFillValuesCache();
      onToast?.('success', isNew ? `${noun} Added` : `${noun} Updated`, `"${form.name.trim()}" saved successfully.`);
      closeModal();
      await reload();
    } catch (err) {
      onToast?.('error', `Could not save ${noun.toLowerCase()}`, toApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: LocationMasterRow) {
    if (!companyNo) return;
    setDeleting(true);
    try {
      await api.remove(row.no, companyNo);
      clearBusinessEntityFillValuesCache();
      onToast?.('info', `${noun} Deleted`, `"${row.name}" has been deleted.`);
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      onToast?.('error', `Could not delete ${noun.toLowerCase()}`, toApiError(err).message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const selectedCountry = countries.find((c) => c.countryNo === form.countryNo) ?? null;
  const selectedState = states.find((s) => s.stateNo === form.stateNo) ?? null;
  const selectedCity = cities.find((c) => c.cityNo === form.cityNo) ?? null;
  const countryOf = (r: LocationMasterRow) => r.countryName || countryName.get(r.countryNo ?? 0) || '';

  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} count={rows.length} onAdd={rights.canAdd ? openAdd : undefined} />
      <div className="mb-4 w-full min-w-0">
        <FilterSearch value={search} onChange={setSearch} placeholder={`Search ${title.toLowerCase()}…`} />
      </div>

      {error ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" role="alert"
          style={{ background: '#fdf0f0', border: '1px solid #f5c2c2', color: C.red }}>
          <span>Could not load {title.toLowerCase()}: {error.message}</span>
          <button type="button" onClick={() => void reload()} className="font-bold underline">Retry</button>
        </div>
      ) : null}

      <MasterTable>
        <thead><tr>
          <Th narrow>Code</Th><Th>Name</Th>
          {kind === 'port' ? <Th narrow>Alias</Th> : null}
          {kind === 'state' ? <Th narrow>GST Code</Th> : null}
          {kind === 'port' ? <Th>City</Th> : null}
          {kind !== 'state' ? <Th>State</Th> : null}
          <Th>Country</Th>
          <Th>Created</Th><Th right narrow>Actions</Th>
        </tr></thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={99} className="py-16"><div className="flex justify-center"><Spinner label={`Loading ${title}`} /></div></td></tr>
          ) : pageRows.length === 0 ? (
            error ? null : <EmptyRows onAdd={rights.canAdd && !query ? openAdd : undefined} />
          ) : pageRows.map((row) => (
            <tr key={row.no}>
              <Td narrow><span className="font-mono text-xs" style={{ color: C.sub }}>{row.code || ''}</span></Td>
              <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{row.name}</span></Td>
              {kind === 'port' ? <Td narrow><span className="text-xs" style={{ color: C.sub }}>{row.alias || ''}</span></Td> : null}
              {kind === 'state' ? (
                <Td narrow>
                  <span className="text-xs" style={{ color: C.sub }}>{row.gstStateCode || ''}{row.isUnionTerritory ? ' · UT' : ''}</span>
                </Td>
              ) : null}
              {kind === 'port' ? <Td><span className="text-xs" style={{ color: C.sub }}>{row.cityName || ''}</span></Td> : null}
              {kind !== 'state' ? <Td><span className="text-xs" style={{ color: C.sub }}>{row.stateName || ''}</span></Td> : null}
              <Td><span className="text-xs" style={{ color: C.sub }}>{countryOf(row)}</span></Td>
              <Td>
                <span className="text-xs" style={{ color: '#94a3b8' }}>
                  {formatDate(row.createdDate, '')}{row.createdBy ? ` · ${row.createdBy}` : ''}
                </span>
              </Td>
              <Td right narrow>
                <div className="flex items-center gap-1 justify-end">
                  {rights.canEdit ? <ActionButton label="Edit" tone="edit" d={EDIT_ICON} onClick={() => void openEdit(row)} /> : null}
                  {rights.canDelete ? <ActionButton label="Delete" tone="delete" d={DELETE_ICON} onClick={() => setConfirmDelete(row)} /> : null}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>
      {filtered.length > PAGE_SIZE ? (
        <div className="mt-3">
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </div>
      ) : null}

      {(isNew || editing) && (
        <Modal title={isNew ? `Add ${noun}` : `Edit ${noun}`} onClose={closeModal} onSave={() => void save()} saving={saving || loadingDetail}>
          {loadingDetail ? <div className="flex justify-center py-2"><Spinner label={`Loading ${noun.toLowerCase()}`} /></div> : null}
          {editing?.code ? <TextField label="Code" value={editing.code} readOnly disabled /> : null}
          <TextField label={`${noun} Name`} required error={errors.name} maxLength={LOCATION_MASTER_LIMITS.name} autoFocus
            placeholder={namePlaceholder} value={form.name} onValueChange={(name) => patch({ name }, ['name'])} />
          {kind === 'port' ? (
            <TextField label="Port Alias" required error={errors.alias} maxLength={LOCATION_MASTER_LIMITS.alias}
              placeholder="e.g. INNSA" value={form.alias} onValueChange={(alias) => patch({ alias }, ['alias'])} />
          ) : null}
          <SearchSelectField<CountryOption>
            label="Country" required error={errors.countryNo}
            options={countries} value={selectedCountry} onChange={changeCountry}
            getKey={(c) => String(c.countryNo)} getLabel={(c) => c.countryName}
            placeholder="Select country" searchPlaceholder="Search country…" />
          {kind !== 'state' ? (
            <SearchSelectField<StateOption>
              label="State" required error={errors.stateNo}
              options={states} value={selectedState} onChange={changeState}
              getKey={(s) => String(s.stateNo)} getLabel={(s) => s.stateName}
              disabled={!form.countryNo}
              placeholder={form.countryNo ? 'Select state' : 'Select country first'} searchPlaceholder="Search state…" />
          ) : null}
          {kind === 'port' ? (
            <SearchSelectField<CityOption>
              label="City" required error={errors.cityNo}
              options={cities} value={selectedCity} onChange={(c) => patch({ cityNo: c?.cityNo ?? null }, ['cityNo'])}
              getKey={(c) => String(c.cityNo)} getLabel={(c) => c.cityName}
              disabled={!form.stateNo}
              placeholder={form.stateNo ? 'Select city' : 'Select state first'} searchPlaceholder="Search city…" />
          ) : null}
          {kind === 'state' ? (
            <>
              <TextField label="GST State Code" error={errors.gstStateCode} maxLength={LOCATION_MASTER_LIMITS.gstStateCode}
                inputMode="numeric" placeholder="e.g. 27" value={form.gstStateCode}
                onValueChange={(gstStateCode) => patch({ gstStateCode }, ['gstStateCode'])} />
              <Checkbox label="Union territory" checked={form.isUnionTerritory}
                onCheckedChange={(isUnionTerritory) => patch({ isUnionTerritory }, [])} />
            </>
          ) : null}
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${noun}`}
          message={`Delete "${confirmDelete.name}"? This cannot be undone. The server will refuse if it is still in use.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          danger
          onConfirm={() => { if (!deleting) void remove(confirmDelete); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
