import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import { dict, type Lang } from '../i18n';
import {
  clearProjectStorageLifecycle,
  createProjectStorageBucket,
  createProjectStorageUploadLink,
  deleteProjectStorageBucket,
  deleteProjectStorageObject,
  loadProjectStorageAudit,
  loadProjectStorageBuckets,
  loadProjectStorageDiscovery,
  loadProjectStorageLifecycle,
  loadProjectStorageObjects,
  loadProjectStorageUsage,
  loadProjectStorageVersions,
  PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS,
  prepareProjectStorageUploads,
  restoreProjectStorageVersion,
  saveProjectStorageLifecycle,
  signProjectStorageObject,
  serializeProjectStoragePage,
  updateProjectStorageBucket,
  uploadProjectStorageObject,
  transferProjectStorageObject,
  validProjectStorageTransfer,
  type ProjectPanelState,
  type ProjectStorageAudit,
  type ProjectStorageBucket,
  type ProjectStorageDiscovery,
  type ProjectStorageLifecycle,
  type ProjectStorageLifecycleRule,
  type ProjectStorageObject,
  type ProjectStorageObjectPage,
  type ProjectStorageSignedExpiresIn,
  type ProjectStorageSignedRead,
  type ProjectStorageUsage,
  type ProjectStorageUploadRejection,
  type ProjectStorageVersion,
  type ProjectStorageTransferInput,
  type SaasContext,
} from '../lib/saasConsole';

type Props = {
  lang: Lang;
  context: SaasContext;
  projectId: string;
  publishableKey: string;
  initialBuckets: ProjectStorageBucket[];
};

type BucketDraft = { id: string; name: string; public: boolean; fileSizeLimit: string; mimeTypes: string; quotaBytes: string };
type LifecycleDraft = { id: string; enabled: boolean; prefix: string; expirationDays: string; noncurrentExpirationDays: string };
type ActionStatus = 'idle' | 'loading' | 'done' | 'error' | 'invalid' | 'unknown' | 'batch-unknown';
type ManagementTarget = { kind: 'bucket' | 'lifecycle'; bucket: string } | ({ kind: 'transfer' } & ProjectStorageTransferInput);
type UploadProgress = { path: string; size: number; status: 'pending' | 'uploading' | 'done' | 'error' | 'cancelled'; rejection?: ProjectStorageUploadRejection; failure?: Exclude<ProjectPanelState<never>['status'], 'ready'> };
type DeleteProgress = { path: string; status: 'pending' | 'deleting' | 'deleted' | 'error' | 'unknown' };
type SignedObjectRead = ProjectStorageSignedRead & { imageStatus?: 'loading' | 'ready' | 'error'; source: { context: SaasContext; projectId: string; publishableKey: string; bucket: string; path: string; contentType?: string } };
type SignedObjectUpload = { url: string; notAfter: number; upsert: boolean; source: SignedObjectRead['source'] };

type LoadedObjectPage = ProjectStorageObjectPage & { source: { context: SaasContext; projectId: string; publishableKey: string; prefix: string; capturedAt: string } };

const EMPTY_BUCKET: BucketDraft = { id: '', name: '', public: false, fileSizeLimit: '', mimeTypes: '', quotaBytes: '' };
const EMPTY_RULE: LifecycleDraft = { id: '', enabled: true, prefix: '', expirationDays: '', noncurrentExpirationDays: '' };

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MiB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GiB`;
}

function draftFrom(bucket: ProjectStorageBucket): BucketDraft {
  return { id: bucket.id, name: bucket.name, public: bucket.public, fileSizeLimit: bucket.fileSizeLimit == null ? '' : String(bucket.fileSizeLimit), mimeTypes: bucket.objectMimeTypes.join(', '), quotaBytes: bucket.quotaBytes == null ? '' : String(bucket.quotaBytes) };
}

function parseOptionalPositive(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function ruleFromDraft(draft: LifecycleDraft): ProjectStorageLifecycleRule | null {
  const expirationDays = parseOptionalPositive(draft.expirationDays);
  const noncurrentExpirationDays = parseOptionalPositive(draft.noncurrentExpirationDays);
  if (expirationDays === undefined || noncurrentExpirationDays === undefined) return null;
  if (expirationDays == null && noncurrentExpirationDays == null) return null;
  if (!draft.id.trim() || draft.prefix.includes('\0')) return null;
  return {
    id: draft.id.trim(),
    enabled: draft.enabled,
    prefix: draft.prefix,
    expirationDays,
    noncurrentExpirationDays,
  };
}

function expiresLabel(lang: Lang, seconds: ProjectStorageSignedExpiresIn): string {
  if (seconds < 60) return lang === 'zh' ? `${seconds} 秒` : `${seconds}s`;
  if (seconds < 3600) return lang === 'zh' ? `${seconds / 60} 分钟` : `${seconds / 60} min`;
  return lang === 'zh' ? `${seconds / 3600} 小时` : `${seconds / 3600} h`;
}

function previewableImage(contentType?: string): boolean { return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType?.split(';')[0]?.trim().toLowerCase() || ''); }

export function ProjectStorageConsole({ lang, context, projectId, publishableKey, initialBuckets }: Props) {
  const t = dict(lang).console;
  const [buckets, setBuckets] = useState(initialBuckets);
  const [selectedBucket, setSelectedBucket] = useState(initialBuckets[0]?.id || '');
  const [bucketDraft, setBucketDraft] = useState<BucketDraft>(EMPTY_BUCKET);
  const [editingBucket, setEditingBucket] = useState<string | null>(null);
  const [bucketDeleteConfirmation, setBucketDeleteConfirmation] = useState('');
  const [bucketStatus, setBucketStatus] = useState<ActionStatus>('idle');
  const managementPending = useRef<ManagementTarget | null>(null);
  const managementUnknown = useRef<ManagementTarget | null>(null);
  const [managementRefreshKind, setManagementRefreshKind] = useState<ManagementTarget['kind'] | null>(null);
  const needsManagementRefresh = managementRefreshKind !== null;
  const [objects, setObjects] = useState<ProjectPanelState<LoadedObjectPage> | null>(null);
  const [objectExportFailed, setObjectExportFailed] = useState(false);
  const objectDownloads = useRef<Array<{ url: string; timer: number }>>([]);
  const [objectOffset, setObjectOffset] = useState(0);
  const [objectPrefix, setObjectPrefix] = useState('');
  const [prefixDraft, setPrefixDraft] = useState('');
  const [objectRefresh, setObjectRefresh] = useState(0);
  const bucketRequest = useRef(0);
  const [usage, setUsage] = useState<ProjectPanelState<ProjectStorageUsage> | null>(null);
  const [audit, setAudit] = useState<ProjectPanelState<ProjectStorageAudit> | null>(null);
  const [discovery, setDiscovery] = useState<ProjectPanelState<ProjectStorageDiscovery> | null>(null);
  const [lifecycle, setLifecycle] = useState<ProjectPanelState<ProjectStorageLifecycle> | null>(null);
  const [lifecycleDraft, setLifecycleDraft] = useState<LifecycleDraft>(EMPTY_RULE);
  const [lifecycleClearConfirmation, setLifecycleClearConfirmation] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState<ActionStatus>('idle');
  const [versions, setVersions] = useState<ProjectPanelState<{ bucket: string; path: string; versions: ProjectStorageVersion[]; truncated?: boolean }> | null>(null);
  const [objectPath, setObjectPath] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadFolder, setUploadFolder] = useState(false);
  const [uploadUpsert, setUploadUpsert] = useState(false);
  const plannedUploads = prepareProjectStorageUploads(uploadFiles, objectPath, uploadFolder);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploadStatus, setUploadStatus] = useState<ActionStatus | 'cancelled'>('idle');
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const uploadAbort = useRef<AbortController | null>(null);
  const uploadGeneration = useRef(0);
  const [objectDelete, setObjectDelete] = useState<ProjectStorageObject | null>(null);
  const [objectDeleteConfirmation, setObjectDeleteConfirmation] = useState('');
  const [transferInput, setTransferInput] = useState<ProjectStorageTransferInput | null>(null);
  const [transferConfirmation, setTransferConfirmation] = useState('');
  const [transferResult, setTransferResult] = useState<{ input: ProjectStorageTransferInput; acknowledged: boolean; sourceExists?: boolean; destinationExists?: boolean } | null>(null);
  const [versionPathDraft, setVersionPathDraft] = useState('');
  const [restoredVersion, setRestoredVersion] = useState<{ path: string; versionId: string } | null>(null);
  const objectActionAbort = useRef<AbortController | null>(null);
  const objectActionGeneration = useRef(0);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [signedExpiresIn, setSignedExpiresIn] = useState<ProjectStorageSignedExpiresIn>(300);
  const [signedRead, setSignedRead] = useState<ProjectPanelState<SignedObjectRead> | null>(null);
  const [signedNow, setSignedNow] = useState(() => Date.now());
  const signedCopyGeneration = useRef(0);
  const [signedCopyStatus, setSignedCopyStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [uploadLinkPath, setUploadLinkPath] = useState('');
  const [uploadLinkUpsert, setUploadLinkUpsert] = useState(false);
  const [uploadLink, setUploadLink] = useState<SignedObjectUpload | null>(null);
  const [uploadLinkStatus, setUploadLinkStatus] = useState<ActionStatus>('idle');
  const [uploadLinkCopyStatus, setUploadLinkCopyStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [objectStatus, setObjectStatus] = useState<ActionStatus>('idle');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchConfirmation, setBatchConfirmation] = useState('');
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress[]>([]);
  const batchNeedsRefresh = useRef(false);
  const batchUnknown = objectStatus === 'batch-unknown';
  const objectUnknown = objectStatus === 'unknown' || batchUnknown;
  const batchBusy = objectStatus === 'loading' || uploadStatus === 'loading' || uploadLinkStatus === 'loading' || bucketStatus === 'loading' || lifecycleStatus === 'loading';
  const canExportObjects = !batchBusy && objects?.status === 'ready' && objects.data.bucket === selectedBucket
    && objects.data.offset === objectOffset && objects.data.source.prefix === objectPrefix
    && objects.data.source.context === context && objects.data.source.projectId === projectId
    && objects.data.source.publishableKey === publishableKey;

  const activeSignedRead = signedRead?.status === 'ready' && signedRead.data.source.context === context
    && signedRead.data.source.projectId === projectId && signedRead.data.source.publishableKey === publishableKey
    && signedRead.data.source.bucket === selectedBucket ? signedRead.data : null;
  const signedRemaining = activeSignedRead ? Math.max(0, Math.ceil((activeSignedRead.expiresAt * 1000 - signedNow) / 1000)) : 0;
  const activeUploadLink = uploadLink?.source.context === context && uploadLink.source.projectId === projectId
    && uploadLink.source.publishableKey === publishableKey && uploadLink.source.bucket === selectedBucket ? uploadLink : null;
  useEffect(() => {
    if (!activeSignedRead && !activeUploadLink) return;
    const update = () => setSignedNow(Date.now());
    const timer = window.setInterval(update, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [activeSignedRead, activeUploadLink]);
  const clearUploadLink = () => { signedCopyGeneration.current += 1; setUploadLink(null); setUploadLinkCopyStatus('idle'); setUploadLinkStatus('idle'); };
  const copyUploadLink = async () => {
    if (!activeUploadLink || batchBusy || objectUnknown || Date.now() >= activeUploadLink.notAfter) { setSignedNow(Date.now()); return; }
    const generation = objectActionGeneration.current;
    const copyGeneration = ++signedCopyGeneration.current;
    try {
      await navigator.clipboard.writeText(new URL(activeUploadLink.url, window.location.origin).href);
      if (generation === objectActionGeneration.current && copyGeneration === signedCopyGeneration.current) setUploadLinkCopyStatus('done');
    } catch { if (generation === objectActionGeneration.current && copyGeneration === signedCopyGeneration.current) setUploadLinkCopyStatus('error'); }
  };
  const copySignedRead = async () => {
    if (!activeSignedRead || batchBusy || objectUnknown || Date.now() >= activeSignedRead.expiresAt * 1000) { setSignedNow(Date.now()); return; }
    const generation = objectActionGeneration.current;
    const read = activeSignedRead;
    const copyGeneration = ++signedCopyGeneration.current;
    try {
      await navigator.clipboard.writeText(new URL(read.url, window.location.origin).href);
      if (generation === objectActionGeneration.current && copyGeneration === signedCopyGeneration.current) setSignedCopyStatus('done');
    } catch { if (generation === objectActionGeneration.current && copyGeneration === signedCopyGeneration.current) setSignedCopyStatus('error'); }
  };

  const clearObjectDownloads = () => { for (const item of objectDownloads.current) { window.clearTimeout(item.timer); URL.revokeObjectURL(item.url); } objectDownloads.current = []; };
  const exportObjects = (format: 'json' | 'csv') => {
    if (!canExportObjects || objects?.status !== 'ready') return;
    setObjectExportFailed(false);
    let url: string | undefined;
    try {
      const content = serializeProjectStoragePage(context, projectId, objects.data.source.prefix, objects.data, objects.data.source.capturedAt, format);
      url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64)}-${selectedBucket.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64)}-objects-${objects.data.offset}.${format}`;
      anchor.click();
      const downloadUrl = url;
      const timer = window.setTimeout(() => { URL.revokeObjectURL(downloadUrl); objectDownloads.current = objectDownloads.current.filter(item => item.url !== downloadUrl); }, 1000);
      objectDownloads.current.push({ url, timer });
    } catch { if (url) URL.revokeObjectURL(url); setObjectExportFailed(true); }
  };

  const clearSelection = () => { setSelectedPaths([]); setBatchDeleteOpen(false); setBatchConfirmation(''); };

  const bearer = () => getAccessToken();
  const refreshAudit = async (signal?: AbortSignal, initialToken?: string | null) => {
    const request: typeof fetch = (input, init) => { signal?.throwIfAborted(); return fetch(input, { ...init, ...(signal ? { signal } : {}) }); };
    const result = await loadProjectStorageAudit(context, projectId, publishableKey, initialToken === undefined ? await bearer() : initialToken, request);
    if (!signal?.aborted) setAudit(result);
  };
  const refreshDiscovery = async () => setDiscovery(await loadProjectStorageDiscovery(context, projectId, publishableKey, await bearer(), fetch));
  const refreshLifecycle = async (bucket = selectedBucket) => {
    if (!bucket) { setLifecycle(null); return; }
    const requestId = ++bucketRequest.current;
    const result = await loadProjectStorageLifecycle(context, projectId, bucket, publishableKey, await bearer(), fetch);
    if (requestId === bucketRequest.current) setLifecycle(result);
  };
  const refreshBucket = async (bucket = selectedBucket, reloadObjects = true, signal?: AbortSignal, initialToken?: string | null) => {
    const requestId = ++bucketRequest.current;
    if (!bucket) return;
    if (reloadObjects) setObjectRefresh((current) => current + 1);
    const token = initialToken === undefined ? await bearer() : initialToken;
    const request: typeof fetch = (input, init) => { signal?.throwIfAborted(); return fetch(input, { ...init, ...(signal ? { signal } : {}) }); };
    const [nextUsage, nextLifecycle] = await Promise.all([
      loadProjectStorageUsage(context, projectId, bucket, publishableKey, token, request),
      loadProjectStorageLifecycle(context, projectId, bucket, publishableKey, token, request),
    ]);
    if (requestId !== bucketRequest.current || signal?.aborted) return;
    setUsage(nextUsage); setLifecycle(nextLifecycle); setSignedRead(null); setVersions(null); setLifecycleClearConfirmation(''); setLifecycleStatus('idle');
  };
  const selectBucket = (bucket: string, internal = false) => {
    if (!internal && (managementPending.current || managementUnknown.current)) return;
    clearObjectDownloads(); setObjectExportFailed(false);
    if (!internal) { objectActionGeneration.current += 1; objectActionAbort.current?.abort(); objectActionAbort.current = null; }
    setVersionPathDraft(''); setRestoredVersion(null);
    clearSelection(); setDeleteProgress([]); setBatchRunning(false); batchNeedsRefresh.current = false;
    uploadGeneration.current += 1; uploadAbort.current?.abort(); uploadAbort.current = null;
    setSelectedBucket(bucket); setObjectOffset(0); setObjectPrefix(''); setPrefixDraft('');
    setObjects(null); setUsage(null); setLifecycle(null); setSignedRead(null); setVersions(null);
    clearUploadLink(); setUploadLinkPath(''); setUploadLinkUpsert(false);
    setObjectDelete(null); setObjectDeleteConfirmation(''); setRestoreConfirmation(''); setTransferInput(null); setTransferConfirmation(''); setTransferResult(null);
    setObjectPath(''); setUploadFiles([]); setUploadUpsert(false); setUploadProgress([]); setUploadStatus('idle'); setUploadInputKey((current) => current + 1); setObjectStatus('idle');
    setLifecycleDraft(EMPTY_RULE); setLifecycleClearConfirmation(''); setLifecycleStatus('idle');
    if (!internal) void refreshBucket(bucket);
  };
  useEffect(() => {
    const generation = ++uploadGeneration.current;
    queueMicrotask(() => {
      if (uploadGeneration.current !== generation) return;
      setObjectPath(''); setUploadFiles([]); setUploadUpsert(false); setUploadProgress([]); setUploadStatus('idle'); setUploadInputKey((current) => current + 1);
      setVersionPathDraft(''); setRestoredVersion(null); setVersions(null); setRestoreConfirmation(''); setObjectStatus('idle'); setTransferInput(null); setTransferConfirmation(''); setTransferResult(null);
      clearUploadLink(); setUploadLinkPath(''); setUploadLinkUpsert(false);
      clearSelection(); setDeleteProgress([]); setBatchRunning(false); batchNeedsRefresh.current = false;
      managementPending.current = null; managementUnknown.current = null; setManagementRefreshKind(null);
    });
    return () => { clearObjectDownloads(); objectActionGeneration.current += 1; objectActionAbort.current?.abort(); objectActionAbort.current = null; uploadGeneration.current += 1; uploadAbort.current?.abort(); uploadAbort.current = null; };
  }, [context, projectId, publishableKey]);
  useEffect(() => {
    if (!selectedBucket) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setObjects(null);
      setObjectExportFailed(false);
      clearSelection();
      void getAccessToken().then((token) => loadProjectStorageObjects(context, projectId, selectedBucket, publishableKey, token, fetch, controller.signal, objectOffset, objectPrefix)).then((result) => {
        if (active) {
          setObjects(controller.signal.aborted ? { status: 'network' } : result.status === 'ready'
            ? { status: 'ready', data: { ...result.data, source: { context, projectId, publishableKey, prefix: objectPrefix, capturedAt: new Date().toISOString() } } } : result);
          if (!controller.signal.aborted && result.status === 'ready' && batchNeedsRefresh.current && !objectActionAbort.current) { batchNeedsRefresh.current = false; setObjectStatus('idle'); }
        }
      }).catch(() => {
        if (active) setObjects({ status: 'network' });
      }).finally(() => clearTimeout(timeout));
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [context, projectId, selectedBucket, publishableKey, objectOffset, objectPrefix, objectRefresh]);
  useEffect(() => {
    queueMicrotask(() => {
      if (initialBuckets[0]) void refreshBucket(initialBuckets[0].id, false);
      void refreshAudit();
      void refreshDiscovery();
    });
    return () => { bucketRequest.current += 1; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bucketInput = () => {
    const fileSizeLimit = parseOptionalPositive(bucketDraft.fileSizeLimit);
    const quotaBytes = parseOptionalPositive(bucketDraft.quotaBytes);
    if (fileSizeLimit === undefined || quotaBytes === undefined) return null;
    return { id: bucketDraft.id.trim(), name: bucketDraft.name.trim(), public: bucketDraft.public, fileSizeLimit, quotaBytes, objectMimeTypes: bucketDraft.mimeTypes.split(',').map((value) => value.trim()).filter(Boolean) };
  };

  const saveBucket = async () => {
    if (objectActionAbort.current || uploadAbort.current || batchNeedsRefresh.current || managementUnknown.current) return;
    const input = bucketInput(); if (!input) { setBucketStatus('invalid'); return; }
    const editing = editingBucket;
    await runObjectAction(true, (token, request) => editing
      ? updateProjectStorageBucket(context, projectId, input, publishableKey, token, request)
      : createProjectStorageBucket(context, projectId, input, publishableKey, token, request), async (data, token, signal) => {
      setBuckets(current => [data, ...current.filter(bucket => bucket.id !== data.id)]);
      selectBucket(data.id, true); setBucketDraft(EMPTY_BUCKET); setEditingBucket(null);
      await refreshBucket(data.id, true, signal, token); await refreshAudit(signal, token);
    }, { status: setBucketStatus, target: { kind: 'bucket', bucket: input.id } });
  };

  const removeBucket = async () => {
    if (objectActionAbort.current || uploadAbort.current || batchNeedsRefresh.current || managementUnknown.current) return;
    if (!editingBucket || bucketDeleteConfirmation !== editingBucket) { setBucketStatus('invalid'); return; }
    const bucket = editingBucket;
    await runObjectAction(true, (token, request) => deleteProjectStorageBucket(context, projectId, bucket, bucketDeleteConfirmation, publishableKey, token, request), async (_data, token, signal) => {
      const remaining = buckets.filter(item => item.id !== bucket); setBuckets(remaining);
      selectBucket(remaining[0]?.id || '', true); setEditingBucket(null); setBucketDraft(EMPTY_BUCKET); setBucketDeleteConfirmation('');
      await refreshBucket(remaining[0]?.id || '', true, signal, token); await refreshAudit(signal, token);
    }, { status: setBucketStatus, target: { kind: 'bucket', bucket } });
  };

  const upload = async () => {
    if (uploadAbort.current || objectActionAbort.current || batchNeedsRefresh.current || managementUnknown.current) return;
    const items = prepareProjectStorageUploads(uploadFiles, objectPath, uploadFolder);
    if (!selectedBucket || !items) { setUploadStatus('invalid'); return; }
    const completed = new Set(uploadProgress.filter((item) => item.status === 'done').map((item) => item.path));
    const controller = new AbortController();
    uploadAbort.current = controller;
    const generation = ++uploadGeneration.current;
    setUploadStatus('loading');
    setUploadProgress(items.map(({ path, file }) => ({ path, size: file.size, status: completed.has(path) ? 'done' : 'pending' })));
    let failed = false;
    try {
      const token = await bearer();
      for (const item of items) {
        if (controller.signal.aborted || uploadGeneration.current !== generation) return;
        if (completed.has(item.path)) continue;
        setUploadProgress((current) => current.map((row) => row.path === item.path ? { ...row, status: 'uploading' } : row));
        const result = await uploadProjectStorageObject(context, projectId, selectedBucket, item.path, item.file, publishableKey, token, fetch, controller.signal, uploadUpsert);
        if (controller.signal.aborted || uploadGeneration.current !== generation) return;
        setUploadProgress((current) => current.map((row) => row.path === item.path ? { ...row, status: result.status === 'ready' ? 'done' : 'error', rejection: result.rejection, failure: result.status === 'ready' ? undefined : result.status } : row));
        if (result.status === 'ready') completed.add(item.path);
        else failed = true;
        if (result.status === 'auth' || result.status === 'forbidden' || result.status === 'locked') break;
      }
      if (!failed) { setObjectPath(''); setUploadFiles([]); setUploadInputKey((current) => current + 1); }
      setUploadStatus(failed ? 'error' : 'done');
    } catch {
      if (!controller.signal.aborted && uploadGeneration.current === generation) {
        setUploadProgress((current) => current.map((row) => row.status === 'uploading' ? { ...row, status: 'error' } : row));
        setUploadStatus('error');
      }
    } finally {
      if (uploadGeneration.current === generation) uploadAbort.current = null;
    }
    if (completed.size && uploadGeneration.current === generation) {
      try { await refreshBucket(); if (uploadGeneration.current === generation) await refreshAudit(); }
      catch { if (uploadGeneration.current === generation) { setUsage({ status: 'network' }); setAudit({ status: 'network' }); } }
    }
  };

  const stopUploads = () => {
    uploadGeneration.current += 1; uploadAbort.current?.abort(); uploadAbort.current = null;
    setUploadProgress((current) => current.map((row) => row.status === 'uploading' ? { ...row, status: 'cancelled' } : row));
    setUploadStatus('cancelled');
    const generation = uploadGeneration.current;
    void refreshBucket().catch(() => { if (uploadGeneration.current === generation) setUsage({ status: 'network' }); });
  };

  const runObjectAction = async <T,>(write: boolean, invoke: (token: string | null, request: typeof fetch, signal: AbortSignal) => Promise<ProjectPanelState<T>>, complete: (data: T, token: string | null, signal: AbortSignal) => Promise<void | 'error' | 'batch-unknown'>, options?: { status: (status: ActionStatus) => void; target?: ManagementTarget; reconcile?: boolean }) => {
    if (objectActionAbort.current || uploadAbort.current || batchNeedsRefresh.current || (managementUnknown.current && !options?.reconcile)) return;
    const setStatus = options?.status || setObjectStatus;
    managementPending.current = options?.target || null;
    if (write && options?.target) bucketRequest.current += 1;
    const unknown = () => {
      if (options?.target && write) { managementUnknown.current = options.target; setManagementRefreshKind(options.target.kind); }
      setStatus('unknown');
    };
    const controller = new AbortController(); objectActionAbort.current = controller;
    const generation = objectActionGeneration.current;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const current = () => generation === objectActionGeneration.current && objectActionAbort.current === controller && !controller.signal.aborted;
    let started = false, confirmed = false;
    const request: typeof fetch = (input, init) => {
      signal.throwIfAborted();
      if (write && String(input).startsWith('/api/project-storage/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init?.method || 'GET')) started = true;
      return fetch(input, { ...init, signal });
    };
    setStatus('loading');
    try {
      const token = await new Promise<string | null>((resolve, reject) => {
        signal.throwIfAborted(); const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        void bearer().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      });
      if (!current()) return;
      signal.throwIfAborted();
      const result = await invoke(token, request, signal);
      if (!current()) return;
      if (signal.aborted || result.status !== 'ready') { if (batchNeedsRefresh.current) setStatus('batch-unknown'); else if (write && started && (signal.aborted || result.status === 'network' || result.status === 'invalid' || options?.target?.kind === 'transfer')) unknown(); else setStatus(options && result.status === 'invalid' ? 'invalid' : 'error'); return; }
      confirmed = true; const outcome = await complete(result.data, token, signal); if (current()) setStatus(outcome || 'done');
    } catch {
      if (current()) {
        if (confirmed) { setStatus('done'); setUsage({ status: 'network' }); setAudit({ status: 'network' }); }
        else if (batchNeedsRefresh.current) setStatus('batch-unknown'); else if (write && started) unknown(); else setStatus('error');
      }
    } finally { if (current()) { objectActionAbort.current = null; managementPending.current = null; } }
  };
  const openTransfer = (object: ProjectStorageObject, action: ProjectStorageTransferInput['action']) => {
    if (objectActionAbort.current || uploadAbort.current || managementUnknown.current || batchNeedsRefresh.current || objectUnknown || object.bucket !== selectedBucket) return;
    setTransferInput({ action, bucket: object.bucket, path: object.path, destinationBucket: object.bucket, destinationPath: '' }); setTransferConfirmation(''); setTransferResult(null); setObjectDelete(null); setBatchDeleteOpen(false);
  };
  const transferObject = async () => {
    const input = transferInput;
    if (!input || input.bucket !== selectedBucket || !validProjectStorageTransfer(input) || !buckets.some(bucket => bucket.id === input.destinationBucket) || (input.action === 'move' && transferConfirmation !== input.path) || objectUnknown) return;
    await runObjectAction(true, (token, request, signal) => transferProjectStorageObject(context, projectId, input, publishableKey, token, request, signal), async (data, token, signal) => {
      setTransferResult({ input: data, acknowledged: true }); setTransferInput(null); setTransferConfirmation(''); clearSelection(); setSignedRead(null); clearUploadLink();
      await refreshBucket(input.bucket, true, signal, token); await refreshAudit(signal, token);
    }, { status: setObjectStatus, target: { kind: 'transfer', ...input } });
  };
  const removeObject = async () => {
    if (!objectDelete || objectDelete.bucket !== selectedBucket || objectDeleteConfirmation !== objectDelete.path || batchNeedsRefresh.current) return;
    const object = objectDelete;
    await runObjectAction(true, (token, request) => deleteProjectStorageObject(context, projectId, object.bucket, object.path, objectDeleteConfirmation, publishableKey, token, request), async (_data, token, signal) => { setObjectDelete(null); setObjectDeleteConfirmation(''); await refreshBucket(object.bucket, true, signal, token); await refreshAudit(signal, token); });
  };
  const deleteSelected = async () => {
    if (objectActionAbort.current || uploadAbort.current || !batchDeleteOpen || batchConfirmation !== selectedBucket || batchNeedsRefresh.current || objects?.status !== 'ready' || !selectedPaths.length || selectedPaths.length > 50 || new Set(selectedPaths).size !== selectedPaths.length || selectedPaths.some(path => !objects.data.objects.some(object => object.bucket === selectedBucket && object.path === path))) return;
    const paths = [...selectedPaths];
    const rows: DeleteProgress[] = paths.map(path => ({ path, status: 'pending' }));
    const generation = objectActionGeneration.current;
    setDeleteProgress([...rows]);
    setBatchRunning(true);
    try { await runObjectAction(true, async (token, request, signal) => {
      for (let index = 0; index < rows.length; index++) {
        signal.throwIfAborted(); rows[index] = { ...rows[index], status: 'deleting' }; setDeleteProgress([...rows]);
        let sent = false;
        const deleteRequest: typeof fetch = (input, init) => { signal.throwIfAborted(); if (init?.method === 'DELETE') sent = true; return request(input, init); };
        let result: ProjectPanelState<{ path: string }>;
        try { result = await deleteProjectStorageObject(context, projectId, selectedBucket, rows[index].path, rows[index].path, publishableKey, token, deleteRequest); signal.throwIfAborted(); }
        catch { result = { status: sent ? 'network' : 'auth' }; }
        if (generation !== objectActionGeneration.current || objectActionAbort.current?.signal.aborted) return { status: 'network' };
        const uncertain = sent && (result.status === 'network' || result.status === 'invalid');
        rows[index] = { ...rows[index], status: result.status === 'ready' ? 'deleted' : uncertain ? 'unknown' : 'error' };
        setDeleteProgress([...rows]);
        const deleted = new Set(rows.filter(row => row.status === 'deleted').map(row => row.path));
        setObjects(current => current?.status === 'ready' ? { status: 'ready', data: { ...current.data, objects: current.data.objects.filter(object => !deleted.has(object.path)) } } : current);
        if (result.status !== 'ready') {
          batchNeedsRefresh.current = uncertain;
          clearSelection();
          return { status: 'ready', data: uncertain ? 'batch-unknown' as const : 'error' as const };
        }
      }
      clearSelection();
      return { status: 'ready', data: 'done' as const };
    }, async (outcome, token, signal) => {
      if (outcome !== 'done') return outcome;
      await refreshBucket(selectedBucket, true, signal, token); await refreshAudit(signal, token);
    }); } finally { if (generation === objectActionGeneration.current) setBatchRunning(false); }
  };
  const stopDeletes = () => {
    const inFlight = deleteProgress.some(row => row.status === 'deleting');
    objectActionGeneration.current += 1; objectActionAbort.current?.abort(); objectActionAbort.current = null;
    setDeleteProgress(rows => rows.map(row => row.status === 'deleting' ? { ...row, status: 'unknown' } : row));
    batchNeedsRefresh.current = inFlight; clearSelection(); setBatchRunning(false); setObjectStatus(inFlight ? 'batch-unknown' : deleteProgress.some(row => row.status === 'deleted') ? 'done' : 'idle');
  };
  const signObject = async (object: Pick<ProjectStorageObject, 'bucket' | 'path'> & { contentType?: string }, imagePreview = false) => {
    if (object.bucket !== selectedBucket || (imagePreview && !previewableImage(object.contentType))) return;
    await runObjectAction(false, (token, request) => { setSignedRead(null); signedCopyGeneration.current += 1; setSignedCopyStatus('idle'); return signProjectStorageObject(context, projectId, object.bucket, object.path, publishableKey, token, request, signedExpiresIn); }, async (data, token, signal) => { setSignedNow(Date.now()); setSignedRead({ status: 'ready', data: { ...data, ...(imagePreview ? { imageStatus: 'loading' } : {}), source: { context, projectId, publishableKey, bucket: object.bucket, path: object.path, contentType: object.contentType } } }); await refreshAudit(signal, token); });
  };
  const updateImagePreview = (url: string, imageStatus: SignedObjectRead['imageStatus']) => setSignedRead(current => current?.status === 'ready' && current.data.url === url && current.data.imageStatus ? { status: 'ready', data: { ...current.data, imageStatus } } : current);
  const generateUploadLink = async () => {
    if (!selectedBucket || objectActionAbort.current || uploadAbort.current || batchNeedsRefresh.current || managementUnknown.current) return;
    const bucket = selectedBucket, path = uploadLinkPath, upsert = uploadLinkUpsert;
    // The API returns a fixed two-hour capability, without an expiry timestamp.
    // Start the conservative local display cutoff before authorization/network.
    // Event handler only; the cutoff must reflect submission, not render time.
    // eslint-disable-next-line react-hooks/purity
    const notAfter = Date.now() + 7200_000;
    clearUploadLink();
    await runObjectAction(false, (token, request, signal) => createProjectStorageUploadLink(context, projectId, bucket, path, upsert, publishableKey, token, request, signal), async (data, token, signal) => {
      setSignedNow(Date.now()); setUploadLink({ ...data, notAfter, upsert, source: { context, projectId, publishableKey, bucket, path } });
      await refreshAudit(signal, token);
    }, { status: setUploadLinkStatus });
  };
  const versionsAvailable = discovery?.status === 'ready' && discovery.data.capabilities.managementObjectVersions;
  const showVersions = async (object: Pick<ProjectStorageObject, 'bucket' | 'path'>) => {
    if (!versionsAvailable || object.bucket !== selectedBucket) return;
    await runObjectAction(false, (token, request, signal) => { setRestoreConfirmation(''); setVersions(null); return loadProjectStorageVersions(context, projectId, object.bucket, object.path, publishableKey, token, request, signal); }, async (data) => { setVersions({ status: 'ready', data }); setVersionPathDraft(data.path); });
  };
  const restoreVersion = async (version: ProjectStorageVersion) => {
    if (versions?.status !== 'ready' || versions.data.bucket !== selectedBucket || restoreConfirmation !== version.versionId || version.current || !versions.data.versions.some((item) => item.versionId === version.versionId && !item.current) || discovery?.status !== 'ready' || !discovery.data.capabilities.managementObjectRestore || objectUnknown) return;
    const { bucket, path } = versions.data;
    await runObjectAction(true, (token, request, signal) => { setRestoredVersion(null); return restoreProjectStorageVersion(context, projectId, bucket, path, version.versionId, publishableKey, token, request, signal); }, async (data, token, signal) => { setRestoredVersion({ path, versionId: data.versionId }); setRestoreConfirmation(''); await refreshBucket(bucket, true, signal, token); await refreshAudit(signal, token); });
  };

  const saveLifecycleRule = async () => {
    if (objectActionAbort.current || uploadAbort.current || batchNeedsRefresh.current || managementUnknown.current) return;
    if (!selectedBucket || lifecycle?.status !== 'ready' || !lifecycle.data.supported) { setLifecycleStatus('invalid'); return; }
    const rule = ruleFromDraft(lifecycleDraft);
    if (!rule) { setLifecycleStatus('invalid'); return; }
    const bucket = selectedBucket;
    const rules = [...lifecycle.data.rules.filter(item => item.id !== rule.id), rule];
    await runObjectAction(true, (token, request) => saveProjectStorageLifecycle(context, projectId, { bucket, rules }, publishableKey, token, request), async (data, token, signal) => {
      setLifecycle({ status: 'ready', data }); setLifecycleDraft(EMPTY_RULE); await refreshAudit(signal, token);
    }, { status: setLifecycleStatus, target: { kind: 'lifecycle', bucket } });
  };

  const clearLifecycle = async () => {
    if (objectActionAbort.current || uploadAbort.current || batchNeedsRefresh.current || managementUnknown.current) return;
    if (!selectedBucket || lifecycleClearConfirmation !== selectedBucket) { setLifecycleStatus('invalid'); return; }
    const bucket = selectedBucket;
    await runObjectAction(true, (token, request) => clearProjectStorageLifecycle(context, projectId, bucket, lifecycleClearConfirmation, publishableKey, token, request), async (data, token, signal) => {
      setLifecycle({ status: 'ready', data }); setLifecycleClearConfirmation(''); await refreshAudit(signal, token);
    }, { status: setLifecycleStatus, target: { kind: 'lifecycle', bucket } });
  };

  const refreshManagement = async () => {
    const uncertain = managementUnknown.current;
    const target = uncertain || { kind: 'bucket' as const, bucket: selectedBucket };
    await runObjectAction<{ buckets: ProjectStorageBucket[]; lifecycle: ProjectStorageLifecycle | null; transfer?: { sourceExists: boolean; destinationExists: boolean } }>(false, async (token, request, signal) => {
      const inventory = await loadProjectStorageBuckets(context, projectId, publishableKey, token, request);
      if (inventory.status !== 'ready') return inventory;
      if (target.kind === 'lifecycle' && inventory.data.some(bucket => bucket.id === target.bucket)) {
        const result = await loadProjectStorageLifecycle(context, projectId, target.bucket, publishableKey, token, request);
        if (result.status !== 'ready') return result;
        if (!result.data.supported) return { status: 'invalid' as const };
        return { status: 'ready' as const, data: { buckets: inventory.data, lifecycle: result.data } };
      }
      if (target.kind === 'transfer') {
        const inspect = async (bucket: string, path: string): Promise<ProjectPanelState<boolean>> => {
          if (!inventory.data.some(item => item.id === bucket)) return { status: 'ready', data: false };
          const result = await loadProjectStorageObjects(context, projectId, bucket, publishableKey, token, request, signal, 0, path);
          if (result.status !== 'ready') return result;
          const exists = result.data.objects.some(object => object.path === path);
          if ((!exists && result.data.hasMore) || new Set(result.data.objects.map(object => object.path)).size !== result.data.objects.length) return { status: 'invalid' };
          return { status: 'ready', data: exists };
        };
        const [source, destination] = await Promise.all([inspect(target.bucket, target.path), inspect(target.destinationBucket, target.destinationPath)]);
        if (source.status !== 'ready') return source;
        if (destination.status !== 'ready') return destination;
        return { status: 'ready' as const, data: { buckets: inventory.data, lifecycle: null, transfer: { sourceExists: source.data, destinationExists: destination.data } } };
      }
      return { status: 'ready' as const, data: { buckets: inventory.data, lifecycle: null } };
    }, async (data, token, signal) => {
      setBuckets(data.buckets);
      if (data.lifecycle) setLifecycle({ status: 'ready', data: data.lifecycle });
      managementUnknown.current = null; setManagementRefreshKind(null);
      if (uncertain?.kind === 'bucket') { setBucketDraft(EMPTY_BUCKET); setEditingBucket(null); setBucketDeleteConfirmation(''); }
      if (uncertain?.kind === 'lifecycle') { setLifecycleDraft(EMPTY_RULE); setLifecycleClearConfirmation(''); setLifecycleStatus('idle'); }
      if (uncertain?.kind === 'transfer' && data.transfer) {
        setObjectStatus('idle'); setTransferInput(null); setTransferConfirmation(''); setSignedRead(null); clearUploadLink();
      }
      const bucketMissing = !data.buckets.some(bucket => bucket.id === selectedBucket);
      const nextBucket = bucketMissing ? data.buckets[0]?.id || '' : selectedBucket;
      if (bucketMissing) selectBucket(nextBucket, true);
      if (uncertain?.kind === 'transfer' && data.transfer) setTransferResult({ input: uncertain, acknowledged: false, ...data.transfer });
      if (bucketMissing || uncertain?.kind === 'transfer') await refreshBucket(nextBucket, true, signal, token);
    }, { status: setBucketStatus, target, reconcile: true });
  };

  const panelMessage = (status: Exclude<ProjectPanelState<unknown>['status'], 'ready'>) => status === 'auth' ? t.projectDataAuthError : status === 'forbidden' ? t.projectDataForbidden : status === 'locked' ? t.projectKeyRequired : status === 'network' ? t.projectDataNetworkError : t.projectDataInvalid;

  const capabilityEntries = discovery?.status === 'ready' ? ([
    ['lifecycle', discovery.data.capabilities.lifecycle],
    ['managementQuotas', discovery.data.capabilities.managementQuotas],
    ['managementObjectVersions', discovery.data.capabilities.managementObjectVersions],
    ['managementObjectRestore', discovery.data.capabilities.managementObjectRestore],
    ['managementAudit', discovery.data.capabilities.managementAudit],
    ['presignedUrls', discovery.data.capabilities.presignedUrls],
  ] as const) : [];

  return <section className="console-key-management console-storage-manager" aria-labelledby="console-storage-manager-title">
    <div className="console-panel-heading"><h5 id="console-storage-manager-title">{t.storageManagement}</h5><button type="button" disabled={batchBusy} onClick={() => void refreshManagement()}>{t.storageRefreshInventory}</button><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => { setEditingBucket(null); setBucketDraft(EMPTY_BUCKET); setBucketStatus('idle'); }}>{t.createBucket}</button></div>
    <p className="console-note">{t.storageManagementNote}</p>{needsManagementRefresh && <p role="alert" className="console-status is-error">{managementRefreshKind === 'transfer' ? t.storageTransferUnknown : t.storageManagementUnknown}</p>}
    <section className="console-storage-capabilities" aria-labelledby="storage-capabilities-title">
      <div className="console-panel-heading"><h6 id="storage-capabilities-title">{t.storageCapabilities}</h6><button type="button" onClick={() => void refreshDiscovery()}>{t.refreshStorage}</button></div>
      {discovery?.status === 'ready' ? <div className="console-capabilities" aria-label={t.storageCapabilities}>{capabilityEntries.map(([name, available]) => <article className="console-capability" key={name}><strong>{name}</strong><span className={available ? 'is-available' : ''}>{available ? t.available : t.unavailable}</span></article>)}</div> : discovery ? <p role="status">{panelMessage(discovery.status)}</p> : <p role="status">{t.projectDataLoading}</p>}
    </section>
    <div className="console-storage-layout">
      <div className="console-storage-sidebar" aria-label={t.buckets}>
        {buckets.map((bucket) => <div key={bucket.id} className="console-key-note"><button type="button" disabled={bucketStatus === 'loading' || lifecycleStatus === 'loading' || (objectStatus === 'loading' && Boolean(transferInput)) || needsManagementRefresh} aria-pressed={selectedBucket === bucket.id} onClick={() => selectBucket(bucket.id)}>{bucket.name}</button><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => { setEditingBucket(bucket.id); setBucketDraft(draftFrom(bucket)); setBucketDeleteConfirmation(''); }}>{t.editBucket}</button></div>)}
        {buckets.length === 0 && <p className="console-empty">{t.noBuckets}</p>}
      </div>
      <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); void saveBucket(); }}>
        <strong>{editingBucket ? t.editBucket : t.createBucket}</strong>
        <label htmlFor="storage-bucket-id">{t.bucketId}</label><input id="storage-bucket-id" required disabled={Boolean(editingBucket) || batchBusy || needsManagementRefresh} value={bucketDraft.id} onChange={(event) => setBucketDraft({ ...bucketDraft, id: event.target.value })} />
        <label htmlFor="storage-bucket-name">{t.bucketName}</label><input id="storage-bucket-name" required disabled={batchBusy || needsManagementRefresh} value={bucketDraft.name} onChange={(event) => setBucketDraft({ ...bucketDraft, name: event.target.value })} />
        <label><input type="checkbox" checked={bucketDraft.public} disabled={batchBusy || needsManagementRefresh} onChange={(event) => setBucketDraft({ ...bucketDraft, public: event.target.checked })} /> {t.publicBucket}</label>
        {bucketDraft.public && <small>{t.publicBucketHelp}</small>}
        <label htmlFor="storage-file-limit">{t.fileSizeLimit}</label><input id="storage-file-limit" disabled={batchBusy || needsManagementRefresh} inputMode="numeric" value={bucketDraft.fileSizeLimit} onChange={(event) => setBucketDraft({ ...bucketDraft, fileSizeLimit: event.target.value })} />
        <label htmlFor="storage-quota">{t.quotaBytes}</label><input id="storage-quota" disabled={batchBusy || needsManagementRefresh} inputMode="numeric" value={bucketDraft.quotaBytes} onChange={(event) => setBucketDraft({ ...bucketDraft, quotaBytes: event.target.value })} />
        <label htmlFor="storage-mime-types">{t.mimeTypes}</label><input id="storage-mime-types" disabled={batchBusy || needsManagementRefresh} value={bucketDraft.mimeTypes} onChange={(event) => setBucketDraft({ ...bucketDraft, mimeTypes: event.target.value })} />
        <div className="console-row-actions"><button type="submit" className="site-nav-button" disabled={batchBusy || needsManagementRefresh}>{t.saveBucket}</button>{editingBucket && <button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => { setEditingBucket(null); setBucketDraft(EMPTY_BUCKET); }}>{t.cancelRow}</button>}</div>
        {editingBucket && <div className="console-boundary-note" role="alertdialog" aria-labelledby="storage-delete-bucket-title" aria-describedby="storage-delete-bucket-help"><strong id="storage-delete-bucket-title">{t.deleteBucket}</strong><label id="storage-delete-bucket-help" htmlFor="storage-delete-bucket">{t.typeBucketId}</label><input id="storage-delete-bucket" disabled={batchBusy || needsManagementRefresh} autoComplete="off" value={bucketDeleteConfirmation} onChange={(event) => setBucketDeleteConfirmation(event.target.value)} /><button type="button" disabled={bucketDeleteConfirmation !== editingBucket || batchBusy || needsManagementRefresh} onClick={() => void removeBucket()}>{t.deleteBucket}</button></div>}
        {bucketStatus === 'invalid' && <p role="alert" className="console-status is-error">{t.storageInvalid}</p>}{bucketStatus === 'error' && <p role="alert" className="console-status is-error">{t.storageFailed}</p>}{bucketStatus === 'done' && <p role="status">{t.storageDone}</p>}
      </form>
    </div>
    {selectedBucket && <section aria-labelledby="storage-lifecycle-title">
      <div className="console-panel-heading"><h6 id="storage-lifecycle-title">{t.storageLifecycle}</h6><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => void refreshLifecycle()}>{t.refreshStorage}</button></div>
      <p className="console-note">{t.storageLifecycleNote}</p>
      {!lifecycle ? <p role="status">{t.projectDataLoading}</p> : lifecycle.status !== 'ready' ? <p role="status">{panelMessage(lifecycle.status)}</p> : !lifecycle.data.supported ? <div className="console-boundary-note" role="status" aria-live="polite"><strong>{t.storageLifecycleUnsupported}</strong><p>{t.storageLifecycleUnsupportedNote}</p><small>{lifecycle.data.unavailableReason || 'lifecycle_capability_unavailable'}</small></div> : <>
        {lifecycle.data.rules.length === 0 ? <p className="console-empty">{t.noLifecycleRules}</p> : <ul aria-label={t.storageLifecycle}>{lifecycle.data.rules.map((rule) => <li key={rule.id}><code>{rule.id}</code><span>{rule.enabled ? t.enabled : t.disabled} · {rule.prefix || '/'} · {rule.expirationDays != null ? `${rule.expirationDays}d` : '—'} · noncurrent {rule.noncurrentExpirationDays != null ? `${rule.noncurrentExpirationDays}d` : '—'}</span><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => setLifecycleDraft({ id: rule.id, enabled: rule.enabled, prefix: rule.prefix, expirationDays: rule.expirationDays == null ? '' : String(rule.expirationDays), noncurrentExpirationDays: rule.noncurrentExpirationDays == null ? '' : String(rule.noncurrentExpirationDays) })}>{t.editLifecycleRule}</button></li>)}</ul>}
        <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); void saveLifecycleRule(); }}>
          <strong>{t.editLifecycleRule}</strong>
          <label htmlFor="storage-lifecycle-id">{t.lifecycleRuleId}</label><input id="storage-lifecycle-id" required value={lifecycleDraft.id} onChange={(event) => setLifecycleDraft({ ...lifecycleDraft, id: event.target.value })} disabled={batchBusy || needsManagementRefresh} />
          <label htmlFor="storage-lifecycle-prefix">{t.lifecyclePrefix}</label><input id="storage-lifecycle-prefix" value={lifecycleDraft.prefix} onChange={(event) => setLifecycleDraft({ ...lifecycleDraft, prefix: event.target.value })} disabled={batchBusy || needsManagementRefresh} />
          <label htmlFor="storage-lifecycle-days">{t.lifecycleExpirationDays}</label><input id="storage-lifecycle-days" inputMode="numeric" value={lifecycleDraft.expirationDays} onChange={(event) => setLifecycleDraft({ ...lifecycleDraft, expirationDays: event.target.value })} disabled={batchBusy || needsManagementRefresh} />
          <label htmlFor="storage-lifecycle-noncurrent">{t.lifecycleNoncurrentDays}</label><input id="storage-lifecycle-noncurrent" inputMode="numeric" value={lifecycleDraft.noncurrentExpirationDays} onChange={(event) => setLifecycleDraft({ ...lifecycleDraft, noncurrentExpirationDays: event.target.value })} disabled={batchBusy || needsManagementRefresh} />
          <label><input type="checkbox" checked={lifecycleDraft.enabled} onChange={(event) => setLifecycleDraft({ ...lifecycleDraft, enabled: event.target.checked })} disabled={batchBusy || needsManagementRefresh} /> {t.enabled}</label>
          <div className="console-row-actions"><button type="submit" className="site-nav-button" disabled={batchBusy || needsManagementRefresh}>{t.saveLifecycleRule}</button><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => setLifecycleDraft(EMPTY_RULE)}>{t.cancelRow}</button></div>
        </form>
        <div className="console-boundary-note" role="alertdialog" aria-labelledby="storage-clear-lifecycle-title" aria-describedby="storage-clear-lifecycle-help">
          <strong id="storage-clear-lifecycle-title">{t.clearLifecycle}</strong>
          <label id="storage-clear-lifecycle-help" htmlFor="storage-clear-lifecycle">{t.typeBucketIdLifecycle}</label>
          <input id="storage-clear-lifecycle" disabled={batchBusy || needsManagementRefresh} autoComplete="off" value={lifecycleClearConfirmation} onChange={(event) => setLifecycleClearConfirmation(event.target.value)} />
          <button type="button" disabled={lifecycleClearConfirmation !== selectedBucket || batchBusy || needsManagementRefresh} onClick={() => void clearLifecycle()}>{t.clearLifecycle}</button>
        </div>
      </>}
      {lifecycleStatus === 'invalid' && <p role="alert" className="console-status is-error">{t.storageInvalid}</p>}
      {lifecycleStatus === 'error' && <p role="alert" className="console-status is-error">{t.storageFailed}</p>}
      {lifecycleStatus === 'done' && <p role="status">{t.storageDone}</p>}
    </section>}
    {selectedBucket && <section aria-labelledby="storage-objects-title"><div className="console-panel-heading"><h6 id="storage-objects-title">{t.objectBrowser} · {selectedBucket}</h6><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => void refreshBucket()}>{t.refreshStorage}</button></div>
      <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); setObjectOffset(0); setObjectPrefix(prefixDraft); setObjectRefresh((current) => current + 1); }}>
        <label htmlFor="storage-object-prefix">{t.storageObjectPrefix}</label><input id="storage-object-prefix" maxLength={1024} value={prefixDraft} onChange={(event) => setPrefixDraft(event.target.value)} />
        <div className="console-row-actions"><button type="submit" disabled={batchBusy || needsManagementRefresh}>{t.storageSearchObjects}</button><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => { setPrefixDraft(''); setObjectPrefix(''); setObjectOffset(0); setObjectRefresh((current) => current + 1); }}>{t.storageClearSearch}</button></div>
      </form>
      <div className="console-row-actions" aria-label={t.storageObjectPages}>
        <button type="button" disabled={batchBusy || objects === null || objectOffset === 0} onClick={() => setObjectOffset((current) => Math.max(0, current - 50))}>{t.previousPage}</button>
        <span>{t.pageLabel} {Math.floor(objectOffset / 50) + 1}</span>
        <button type="button" disabled={batchBusy || objects?.status !== 'ready' || !objects.data.hasMore} onClick={() => setObjectOffset((current) => current + 50)}>{t.nextPage}</button>
      </div>
      <p className="console-note">{t.storageObjectPagingNote}</p>
      <div className="console-row-actions"><button type="button" disabled={!canExportObjects} onClick={() => exportObjects('json')}>{t.storageExportJson}</button><button type="button" disabled={!canExportObjects} onClick={() => exportObjects('csv')}>{t.storageExportCsv}</button></div>
      <p className="console-note">{t.storageExportNote}</p>
      {objectExportFailed && <p role="alert">{t.storageExportFailed}</p>}
      {usage?.status === 'ready' ? <p className="console-note" aria-live="polite">{bytes(usage.data.bytesUsed)} · {usage.data.objectCount} {t.objects} · {t.quota}: {usage.data.quotaBytes == null ? t.unlimited : bytes(usage.data.quotaBytes)}{usage.data.bytesRemaining == null ? '' : ` · ${t.remaining}: ${bytes(usage.data.bytesRemaining)}`}</p> : usage && <p role="status">{panelMessage(usage.status)}</p>}
      <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); void upload(); }}>
        <strong>{t.uploadObject}</strong>
        <label htmlFor="storage-upload-source">{t.storageUploadSource}</label>
        <select id="storage-upload-source" disabled={batchBusy || needsManagementRefresh} value={uploadFolder ? 'folder' : 'files'} onChange={event => { setUploadFolder(event.target.value === 'folder'); setUploadFiles([]); setUploadProgress([]); setUploadStatus('idle'); setUploadInputKey(current => current + 1); }}><option value="files">{t.storageUploadFiles}</option><option value="folder">{t.storageUploadFolder}</option></select>
        <label htmlFor="storage-object-path">{uploadFolder || uploadFiles.length > 1 ? t.storageUploadPrefix : t.objectPath}</label>
        <input id="storage-object-path" required={!uploadFolder && uploadFiles.length <= 1} value={objectPath} disabled={batchBusy || needsManagementRefresh} onChange={(event) => { setObjectPath(event.target.value); setUploadProgress([]); setUploadStatus('idle'); }} />
        <label htmlFor="storage-object-file">{uploadFolder ? t.storageUploadFolder : t.file}</label>
        <input key={`${selectedBucket}:${uploadInputKey}`} ref={input => { if (uploadFolder) input?.setAttribute('webkitdirectory', ''); }} id="storage-object-file" type="file" multiple required disabled={batchBusy || needsManagementRefresh} onChange={(event) => { setUploadFiles(Array.from(event.target.files || [])); setUploadProgress([]); setUploadStatus('idle'); }} />
        <p className="console-note">{uploadFolder ? t.storageUploadFolderNote : t.storageUploadNote}</p>
        <label htmlFor="storage-upload-upsert"><input id="storage-upload-upsert" type="checkbox" checked={uploadUpsert} disabled={batchBusy || objectUnknown || needsManagementRefresh} onChange={event => setUploadUpsert(event.target.checked)} />{t.storageUploadReplace}</label>
        <p className="console-note">{t.storageUploadReplaceNote}</p>
        {plannedUploads && <section aria-label={t.storageUploadTargets}><strong>{t.storageUploadTargets}</strong><ul>{plannedUploads.map(item => <li key={item.path}><code>{item.path}</code> · {bytes(item.file.size)}</li>)}</ul></section>}
        <button className="site-nav-button" type="submit" disabled={!uploadFiles.length || batchBusy || objectUnknown || needsManagementRefresh}>{uploadStatus === 'error' || uploadStatus === 'cancelled' ? t.storageRetryUploads : t.uploadObject}</button>
        {uploadStatus === 'loading' && <button type="button" onClick={stopUploads}>{t.storageStopUploads}</button>}
      </form>
      <form className="console-row-editor" aria-labelledby="storage-upload-link-title" onSubmit={(event) => { event.preventDefault(); void generateUploadLink(); }}>
        <strong id="storage-upload-link-title">{t.storageUploadLinkTitle}</strong>
        <label htmlFor="storage-upload-link-path">{t.storageUploadLinkPath}</label>
        <input id="storage-upload-link-path" required value={uploadLinkPath} disabled={batchBusy || objectUnknown || needsManagementRefresh} onChange={(event) => { setUploadLinkPath(event.target.value); clearUploadLink(); }} />
        <label htmlFor="storage-upload-link-upsert"><input id="storage-upload-link-upsert" type="checkbox" checked={uploadLinkUpsert} disabled={batchBusy || objectUnknown || needsManagementRefresh} onChange={(event) => { setUploadLinkUpsert(event.target.checked); clearUploadLink(); }} />{t.storageUploadLinkOverwrite}</label>
        <p className="console-note">{t.storageUploadLinkNote}</p>
        <button type="submit" disabled={!uploadLinkPath || batchBusy || objectUnknown || needsManagementRefresh}>{uploadLinkStatus === 'loading' ? t.loading : t.storageUploadLinkCreate}</button>
        {uploadLinkStatus === 'error' || uploadLinkStatus === 'invalid' ? <p role="alert">{t.storageUploadLinkFailed}</p> : null}
      </form>
      {activeUploadLink && <div className="console-row-editor" aria-labelledby="storage-upload-link-result">
        <strong id="storage-upload-link-result">{t.storageUploadLinkReady}</strong><code>{activeUploadLink.source.bucket}/{activeUploadLink.source.path}</code>
        <span>{activeUploadLink.upsert ? t.storageUploadLinkOverwrite : t.storageUploadLinkCreateOnly}</span>
        {signedNow < activeUploadLink.notAfter ? <><label htmlFor="storage-upload-link-url">{t.storageUploadLinkUrl}</label><textarea id="storage-upload-link-url" rows={3} readOnly value={typeof window === 'undefined' ? activeUploadLink.url : new URL(activeUploadLink.url, window.location.origin).href} /><p className="console-note">{t.storageUploadLinkUse}</p><button type="button" disabled={batchBusy || objectUnknown} onClick={() => void copyUploadLink()}>{t.storageUploadLinkCopy}</button></> : <p role="status">{t.storageUploadLinkExpired}</p>}
        <button type="button" disabled={batchBusy} onClick={clearUploadLink}>{t.storageUploadLinkClear}</button>
        {uploadLinkCopyStatus === 'done' && <p role="status">{t.storageUploadLinkCopied}</p>}{uploadLinkCopyStatus === 'error' && <p role="alert">{t.storageUploadLinkCopyFailed}</p>}
      </div>}
      {uploadProgress.length > 0 && <div aria-label={t.storageUploadProgress}>
        <p role="status">{uploadProgress.filter((item) => item.status === 'done').length} / {uploadProgress.length} {t.storageUploadedFiles}</p>
        <progress max={uploadProgress.length} value={uploadProgress.filter((item) => item.status === 'done').length} aria-label={t.storageUploadProgress} />
        <ul>{uploadProgress.map((item) => <li key={item.path}><code>{item.path}</code><span>{bytes(item.size)}</span><span>{t.storageUploadStates[item.status]}</span>{item.status === 'error' && <small>{item.rejection ? t.storageUploadRejections[item.rejection] : item.failure && item.failure !== 'network' ? panelMessage(item.failure) : t.storageUploadFailureUnknown}</small>}</li>)}</ul>
      </div>}
      {uploadStatus === 'invalid' && <p role="alert">{t.storageUploadInvalid}</p>}
      {uploadStatus === 'error' && <p role="alert">{t.storageUploadFailed}</p>}
      {uploadStatus === 'cancelled' && <p role="status">{t.storageUploadStopped}</p>}
      {uploadStatus === 'done' && <p role="status">{t.storageDone}</p>}
      <div className="console-row-editor"><label htmlFor="storage-signed-expiry">{t.signedUrlExpiry}</label><select id="storage-signed-expiry" value={signedExpiresIn} onChange={(event) => setSignedExpiresIn(Number(event.target.value) as ProjectStorageSignedExpiresIn)}>{PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS.map((value) => <option key={value} value={value}>{expiresLabel(lang, value)}</option>)}</select><p className="console-note">{t.signedUrlExpiryNote}</p></div>
      {versionsAvailable && <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); void showVersions({ bucket: selectedBucket, path: versionPathDraft }); }}><label htmlFor="storage-version-path">{t.storageVersionPath}</label><input id="storage-version-path" required value={versionPathDraft} disabled={batchBusy || needsManagementRefresh} onChange={(event) => { setVersionPathDraft(event.target.value); setVersions(null); setRestoreConfirmation(''); }} /><p className="console-note">{t.storageVersionNote}</p><button type="submit" disabled={!versionPathDraft || batchBusy || batchUnknown}>{t.storageFindVersions}</button></form>}
      {objectStatus === 'loading' && <p role="status">{t.projectDataLoading}</p>}
      {restoredVersion && <p role="status">{t.storageRestoredVersion} <code>{restoredVersion.path}</code> · <code>{restoredVersion.versionId}</code></p>}
      <div className="console-row-actions">
        <button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown || objects?.status !== 'ready' || !objects.data.objects.length} onClick={() => { setSelectedPaths(objects?.status === 'ready' ? [...new Set(objects.data.objects.map(object => object.path))] : []); setBatchDeleteOpen(false); setBatchConfirmation(''); }}>{t.storageSelectPage}</button>
        <button type="button" disabled={batchBusy || needsManagementRefresh || !selectedPaths.length} onClick={clearSelection}>{t.storageClearSelection}</button>
        <button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown || !selectedPaths.length || objects?.status !== 'ready'} onClick={() => { setBatchDeleteOpen(true); setBatchConfirmation(''); setObjectDelete(null); }}>{t.storageDeleteSelected} ({selectedPaths.length})</button>
      </div>
      <p className="console-note">{t.storageBatchDeleteNote}</p>
      {batchDeleteOpen && <div className="console-boundary-note" role="alertdialog" aria-labelledby="storage-batch-delete-title" aria-describedby="storage-batch-delete-help">
        <strong id="storage-batch-delete-title">{t.storageDeleteSelected} · {selectedBucket} · {selectedPaths.length}</strong>
        {selectedPaths.map(path => <p key={path}><code>{path}</code></p>)}
        <label id="storage-batch-delete-help" htmlFor="storage-batch-delete">{t.storageBatchDeleteConfirmation}</label>
        <input id="storage-batch-delete" autoComplete="off" disabled={batchBusy || needsManagementRefresh} value={batchConfirmation} onChange={event => setBatchConfirmation(event.target.value)} />
        <div className="console-row-actions"><button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown || batchConfirmation !== selectedBucket} onClick={() => void deleteSelected()}>{t.storageConfirmBatchDelete}</button><button type="button" disabled={batchBusy || needsManagementRefresh} onClick={() => { setBatchDeleteOpen(false); setBatchConfirmation(''); }}>{t.cancelRow}</button></div>
      </div>}
      {batchRunning && <button type="button" onClick={stopDeletes}>{t.storageStopDeletes}</button>}
      {deleteProgress.length > 0 && <div aria-label={t.storageBatchDeleteProgress}>
        <p role="status">{deleteProgress.filter(row => row.status === 'deleted').length} / {deleteProgress.length} {t.storageDeleteStates.deleted}</p>
        <ol>{deleteProgress.map(row => <li key={row.path}><span><code>{row.path}</code></span><span>{t.storageDeleteStates[row.status]}</span></li>)}</ol>
      </div>}
      {objects?.status === 'ready' ? objects.data.objects.length === 0 ? <p className="console-empty">{t.noObjects}</p> : <ul>{objects.data.objects.map((object) => <li key={`${object.path}:${object.versionId}`}><input type="checkbox" aria-label={`${t.storageSelectObject} ${object.path}`} disabled={batchBusy || needsManagementRefresh || objectUnknown} checked={selectedPaths.includes(object.path)} onChange={event => { setSelectedPaths(paths => event.target.checked ? [...paths, object.path] : paths.filter(path => path !== object.path)); setBatchDeleteOpen(false); setBatchConfirmation(''); }} /><code>{object.path}</code><span>{object.contentType || 'application/octet-stream'} · {bytes(object.size)}</span><span className="console-row-actions"><button type="button" disabled={batchBusy || batchUnknown} onClick={() => void signObject(object)}>{t.downloadObject}</button>{previewableImage(object.contentType) && <button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown} onClick={() => void signObject(object, true)}>{t.storagePreviewImage}</button>}{versionsAvailable && <button type="button" disabled={batchBusy || batchUnknown} onClick={() => void showVersions(object)}>{t.versions}</button>}<button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown || object.size > 64 * 1024 * 1024} onClick={() => openTransfer(object, 'copy')}>{t.storageCopyObject}</button><button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown || object.size > 64 * 1024 * 1024} onClick={() => openTransfer(object, 'move')}>{t.storageMoveObject}</button><button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown} onClick={() => { setObjectDelete(object); setObjectDeleteConfirmation(''); }}>{t.deleteObject}</button></span></li>)}</ul> : objects ? <p role="status">{panelMessage(objects.status)}</p> : <p role="status">{t.projectDataLoading}</p>}
      {activeSignedRead && <div className="console-boundary-note" aria-labelledby="storage-signed-title">
        <strong id="storage-signed-title">{t.signedUrlTitle}</strong><code>{activeSignedRead.source.bucket}/{activeSignedRead.source.path}</code>
        <span>{t.signedUrlExpires}: {new Date(activeSignedRead.expiresAt * 1000).toLocaleString(lang)}</span>
        <span>{t.signedUrlRemaining}: {signedRemaining}s</span>
        {signedRemaining > 0 ? <a href={activeSignedRead.url} download onClick={(event) => { if (Date.now() >= activeSignedRead.expiresAt * 1000) { event.preventDefault(); setSignedNow(Date.now()); } }}>{t.downloadObject}</a> : <p role="status">{t.signedUrlExpired}</p>}
        <p className="console-note">{t.signedUrlShareNote}</p>
        <div className="console-row-actions"><button type="button" disabled={!signedRemaining || batchBusy || objectUnknown} onClick={() => void copySignedRead()}>{t.signedUrlCopy}</button><button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown} onClick={() => void signObject(activeSignedRead.source, Boolean(activeSignedRead.imageStatus))}>{t.signedUrlRenew}</button></div>
        {signedCopyStatus === 'done' && <p role="status">{t.signedUrlCopied}</p>}{signedCopyStatus === 'error' && <p role="alert">{t.signedUrlCopyFailed}</p>}
        {activeSignedRead.imageStatus && signedRemaining > 0 && <figure className="console-storage-image-preview" aria-labelledby="storage-image-preview-title">
          <figcaption id="storage-image-preview-title">{t.storagePreviewImage}</figcaption>
          {activeSignedRead.imageStatus === 'error' ? <p role="alert">{t.storageImagePreviewFailed}</p> : <><img key={activeSignedRead.url} src={activeSignedRead.url} alt={activeSignedRead.source.path} referrerPolicy="no-referrer" decoding="async" onLoad={() => updateImagePreview(activeSignedRead.url, 'ready')} onError={() => updateImagePreview(activeSignedRead.url, 'error')} />{activeSignedRead.imageStatus === 'loading' && <p role="status">{t.storageImagePreviewLoading}</p>}</>}
          <button type="button" onClick={() => updateImagePreview(activeSignedRead.url, undefined)}>{t.storageCloseImagePreview}</button>
        </figure>}
      </div>}
      {transferInput && <form className="console-row-editor" aria-labelledby="storage-transfer-title" onSubmit={event => { event.preventDefault(); void transferObject(); }}>
        <h6 id="storage-transfer-title">{transferInput.action === 'copy' ? t.storageCopyObject : t.storageMoveObject}</h6><p>{t.storageTransferSource}: <code>{transferInput.bucket}/{transferInput.path}</code></p><p className="console-note">{t.storageTransferNote}</p>
        <label htmlFor="storage-transfer-bucket">{t.storageTransferDestinationBucket}</label><select id="storage-transfer-bucket" disabled={batchBusy || needsManagementRefresh || objectUnknown} value={transferInput.destinationBucket} onChange={event => setTransferInput({ ...transferInput, destinationBucket: event.target.value })}>{buckets.map(bucket => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}</select>
        <label htmlFor="storage-transfer-path">{t.storageTransferDestinationPath}</label><input id="storage-transfer-path" required value={transferInput.destinationPath} disabled={batchBusy || needsManagementRefresh || objectUnknown} onChange={event => setTransferInput({ ...transferInput, destinationPath: event.target.value })} />
        {transferInput.action === 'move' && <><label htmlFor="storage-transfer-confirm">{t.storageTransferConfirm}</label><input id="storage-transfer-confirm" autoComplete="off" value={transferConfirmation} disabled={batchBusy || needsManagementRefresh || objectUnknown} onChange={event => setTransferConfirmation(event.target.value)} /></>}
        <div className="console-row-actions"><button type="submit" disabled={batchBusy || needsManagementRefresh || objectUnknown || !validProjectStorageTransfer(transferInput) || (transferInput.action === 'move' && transferConfirmation !== transferInput.path)}>{transferInput.action === 'copy' ? t.storageCopyObject : t.storageMoveObject}</button><button type="button" disabled={batchBusy || needsManagementRefresh || objectUnknown} onClick={() => { setTransferInput(null); setTransferConfirmation(''); }}>{t.cancelRow}</button></div>
      </form>}
      {transferResult && <section className="console-boundary-note" aria-labelledby="storage-transfer-result-title"><strong id="storage-transfer-result-title">{transferResult.acknowledged ? t.storageTransferAcknowledged : t.storageTransferInspected} {transferResult.input.action === 'copy' ? t.storageCopyObject : t.storageMoveObject}</strong><p>{t.storageTransferSource}: <code>{transferResult.input.bucket}/{transferResult.input.path}</code>{transferResult.sourceExists !== undefined && <> · {transferResult.sourceExists ? t.storageTransferPresent : t.storageTransferAbsent}</>}</p><p>{t.storageTransferDestination}: <code>{transferResult.input.destinationBucket}/{transferResult.input.destinationPath}</code>{transferResult.destinationExists !== undefined && <> · {transferResult.destinationExists ? t.storageTransferPresent : t.storageTransferAbsent}</>}</p></section>}
      {objectDelete && <div className="console-boundary-note" role="alertdialog" aria-labelledby="storage-delete-object-title" aria-describedby="storage-delete-object-help"><strong id="storage-delete-object-title">{t.deleteObject}</strong><code>{objectDelete.path}</code><label id="storage-delete-object-help" htmlFor="storage-delete-object">{t.typeObjectPath}</label><input id="storage-delete-object" autoComplete="off" value={objectDeleteConfirmation} onChange={(event) => setObjectDeleteConfirmation(event.target.value)} /><div className="console-row-actions"><button type="button" disabled={objectDeleteConfirmation !== objectDelete.path || objectStatus === 'loading'} onClick={() => void removeObject()}>{t.deleteObject}</button><button type="button" onClick={() => setObjectDelete(null)}>{t.cancelRow}</button></div></div>}
      {versions?.status === 'ready' && <div className="console-key-management" aria-labelledby="storage-version-title"><h6 id="storage-version-title">{t.versions} · {versions.data.path}</h6>{versions.data.truncated && <p role="status">{t.storageVersionLimit}</p>}<ul>{versions.data.versions.map((version) => <li key={version.versionId}><code>{version.versionId}</code><span>{bytes(version.size)} · {version.current ? t.active : version.modified}</span>{!version.current && discovery?.status === 'ready' && discovery.data.capabilities.managementObjectRestore && <><label htmlFor={`restore-${version.versionId}`}>{t.typeVersionId}</label><input id={`restore-${version.versionId}`} autoComplete="off" disabled={batchBusy || needsManagementRefresh || objectUnknown} value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} /><button type="button" disabled={restoreConfirmation !== version.versionId || objectStatus === 'loading' || uploadStatus === 'loading' || objectUnknown} onClick={() => void restoreVersion(version)}>{t.restoreVersion}</button></>}</li>)}</ul></div>}
      {objectUnknown && managementRefreshKind !== 'transfer' && <p role="alert">{batchUnknown ? t.storageBatchDeleteUnknown : t.storageRestoreUnknown}</p>}
      {objectStatus === 'invalid' && <p role="alert" className="console-status is-error">{t.storageInvalid}</p>}{objectStatus === 'error' && <p role="alert" className="console-status is-error">{t.storageFailed}</p>}{objectStatus === 'done' && <p role="status">{t.storageDone}</p>}
    </section>}
    <section aria-labelledby="storage-audit-title"><div className="console-panel-heading"><h6 id="storage-audit-title">{t.storageAudit}</h6><button type="button" onClick={() => void refreshAudit()}>{t.refreshStorage}</button></div>{audit?.status === 'ready' ? <><p className="console-note">{audit.data.events.length} {t.auditEvents}{audit.data.truncated ? ` · ${t.auditTruncated}` : ''}</p><ul>{audit.data.events.map((event) => <li key={event.id}><strong>{event.action}</strong><span>{event.bucket}{event.objectPath ? `/${event.objectPath}` : ''}</span><small>{event.actorId} · {event.occurredAt}</small></li>)}</ul></> : audit && <p role="status">{panelMessage(audit.status)}</p>}</section>
  </section>;
}
