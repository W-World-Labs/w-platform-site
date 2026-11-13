import type { Category } from './data/products';

export type Lang = 'en' | 'zh';
export const LANGS: Lang[] = ['en', 'zh'];
export const DEFAULT_LANG: Lang = 'en';

/** Human label for each language, used in the switcher. */
export const LANG_LABEL: Record<Lang, string> = {
  en: 'English',
  zh: '简体中文',
};

/** BCP-47 tag for the <html lang> attribute and hreflang. */
export const LANG_TAG: Record<Lang, string> = {
  en: 'en',
  zh: 'zh-Hans',
};

export interface Dict {
  brand: string;
  nav: { products: string; roadmap: string; membership: string; console: string; signIn: string; signOut: string; signedIn: string };
  hero: {
    titleA: string;
    titleB: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    statProducts: string;
    statSso: string;
    statAccess: string;
    ssoValue: string;
  };
  suite: {
    eyebrow: string;
    title: string;
    subtitle: string;
    usedProducts: string;
    totalOpens: string;
    availableProducts: string;
    opens: string;
    notUsed: string;
    privacyNote: string;
    wIdSourceNote: string;
    account: string;
    connected: string;
    notConnected: string;
    enabled: string;
    notEnabled: string;
    loadingAccount: string;
    reauthRequired: string;
    reauthenticate: string;
    mfaLabel: string;
    identityAdmin: string;
    platformAdmin: string;
  };
  categories: Record<Category, string>;
  trust: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: { title: string; body: string }[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    monthly: string;
    monthlyPrice: string;
    monthlyNote: string;
    monthlyFeatures: string[];
    monthlyCta: string;
    yearly: string;
    yearlyPrice: string;
    yearlyBadge: string;
    yearlyNote: string;
    yearlyFeatures: string[];
    yearlyCta: string;
    guarantee: string;
  };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  product: {
    ctaPrimary: string;
    ctaSecondary: string;
    allProducts: string;
    useCases: string;
    previewNote: string;
  };
  footer: { tagline: string; cta: string };
  notFound: { title: string; body: string; back: string };
  console: {
    eyebrow: string; title: string; subtitle: string; loading: string; authRequired: string; loadFailed: string; authenticate: string;
    viewNavigation: string; overviewTab: string; projectsTab: string; appsTab: string; platformTab: string;
    overviewTitle: string; overviewNote: string; authorityBoundary: string; workspacesCount: string; projectsCount: string; appsCount: string;
    platformPlane: string; platformPlaneNote: string; platformOperations: string; identityOperations: string;
    builderPlane: string; builderPlaneNote: string; noWorkspaces: string; noProjects: string; observability: string; openRadar: string;
    workspaceFilter: string; allWorkspaces: string; searchProjects: string; searchProjectsPlaceholder: string; noProjectResults: string; configureProject: string;
    capabilities: string; capabilitiesNote: string; noCapabilityProject: string; selectProject: string; notVerified: string;
    closePanel: string; previousPage: string; nextPage: string; pageLabel: string;
    publishableKey: string; keyMemoryNote: string; discover: string; discovering: string; clearKey: string;
    publishableKeys: string; issuePublishableKey: string; noPublishableKeys: string; rotateKey: string; revokeKey: string;
    oneTimeKey: string; oneTimeKeyWarning: string; keyActionError: string;
    connectConfiguration: string; connectConfigurationNote: string;
    projectDataTitle: string; projectDataLoading: string; authUsers: string; users: string; active: string; blocked: string;
    unlockProjectData: string; lockProjectData: string; consoleCredentialNote: string;
    databaseExplorer: string; tables: string; migrations: string; enabled: string; disabled: string;
    storageExplorer: string; buckets: string; publicBucket: string; publicBucketHelp: string; privateBucket: string;
    storageSelectObject: string; storageSelectPage: string; storageClearSelection: string; storageDeleteSelected: string; storageConfirmBatchDelete: string; storageBatchDeleteNote: string; storageBatchDeleteConfirmation: string; storageBatchDeleteProgress: string; storageStopDeletes: string; storageBatchDeleteUnknown: string; storageDeleteStates: Record<'pending' | 'deleting' | 'deleted' | 'error' | 'unknown', string>;
    storageObjectPrefix: string; storageSearchObjects: string; storageClearSearch: string; storageObjectPages: string; storageObjectPagingNote: string; storageExportJson: string; storageExportCsv: string; storageExportNote: string; storageExportFailed: string;
    storageRefreshInventory: string; storageManagementUnknown: string; storageManagement: string; storageManagementNote: string; createBucket: string; editBucket: string; deleteBucket: string; noBuckets: string;
    bucketId: string; bucketName: string; fileSizeLimit: string; quotaBytes: string; mimeTypes: string; saveBucket: string; typeBucketId: string;
    refreshStorage: string; quota: string; unlimited: string; remaining: string; uploadObject: string; objectPath: string; file: string;
    storageUploadPrefix: string; storageUploadSource: string; storageUploadFiles: string; storageUploadFolder: string; storageUploadFolderNote: string; storageUploadTargets: string; storageUploadReplace: string; storageUploadReplaceNote: string; storageUploadNote: string; storageRetryUploads: string; storageStopUploads: string; storageUploadProgress: string; storageUploadedFiles: string; storageUploadInvalid: string; storageUploadFailed: string; storageUploadStopped: string;
    storageUploadLinkTitle: string; storageUploadLinkPath: string; storageUploadLinkOverwrite: string; storageUploadLinkNote: string; storageUploadLinkCreate: string; storageUploadLinkFailed: string; storageUploadLinkReady: string; storageUploadLinkCreateOnly: string; storageUploadLinkUrl: string; storageUploadLinkUse: string; storageUploadLinkCopy: string; storageUploadLinkClear: string; storageUploadLinkCopied: string; storageUploadLinkCopyFailed: string; storageUploadLinkExpired: string;
    storageUploadFailureUnknown: string; storageUploadRejections: Record<'object_already_exists' | 'object_too_large' | 'bucket_quota_exceeded' | 'mime_type_not_allowed', string>;
    storageUploadStates: Record<'pending' | 'uploading' | 'done' | 'error' | 'cancelled', string>;
    storageVersionPath: string; storageFindVersions: string; storageVersionNote: string; storageVersionLimit: string; storageRestoreUnknown: string; storageRestoredVersion: string;
    storageCopyObject: string; storageMoveObject: string; storageTransferDestinationBucket: string; storageTransferDestinationPath: string; storageTransferConfirm: string; storageTransferNote: string; storageTransferAcknowledged: string; storageTransferInspected: string; storageTransferSource: string; storageTransferDestination: string; storageTransferPresent: string; storageTransferAbsent: string; storageTransferUnknown: string;
    downloadObject: string; deleteObject: string; versions: string; typeObjectPath: string; typeVersionId: string; signedUrlExpires: string;
    signedUrlExpiry: string; signedUrlExpiryNote: string;
    storagePreviewImage: string; storageCloseImagePreview: string; storageImagePreviewLoading: string; storageImagePreviewFailed: string;
    signedUrlTitle: string; signedUrlRemaining: string; signedUrlExpired: string; signedUrlCopy: string; signedUrlRenew: string; signedUrlCopied: string; signedUrlCopyFailed: string; signedUrlShareNote: string;
    storageCapabilities: string; storageLifecycle: string; storageLifecycleNote: string; storageLifecycleUnsupported: string; storageLifecycleUnsupportedNote: string;
    noLifecycleRules: string; editLifecycleRule: string; lifecycleRuleId: string; lifecyclePrefix: string; lifecycleExpirationDays: string; lifecycleNoncurrentDays: string;
    saveLifecycleRule: string; clearLifecycle: string; typeBucketIdLifecycle: string;
    storageAudit: string; auditEvents: string; auditTruncated: string; storageInvalid: string; storageFailed: string; storageDone: string;
    tablePreview: string; rows: string; noRows: string; objectBrowser: string; objects: string; noObjects: string;
    addRow: string; editRow: string; deleteRow: string; rowJson: string; rowJsonHelp: string; saveRow: string; cancelRow: string;
    confirmDeleteRow: string; confirmDeleteRowHelp: string; rowMutationLoading: string; rowMutationDone: string;
    rowMutationInvalid: string; rowMutationStale: string; reloadRows: string; rowMutationUnsupported: string; rowMutationFailed: string; rowIdentityRequired: string;
    projectKeyRequired: string; projectDataAuthError: string; projectDataForbidden: string; projectDataNetworkError: string; projectDataInvalid: string;
    managementPlanes: string; managementPlanesNote: string; edgeRouteRequired: string; managementSurfaceNames: Record<'workspaceTeam' | 'functionsManagement' | 'storageVersions', string>;
    membersLabel: string; invitationsLabel: string; functionsLabel: string; logsLabel: string; restoreVersion: string;
    databaseBackups: string; backupBackend: string; backups: string; noBackups: string; restoreBackup: string; restoreUnavailable: string;
    confirmRestore: string; typeRestore: string; restoreLoading: string; restoreDone: string; restoreFailed: string;
    observabilityPlane: string; observabilityPlaneNote: string; observabilityLoading: string; runtimeHealth: string; healthy: string; degraded: string; releasesDeployments: string; errorsLatencyLogs: string; openWMonitor: string; wMonitorSeparate: string;
    available: string; unavailable: string; openCapability: string; discoveryPrompt: string; discoveryReady: string;
    discoveryErrors: { key: string; auth: string; forbidden: string; network: string; invalid: string };
    endUserPlane: string; endUserPlaneNote: string; noApps: string; logins: string; searchApps: string; searchAppsPlaceholder: string; noAppResults: string;
  };
  meta: {
    homeTitle: string;
    homeDescription: string;
    productTitleSuffix: string;
  };
}

export const DICTS: Record<Lang, Dict> = {
  en: {
    brand: 'W·Platform',
    nav: { products: 'Products', roadmap: 'Roadmap', membership: 'Membership', console: 'Console', signIn: 'Sign in', signOut: 'Sign out', signedIn: 'Signed in' },
    hero: {
      titleA: 'Tools for research, work and creation.',
      titleB: 'On shared internet foundations.',
      subtitle:
        'Discover research tools, creative apps, monitoring products and developer services in one place.',
      ctaPrimary: 'Explore products',
      ctaSecondary: 'Developer console',
      statProducts: 'products',
      statSso: 'single sign-on',
      statAccess: 'capability groups',
      ssoValue: 'single sign-on',
    },
    suite: {
      eyebrow: 'Your usage',
      title: 'Products you use',
      subtitle: 'See which W products you have opened, how often, and when you last used them.',
      usedProducts: 'products used',
      totalOpens: 'total opens',
      availableProducts: 'available products',
      opens: 'opens',
      notUsed: 'Not used yet',
      privacyNote: 'Usage is stored for your W-ID account in this browser and is never shared publicly.',
      wIdSourceNote: 'Login history is loaded securely from your W-ID account across devices.',
      account: 'W-ID account',
      connected: 'Connected',
      notConnected: 'Not connected',
      enabled: 'Enabled',
      notEnabled: 'Not enabled',
      loadingAccount: 'Loading your verified W-ID profile and product history…',
      reauthRequired: 'Your previous sign-in has no usable access token, so browser fallback data is hidden.',
      reauthenticate: 'Authenticate again',
      mfaLabel: 'MFA',
      identityAdmin: 'Identity administration',
      platformAdmin: 'Platform administration',
    },
    categories: { Platform: 'Platform', Analysis: 'Analysis', Sensing: 'Sensing', Apps: 'Apps' },
    trust: {
      eyebrow: 'Built to rely on',
      title: 'Shared identity, separate product access',
      subtitle: 'W-ID supports a consistent sign-in where integrated; every product keeps its own permissions and availability.',
      items: [
        { title: 'Service-level security', body: 'Products manage their own authentication, authorization and data boundaries.' },
        { title: 'Shared sign-in', body: 'W-ID single sign-on is available in integrated products; a shared identity does not grant product permissions.' },
        { title: 'Cancel anytime', body: 'Month-to-month with no lock-in. Manage or cancel your membership yourself, whenever you want.' },
        { title: 'Real support', body: 'Reach a human for account, billing and product questions — included with every membership.' },
      ],
    },
    pricing: {
      eyebrow: 'Membership',
      title: 'Membership options',
      subtitle: 'Membership options for the W product suite. W-ID provides sign-in where supported; each service determines its own access and availability.',
      monthly: 'Monthly',
      monthlyPrice: '$19',
      monthlyNote: 'Billed monthly · cancel anytime',
      monthlyFeatures: ['W-ID account', 'Single sign-on where supported', 'Standard support', 'Service-specific availability'],
      monthlyCta: 'Start monthly',
      yearly: 'Yearly',
      yearlyPrice: '$190',
      yearlyBadge: 'SAVE 2 MONTHS',
      yearlyNote: '~$15.8/mo · best value',
      yearlyFeatures: ['Everything in Monthly', '2 months free', 'Priority support', 'Higher quotas where offered'],
      yearlyCta: 'Go yearly',
      guarantee: 'Secure W-ID checkout · cancel anytime · no per-product fees',
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Questions, answered',
      items: [
        { q: 'What does membership include?', a: 'Membership provides the listed billing benefits. Product availability, eligibility and permissions are determined by each service.' },
        { q: 'How does sign-in work across products?', a: 'W-ID provides a shared sign-in where a product supports it. Each service still controls its own access and permissions.' },
        { q: 'Can I cancel anytime?', a: 'Yes. The monthly plan is month-to-month with no lock-in, and you can manage or cancel your membership yourself at any time.' },
        { q: 'How is my data protected?', a: 'Each product applies its own authentication, authorization and data boundaries. Review the controls offered by the service you use.' },
        { q: 'Are the product images real screenshots?', a: 'Some product visuals are UI previews that illustrate the experience. Where you see a preview label, the interface shown is representative of the product.' },
      ],
    },
    product: {
      ctaPrimary: 'Open product →',
      ctaSecondary: 'View membership',
      allProducts: '← All products',
      useCases: 'Use cases',
      previewNote: 'UI preview',
    },
    footer: { tagline: 'Shared capabilities, focused products', cta: 'Membership options' },
    notFound: { title: '404', body: 'Product not found.', back: '← Back to all products' },
    console: {
      eyebrow: 'SaaS control plane', title: 'Console', subtitle: 'Your platform role, SaaS builder workspaces, projects and end-user relationships remain separate authority planes.',
      loading: 'Loading your verified SaaS context…', authRequired: 'Authenticate with W-ID to open the console.', loadFailed: 'The SaaS context is temporarily unavailable.', authenticate: 'Authenticate',
      viewNavigation: 'Console views', overviewTab: 'Overview', projectsTab: 'SaaS projects', appsTab: 'Apps I use', platformTab: 'Platform administration',
      overviewTitle: 'Your SaaS context', overviewNote: 'Choose one area to continue. Full project and application lists stay in their own views.', authorityBoundary: 'Platform administration, SaaS team membership and end-user app access are independent. Access in one area never grants access in another.', workspacesCount: 'workspaces', projectsCount: 'projects', appsCount: 'apps',
      platformPlane: 'Platform administration', platformPlaneNote: 'Platform access does not grant membership in customer workspaces.', platformOperations: 'Platform operations', identityOperations: 'Identity operations',
      builderPlane: 'SaaS builder', builderPlaneNote: 'Only workspaces and projects where you are an active team member appear here.', noWorkspaces: 'You do not manage a SaaS workspace yet.', noProjects: 'No projects in this workspace.', observability: 'Observability', openRadar: 'Open project in W-Radar',
      workspaceFilter: 'Workspace', allWorkspaces: 'All workspaces', searchProjects: 'Search projects', searchProjectsPlaceholder: 'Name, project ID or workspace', noProjectResults: 'No projects match these filters.', configureProject: 'Configure / verify',
      managementPlanes: 'Separated management planes', managementPlanesNote: 'Workspace membership, Functions operations, and Storage recovery keep independent authorization boundaries. Upstream contracts are ready; availability waits for exact edge routes.', edgeRouteRequired: 'Waiting for an allowlisted edge route', managementSurfaceNames: { workspaceTeam: 'Workspace & team', functionsManagement: 'Functions & safe logs', storageVersions: 'Storage versions & restore' },
      observabilityPlane: 'Project observability', observabilityPlaneNote: 'W-Radar project releases, deployments, runtime evidence and bounded telemetry aggregates. Raw logs and platform controls are never exposed.', observabilityLoading: 'Loading project observability…', runtimeHealth: 'Runtime health', healthy: 'healthy', degraded: 'degraded', releasesDeployments: 'Releases · deployments', errorsLatencyLogs: 'Errors · latency · log events', openWMonitor: 'Open infrastructure in W-Monitor', wMonitorSeparate: 'W-Monitor is a separate infrastructure capability with its own data and permissions; this link does not grant access.',
      membersLabel: 'members', invitationsLabel: 'invitations', functionsLabel: 'Functions', logsLabel: 'logs', restoreVersion: 'Restore',
      databaseBackups: 'Database backups & recovery', backupBackend: 'Recovery backend', backups: 'backups', noBackups: 'No backups are available for this project.', restoreBackup: 'Restore backup', restoreUnavailable: 'Restore is unavailable until this project has a configured recovery backend.', confirmRestore: 'Confirm destructive database recovery', typeRestore: 'Type the exact project ID to confirm this backup restore.', restoreLoading: 'Starting an audited restore with fresh project authorization…', restoreDone: 'Restore operation accepted. Refresh inventory and observability to verify completion.', restoreFailed: 'Restore was denied, unavailable, or returned an invalid operation.',
      capabilities: 'Project capabilities', capabilitiesNote: 'W-ID automatically loads the browser-safe Connect contract for this member project; no key paste is required.', noCapabilityProject: 'No member project is available for capability discovery.', selectProject: 'Member project', notVerified: 'Not verified',
      closePanel: 'Close', previousPage: 'Previous', nextPage: 'Next', pageLabel: 'Page',
      publishableKey: 'W_PUBLISHABLE_KEY', keyMemoryNote: 'Used only for this request and kept in React memory. It is never stored, logged, added to the URL, or sent to analytics.', discover: 'Discover capabilities', discovering: 'Discovering…', clearKey: 'Clear key', available: 'Available', unavailable: 'Unavailable', openCapability: 'Open endpoint', discoveryPrompt: 'Loading the authenticated Project Connect contract from W-ID…', discoveryReady: 'Verified from W-ID. Only allowlisted capability status, key metadata and HTTPS links are shown.',
      publishableKeys: 'Publishable keys', issuePublishableKey: 'Issue web key', noPublishableKeys: 'No active publishable key. Issue one to connect a browser application.', rotateKey: 'Rotate', revokeKey: 'Revoke', oneTimeKey: 'Copy this W_PUBLISHABLE_KEY now', oneTimeKeyWarning: 'This complete value is shown once and kept only in React memory. It disappears when you leave or refresh.', keyActionError: 'The project key operation failed or your Workspace role does not allow it.',
      connectConfiguration: 'Project Connect', connectConfigurationNote: 'Copy these two browser-safe values into your app. W-ID restores the publishable key only to active project members; server keys are never returned here.',
      projectDataTitle: 'Project data', projectDataLoading: 'Loading authorized project data…', authUsers: 'Auth users', users: 'users', active: 'active', blocked: 'blocked', unlockProjectData: 'Unlock for 15 minutes', lockProjectData: 'Lock now', consoleCredentialNote: 'Database and Storage exchange your W-ID session for a fresh exact-project access token that expires within 5 minutes. The console key, tokens, and row drafts stay only in React memory.', databaseExplorer: 'Database', tables: 'tables', migrations: 'migrations', enabled: 'enabled', disabled: 'disabled', storageExplorer: 'Storage', buckets: 'buckets', publicBucket: 'public', publicBucketHelp: 'Readable by authenticated project members; share files with a signed link.', privateBucket: 'private', tablePreview: 'RLS-protected row preview', rows: 'rows', noRows: 'This table has no visible rows.', objectBrowser: 'Object browser', objects: 'objects', noObjects: 'This bucket has no visible objects.', addRow: 'Add row', editRow: 'Edit', deleteRow: 'Delete', rowJson: 'Typed JSON fields', rowJsonHelp: 'Enter one JSON object. String, number, boolean, null, object, and array values keep their types. SQL is never accepted; project policy rejects owner and primary-key reassignment.', saveRow: 'Save row', cancelRow: 'Cancel', confirmDeleteRow: 'Confirm delete', confirmDeleteRowHelp: 'Deletion uses the visible row snapshot as an optimistic precondition and remains protected by RLS.', rowMutationLoading: 'Saving with a fresh project authorization…', rowMutationDone: 'Row mutation committed.', rowMutationInvalid: 'Enter a non-empty valid JSON object within the field and size limits.', rowMutationStale: 'This row changed after it was loaded. Reload before trying again.', reloadRows: 'Reload rows', rowMutationUnsupported: 'The W-DB edge does not expose safe row mutations yet. No change was made.', rowMutationFailed: 'The row mutation was denied or the project service is unavailable.', rowIdentityRequired: 'This row has no supported id value, so edit and delete are disabled.', projectKeyRequired: 'Unlock project data to create a short-lived in-memory console session.', projectDataAuthError: 'Your W-ID session expired. Authenticate again.', projectDataForbidden: 'This project or scope denied access.', projectDataNetworkError: 'The project service is temporarily unreachable.', projectDataInvalid: 'The project service returned an invalid response.',
      storageUploadPrefix: 'Destination folder (optional)', storageUploadSource: 'Upload source', storageUploadFiles: 'Files', storageUploadFolder: 'Folder', storageUploadFolderNote: 'Choose up to 100 files, 64 MiB total. The selected folder name and subfolders are retained; empty folders are omitted. Files upload sequentially.', storageUploadTargets: 'Upload destinations', storageUploadReplace: 'Replace existing files', storageUploadReplaceNote: 'Existing files are kept by default. Enable replacement only to overwrite unfinished destinations; confirmed uploads are skipped on retry. If an upload result is unknown, inspect the object before enabling replacement.', storageUploadNote: 'Choose up to 100 files, 64 MiB total. One file uses an exact object path; multiple files keep their names under the destination folder. Files upload sequentially.', storageRetryUploads: 'Retry remaining files', storageStopUploads: 'Stop uploads', storageUploadProgress: 'Upload progress', storageUploadedFiles: 'files uploaded', storageUploadInvalid: 'Choose 1–100 files within 64 MiB total, with valid, distinct destination paths. No upload started.', storageUploadFailed: 'Some uploads failed. Successful files remain; retry sends only unfinished files.', storageUploadStopped: 'Stopped waiting and stopped the queue. An in-flight upload may have completed; successful files remain.', storageUploadFailureUnknown: 'Upload could not be confirmed. Inspect the object before retrying.', storageUploadRejections: { object_already_exists: 'A file already exists at this path. Enable replacement only if you intend to overwrite it.', object_too_large: 'This file exceeds the bucket file size limit.', bucket_quota_exceeded: 'This upload would exceed the bucket storage quota.', mime_type_not_allowed: 'This file content type is not allowed by the bucket.' }, storageUploadStates: { pending: 'Pending', uploading: 'Uploading', done: 'Uploaded', error: 'Failed', cancelled: 'Result unknown' },
      storageSelectObject: 'Select object', storageSelectPage: 'Select current page', storageClearSelection: 'Clear selection', storageDeleteSelected: 'Delete selected', storageConfirmBatchDelete: 'Confirm selected deletion', storageBatchDeleteNote: 'Delete only the selected current objects on this page (up to 50), one at a time. The queue stops at the first failure; confirmed deletions remain completed. This operation does not remove retained historical versions.', storageBatchDeleteConfirmation: 'Type the exact bucket ID to delete these selected objects.', storageBatchDeleteProgress: 'Selected deletion results', storageStopDeletes: 'Stop deletion queue', storageBatchDeleteUnknown: 'A deletion result is unknown. Refresh the object list before selecting and confirming another deletion; the server may have completed it.', storageDeleteStates: { pending: 'Not attempted', deleting: 'Deleting', deleted: 'Deletion confirmed', error: 'Deletion failed', unknown: 'Result unknown' },
      storageExportJson: 'Export current object page JSON', storageExportCsv: 'Export current object page CSV', storageExportNote: 'Download only the loaded page (up to 50 objects), including its bucket, applied prefix, offset and capture time. This is not a complete bucket inventory. CSV escapes formula-like text for spreadsheets.', storageExportFailed: 'The object page download could not be prepared. Loaded objects are still available.', storageObjectPrefix: 'Object path prefix', storageSearchObjects: 'Search objects', storageClearSearch: 'Clear search', storageObjectPages: 'Object pages', storageObjectPagingNote: 'Up to 50 objects per page. Uploads and deletions can move objects between pages; refresh to see current results.', storageRefreshInventory: 'Refresh bucket inventory', storageManagementUnknown: 'The change result is unknown. Refresh the bucket inventory before retrying; the server may have completed the bucket or retention change.', storageManagement: 'Storage management', storageManagementNote: 'Manage only this project’s buckets and objects. Every operation exchanges a fresh exact-project W-ID token; files go directly to W-Storage and credentials never enter browser state.', createBucket: 'Create bucket', editBucket: 'Edit bucket', deleteBucket: 'Delete bucket', noBuckets: 'No buckets yet.', bucketId: 'Bucket ID', bucketName: 'Display name', fileSizeLimit: 'Per-file byte limit (optional)', quotaBytes: 'Bucket quota in bytes (optional)', mimeTypes: 'Allowed MIME types, comma separated (optional)', saveBucket: 'Save bucket', typeBucketId: 'Type the exact bucket ID to delete this empty bucket.', refreshStorage: 'Refresh', quota: 'quota', unlimited: 'unlimited', remaining: 'remaining', uploadObject: 'Upload file', objectPath: 'Object path', file: 'File', storageCopyObject: 'Copy object', storageMoveObject: 'Move object', storageTransferDestinationBucket: 'Destination bucket', storageTransferDestinationPath: 'Destination object path', storageTransferConfirm: 'Type the source object path to move it', storageTransferNote: 'Objects up to 64 MiB can be copied or moved. The destination must be a new object. Moving writes the destination before deleting the source; a failure can leave both objects. Requests are never automatically retried. Inspect both locations before retrying.', storageTransferAcknowledged: 'Transfer acknowledged:', storageTransferInspected: 'Transfer locations inspected; no operation was replayed:', storageTransferSource: 'Source', storageTransferDestination: 'Destination', storageTransferPresent: 'Present', storageTransferAbsent: 'Absent', storageTransferUnknown: 'The transfer result is unknown. Refresh bucket inventory to inspect both the source and destination before another write. A move may have left both objects.', downloadObject: 'Download (signed URL)', deleteObject: 'Delete object', versions: 'Versions', storageVersionPath: 'Recovery object path', storageFindVersions: 'Find retained versions', storageVersionNote: 'Look up a full object path, including deleted objects. Recovery requires a retained version and replaces the current object. Provider support is required.', storageVersionLimit: 'Only the latest 100 retained versions are shown.', storageRestoreUnknown: 'The result is unknown. Refresh objects and versions before retrying; the server may have completed the change.', storageRestoredVersion: 'Restored as a new version:', typeObjectPath: 'Type the exact object path to delete it.', typeVersionId: 'Type the exact version ID to restore it.', storageUploadLinkTitle: 'Signed upload link', storageUploadLinkPath: 'Upload destination path', storageUploadLinkOverwrite: 'Allow replacing this file', storageUploadLinkNote: 'Anyone with the link may upload to this path for up to two hours. Bucket file limits still apply. New links do not revoke earlier links.', storageUploadLinkCreate: 'Generate upload link', storageUploadLinkFailed: 'Could not issue an upload link. Check the path and permissions; this backend may not support signed uploads.', storageUploadLinkReady: 'Upload link ready', storageUploadLinkCreateOnly: 'Create only: an existing file will not be replaced.', storageUploadLinkUrl: 'Upload URL', storageUploadLinkUse: 'Send a PUT request with the file bytes and Content-Type. Refresh objects after an upload. Clearing this view does not revoke the link.', storageUploadLinkCopy: 'Copy upload link', storageUploadLinkClear: 'Clear upload link', storageUploadLinkCopied: 'Upload link copied.', storageUploadLinkCopyFailed: 'Could not copy the link. Select the URL above to copy it manually.', storageUploadLinkExpired: 'Generate a new upload link before sharing it.', storagePreviewImage: 'Preview image', storageCloseImagePreview: 'Close image preview', storageImagePreviewLoading: 'Loading image…', storageImagePreviewFailed: 'The image could not be loaded. Renew the link to try again, or download the file.', signedUrlTitle: 'Signed download link', signedUrlRemaining: 'Seconds remaining', signedUrlExpired: 'This download link has expired. Renew it to download again.', signedUrlCopy: 'Copy download link', signedUrlRenew: 'Renew download link', signedUrlCopied: 'Download link copied.', signedUrlCopyFailed: 'Could not copy the link. The download remains available.', signedUrlShareNote: 'Anyone with this link can download this object until it expires. Copying does not extend its lifetime.', signedUrlExpires: 'Signed URL expires', signedUrlExpiry: 'Signed URL expiry', signedUrlExpiryNote: 'W-Storage allows 1–3600 seconds. Console offers exact allowlisted values only; default remains 5 minutes.', storageCapabilities: 'Storage capabilities', storageLifecycle: 'Lifecycle & retention', storageLifecycleNote: 'Retention policies are shown only when W-Storage discovery advertises lifecycle support. Unsupported deployments stay explicit and never invent rules.', storageLifecycleUnsupported: 'Lifecycle policies unsupported', storageLifecycleUnsupportedNote: 'This project’s W-Storage discovery reports lifecycle=false, or the lifecycle endpoint is unavailable. No retention rules were invented.', noLifecycleRules: 'No lifecycle rules for this bucket.', editLifecycleRule: 'Add or edit rule', lifecycleRuleId: 'Rule ID', lifecyclePrefix: 'Object prefix (optional)', lifecycleExpirationDays: 'Expire current versions after days (optional)', lifecycleNoncurrentDays: 'Expire noncurrent versions after days (optional)', saveLifecycleRule: 'Save lifecycle rule', clearLifecycle: 'Clear all lifecycle rules', typeBucketIdLifecycle: 'Type the exact bucket ID to clear every lifecycle rule.', storageAudit: 'Bounded storage audit', auditEvents: 'events', auditTruncated: 'newest 200 shown', storageInvalid: 'Check the exact confirmation and field limits. No change was made.', storageFailed: 'W-Storage denied the operation or returned an invalid response.', storageDone: 'Storage operation completed and the bounded view was refreshed.',
      discoveryErrors: { key: 'Enter a valid wid_pk_ publishable key.', auth: 'W-ID authentication is missing or expired. Sign in again and retry.', forbidden: 'W-DB denied this project or key. Confirm your active workspace membership and project key.', network: 'W-DB could not be reached. This may be a network or browser CORS failure; clear the key and retry.', invalid: 'W-DB returned a mismatched or invalid project discovery document.' },
      endUserPlane: 'Apps you use', endUserPlaneNote: 'Using an app does not grant access to its developer workspace.', noApps: 'No app relationships yet.', logins: 'logins', searchApps: 'Search apps', searchAppsPlaceholder: 'App name or client ID', noAppResults: 'No apps match this search.',
    },
    meta: {
      homeTitle: 'W Platform — Fleet framework and roadmap',
      homeDescription: 'Explore the W fleet framework, shared capabilities and product roadmap. Sign in with W-ID to view the overview.',
      productTitleSuffix: 'W Platform',
    },
  },
  zh: {
    brand: 'W·平台',
    nav: { products: '产品', roadmap: '路线图', membership: '会员', console: '控制台', signIn: '登录', signOut: '退出', signedIn: '已登录' },
    hero: {
      titleA: '研究、工作与创作的工具，',
      titleB: '连接共享的互联网底座。',
      subtitle:
        '在一个入口发现研究工具、创作应用、监测产品与开发者服务。',
      ctaPrimary: '浏览产品',
      ctaSecondary: '开发者控制台',
      statProducts: '款产品',
      statSso: '次登录',
      statAccess: '组能力框架',
      ssoValue: '统一单点登录',
    },
    suite: {
      eyebrow: '你的使用统计',
      title: '你正在使用的产品',
      subtitle: '查看你打开过哪些 W 产品、使用次数以及最近使用时间。',
      usedProducts: '已使用产品',
      totalOpens: '累计打开次数',
      availableProducts: '可用产品',
      opens: '次打开',
      notUsed: '尚未使用',
      privacyNote: '使用记录按当前 W-ID 账号保存在此浏览器中，不会公开展示。',
      wIdSourceNote: '登录历史已从你的 W-ID 账号安全加载，包含跨设备记录。',
      account: 'W-ID 账户',
      connected: '已绑定',
      notConnected: '未绑定',
      enabled: '已启用',
      notEnabled: '未启用',
      loadingAccount: '正在加载已验证的 W-ID 资料和产品历史…',
      reauthRequired: '之前的登录没有可用访问令牌，已停止展示不准确的浏览器统计。',
      reauthenticate: '重新认证',
      mfaLabel: '多重验证',
      identityAdmin: '身份管理',
      platformAdmin: '平台管理',
    },
    categories: { Platform: '平台', Analysis: '分析', Sensing: '感知', Apps: '应用' },
    trust: {
      eyebrow: '值得托付',
      title: '统一身份，各自管理访问',
      subtitle: '已集成的产品可通过 W-ID 统一登录；每款产品保留自己的权限与可用性规则。',
      items: [
        { title: '服务级安全', body: '各产品分别管理自身的认证、授权与数据边界。' },
        { title: '共享登录', body: '已集成的产品可使用 W-ID 单点登录；统一身份本身不会授予产品权限。' },
        { title: '随时取消', body: '按月订阅，无任何锁定。会员可由你自己随时管理或取消。' },
        { title: '真人支持', body: '账号、计费与产品问题都能找到真人解答——每份会员均已包含。' },
      ],
    },
    pricing: {
      eyebrow: '会员',
      title: '会员方案',
      subtitle: '这里列出 W 产品矩阵的会员方案。W-ID 在支持的服务中提供登录；各服务分别决定可用性与访问权限。',
      monthly: '月付',
      monthlyPrice: '$19',
      monthlyNote: '按月计费 · 随时取消',
      monthlyFeatures: ['W-ID 账户', '支持服务的单点登录', '标准支持', '按各服务可用性提供'],
      monthlyCta: '开始月付',
      yearly: '年付',
      yearlyPrice: '$190',
      yearlyBadge: '省 2 个月',
      yearlyNote: '约 $15.8/月 · 最超值',
      yearlyFeatures: ['包含月付方案权益', '立省 2 个月', '优先支持', '适用时提供更高配额'],
      yearlyCta: '选择年付',
      guarantee: 'W-ID 安全结算 · 随时取消 · 无逐产品收费',
    },
    faq: {
      eyebrow: '常见问题',
      title: '你关心的问题，这里都有答案',
      items: [
        { q: '会员包含什么？', a: '会员提供页面列出的计费权益。具体产品的可用性、使用资格和权限由各服务分别决定。' },
        { q: '跨产品登录是怎么实现的？', a: '支持 W-ID 的产品可以复用统一登录；每项服务仍独立管理自己的访问权限。' },
        { q: '可以随时取消吗？', a: '可以。月付套餐按月计费、无任何锁定，你可随时自行管理或取消会员。' },
        { q: '我的数据如何受到保护？', a: '各产品分别执行自己的认证、授权与数据边界。请查看你所使用服务提供的具体控制措施。' },
        { q: '产品图是真实截图吗？', a: '部分产品视觉为展示体验的 UI 预览。凡标注“预览”之处，所示界面均能代表该产品的实际形态。' },
      ],
    },
    product: {
      ctaPrimary: '打开产品 →',
      ctaSecondary: '查看会员',
      allProducts: '← 全部产品',
      useCases: '应用场景',
      previewNote: 'UI 预览',
    },
    footer: { tagline: '共享能力，各自专注', cta: '查看会员方案' },
    notFound: { title: '404', body: '未找到该产品。', back: '← 返回全部产品' },
    console: {
      eyebrow: 'SaaS 控制面', title: '控制台', subtitle: '平台角色、SaaS 团队与项目、终端用户关系属于相互隔离的权限平面。',
      loading: '正在加载已验证的 SaaS 上下文…', authRequired: '请使用 W-ID 认证后进入控制台。', loadFailed: 'SaaS 上下文暂时不可用。', authenticate: '重新认证',
      viewNavigation: '控制台视图', overviewTab: '总览', projectsTab: 'SaaS 项目', appsTab: '我使用的应用', platformTab: '平台管理',
      overviewTitle: '你的 SaaS 上下文', overviewNote: '请选择一个区域继续；完整项目与应用列表分别保留在独立视图中。', authorityBoundary: '平台管理、SaaS 团队成员关系和终端应用访问彼此独立；一个区域的权限不会授予另一个区域的权限。', workspacesCount: '个 Workspace', projectsCount: '个项目', appsCount: '个应用',
      platformPlane: '平台管理', platformPlaneNote: '平台管理权限不会自动获得客户 Workspace 成员资格。', platformOperations: '平台运维', identityOperations: '身份运维',
      builderPlane: 'SaaS 构建与运营', builderPlaneNote: '这里只显示你作为有效团队成员加入的 Workspace 和项目。', noWorkspaces: '你还没有管理任何 SaaS Workspace。', noProjects: '这个 Workspace 尚无项目。', observability: '可观测性', openRadar: '在 W-Radar 打开项目',
      workspaceFilter: 'Workspace', allWorkspaces: '全部 Workspace', searchProjects: '搜索项目', searchProjectsPlaceholder: '项目名称、ID 或 Workspace', noProjectResults: '没有符合筛选条件的项目。', configureProject: '配置 / 验证能力',
      managementPlanes: '独立管理平面', managementPlanesNote: 'Workspace 成员管理、Functions 运维与 Storage 恢复使用相互独立的授权边界；精确边缘路由安装前不会宣称可用。', edgeRouteRequired: '等待边缘白名单路由', managementSurfaceNames: { workspaceTeam: 'Workspace 与团队', functionsManagement: 'Functions 与安全日志', storageVersions: 'Storage 版本与恢复' },
      observabilityPlane: '项目可观测性', observabilityPlaneNote: '仅展示 W-Radar 项目发布、部署、运行证据和有界遥测聚合；绝不暴露原始日志或平台控制权限。', observabilityLoading: '正在加载项目可观测性…', runtimeHealth: '运行健康', healthy: '健康', degraded: '异常', releasesDeployments: '发布 · 部署', errorsLatencyLogs: '错误 · 延迟 · 日志事件', openWMonitor: '在 W-Monitor 打开基础设施', wMonitorSeparate: 'W-Monitor 是独立的基础设施能力，拥有独立数据和权限；此链接不会授予访问权。',
      membersLabel: '位成员', invitationsLabel: '个邀请', functionsLabel: '个 Functions', logsLabel: '条日志', restoreVersion: '恢复',
      databaseBackups: '数据库备份与恢复', backupBackend: '恢复后端', backups: '个备份', noBackups: '此项目当前没有可用备份。', restoreBackup: '恢复备份', restoreUnavailable: '为此项目配置恢复后端后才能执行恢复。', confirmRestore: '确认破坏性数据库恢复', typeRestore: '请输入完整项目 ID，以确认当前项目和精确备份。', restoreLoading: '正在使用新的项目授权启动可审计恢复…', restoreDone: '恢复操作已受理；请刷新备份清单与可观测性确认完成。', restoreFailed: '恢复被拒绝、不可用，或返回了无效操作。',
      capabilities: '项目能力', capabilitiesNote: 'W-ID 会自动加载该成员项目的浏览器安全 Connect 契约，无需粘贴密钥。', noCapabilityProject: '没有可用于能力发现的成员项目。', selectProject: '成员项目', notVerified: '尚未验证',
      closePanel: '关闭', previousPage: '上一页', nextPage: '下一页', pageLabel: '页码',
      publishableKey: 'W_PUBLISHABLE_KEY', keyMemoryNote: '仅用于本次请求并保存在 React 内存中；不会写入存储、日志、URL 或分析事件。', discover: '发现能力', discovering: '正在发现…', clearKey: '清除密钥', available: '可用', unavailable: '不可用', openCapability: '打开端点', discoveryPrompt: '正在从 W-ID 加载已认证的 Project Connect 契约…', discoveryReady: '已由 W-ID 验证；页面仅展示白名单能力状态、密钥元数据和 HTTPS 链接。',
      publishableKeys: '发布密钥', issuePublishableKey: '签发 Web 密钥', noPublishableKeys: '当前没有有效的发布密钥。请签发一个密钥以连接浏览器应用。', rotateKey: '轮换', revokeKey: '撤销', oneTimeKey: '请立即复制此 W_PUBLISHABLE_KEY', oneTimeKeyWarning: '完整值仅展示一次并只保存在 React 内存中；离开或刷新页面后即消失。', keyActionError: '项目密钥操作失败，或你的 Workspace 角色无权执行此操作。',
      connectConfiguration: '项目连接配置', connectConfigurationNote: '将这两个浏览器安全值复制到应用中。W-ID 只会向有效项目成员恢复发布密钥；服务器密钥绝不会在此返回。',
      projectDataTitle: '项目数据', projectDataLoading: '正在加载已授权的项目数据…', authUsers: '认证用户', users: '位用户', active: '活跃', blocked: '已封禁', unlockProjectData: '解锁 15 分钟', lockProjectData: '立即锁定', consoleCredentialNote: '数据库与存储会为每次操作将当前 W-ID 会话交换为不超过 5 分钟的精确项目访问令牌；控制台密钥、令牌和行草稿都只保存在 React 内存中。', databaseExplorer: '数据库', tables: '张表', migrations: '次迁移', enabled: '已启用', disabled: '未启用', storageExplorer: '对象存储', buckets: '个桶', publicBucket: '公开', publicBucketHelp: '仅已认证的项目成员可读；分享文件请使用签名链接。', privateBucket: '私有', tablePreview: '受 RLS 保护的行预览', rows: '行', noRows: '此表没有当前账号可见的行。', objectBrowser: '对象浏览器', objects: '个对象', noObjects: '此存储桶没有当前账号可见的对象。', addRow: '新增行', editRow: '编辑', deleteRow: '删除', rowJson: '带类型的 JSON 字段', rowJsonHelp: '请输入一个 JSON 对象；字符串、数字、布尔值、null、对象和数组会保持原类型。不接受 SQL，项目策略会拒绝修改 owner 和主键。', saveRow: '保存行', cancelRow: '取消', confirmDeleteRow: '确认删除', confirmDeleteRowHelp: '删除会把当前可见行快照作为乐观并发前置条件，并继续受 RLS 保护。', rowMutationLoading: '正在使用新的项目授权保存…', rowMutationDone: '行变更已提交。', rowMutationInvalid: '请输入字段数和大小限制内的非空有效 JSON 对象。', rowMutationStale: '此行在加载后已发生变化，请重新加载后再试。', reloadRows: '重新加载行', rowMutationUnsupported: 'W-DB 边缘尚未提供安全行变更方法，未执行任何修改。', rowMutationFailed: '行变更被拒绝或项目服务当前不可用。', rowIdentityRequired: '此行没有受支持的 id 值，因此不能编辑或删除。', projectKeyRequired: '解锁项目数据后，将创建一个仅保存在内存中的短期控制台会话。', projectDataAuthError: 'W-ID 会话已过期，请重新认证。', projectDataForbidden: '当前项目或权限范围拒绝访问。', projectDataNetworkError: '项目服务暂时无法访问。', projectDataInvalid: '项目服务返回了无效数据。',
      storageUploadPrefix: '目标文件夹（可选）', storageUploadSource: '上传来源', storageUploadFiles: '文件', storageUploadFolder: '文件夹', storageUploadFolderNote: '最多选择 100 个文件，总大小不超过 64 MiB。保留所选文件夹名称和子目录，不上传空目录。文件依次上传。', storageUploadTargets: '上传目标路径', storageUploadReplace: '替换已有文件', storageUploadReplaceNote: '默认保留同名文件。勾选后，仅覆盖未完成的目标；重试会跳过已确认成功的文件。若上传结果未知，请先检查对象再允许替换。', storageUploadNote: '最多选择 100 个文件，总大小不超过 64 MiB。单文件使用完整对象路径；多文件保留原文件名，放入目标文件夹。文件依次上传。', storageRetryUploads: '重试未完成文件', storageStopUploads: '停止上传', storageUploadProgress: '上传进度', storageUploadedFiles: '个文件已上传', storageUploadInvalid: '请选择 1–100 个文件，总大小不超过 64 MiB，且目标路径有效、不重复。尚未开始上传。', storageUploadFailed: '部分上传失败。成功的文件会保留；重试仅发送未完成的文件。', storageUploadStopped: '已停止等待并停止队列。进行中的上传可能已完成；成功的文件会保留。', storageUploadFailureUnknown: '未能确认上传结果，请检查对象后再重试。', storageUploadRejections: { object_already_exists: '此路径已有文件。确实需要覆盖时，再允许替换。', object_too_large: '此文件超过了桶的单文件大小限制。', bucket_quota_exceeded: '此次上传将超过桶的存储配额。', mime_type_not_allowed: '此文件的内容类型不在桶的允许范围内。' }, storageUploadStates: { pending: '等待上传', uploading: '正在上传', done: '已上传', error: '失败', cancelled: '结果未知' },
      storageSelectObject: '选择对象', storageSelectPage: '选择当前页', storageClearSelection: '清空选择', storageDeleteSelected: '删除所选对象', storageConfirmBatchDelete: '确认删除所选对象', storageBatchDeleteNote: '仅删除本页选中的当前对象（最多 50 个），逐项执行，遇到首个失败即停止；已确认删除保持完成。本操作不删除保留的历史版本。', storageBatchDeleteConfirmation: '输入完整桶 ID，确认删除以下所选对象。', storageBatchDeleteProgress: '所选对象删除结果', storageStopDeletes: '停止删除队列', storageBatchDeleteUnknown: '删除结果未知。请先刷新对象列表，再重新选择并确认删除；服务器可能已经完成该操作。', storageDeleteStates: { pending: '尚未执行', deleting: '正在删除', deleted: '已确认删除', error: '删除失败', unknown: '结果未知' },
      storageExportJson: '导出当前对象页 JSON', storageExportCsv: '导出当前对象页 CSV', storageExportNote: '仅下载已加载页（最多 50 个对象），附带存储桶、已应用前缀、偏移量与获取时间；不是完整存储桶清单。CSV 会转义电子表格公式形式的文本。', storageExportFailed: '无法生成对象页下载，已加载的对象仍然可用。', storageObjectPrefix: '对象路径前缀', storageSearchObjects: '搜索对象', storageClearSearch: '清除筛选', storageObjectPages: '对象分页', storageObjectPagingNote: '每页最多 50 个对象。上传或删除可能改变分页位置；刷新可查看当前结果。', storageRefreshInventory: '刷新存储桶列表', storageManagementUnknown: '变更结果未知。请刷新存储桶列表后再重试；服务端可能已经完成存储桶或保留规则变更。', storageManagement: '存储管理', storageManagementNote: '这里只管理当前项目的桶与对象。每次操作都会交换新的 W-ID 精确项目令牌；文件直接发送给 W-Storage，任何提供商凭证都不会进入浏览器状态。', createBucket: '创建存储桶', editBucket: '编辑存储桶', deleteBucket: '删除存储桶', noBuckets: '尚无存储桶。', bucketId: '存储桶 ID', bucketName: '显示名称', fileSizeLimit: '单文件字节上限（可选）', quotaBytes: '存储桶字节配额（可选）', mimeTypes: '允许的 MIME 类型，逗号分隔（可选）', saveBucket: '保存存储桶', typeBucketId: '请输入完整存储桶 ID，以删除这个空桶。', refreshStorage: '刷新', quota: '配额', unlimited: '不限', remaining: '剩余', uploadObject: '上传文件', objectPath: '对象路径', file: '文件', storageCopyObject: '复制对象', storageMoveObject: '移动对象', storageTransferDestinationBucket: '目标桶', storageTransferDestinationPath: '目标对象路径', storageTransferConfirm: '输入完整源对象路径以移动', storageTransferNote: '支持复制或移动不超过 64 MiB 的对象，目标必须是新对象。移动时先写入目标，再删除源对象；失败可能留下两个对象。请求不会自动重试，请先检查两边状态再决定是否重试。', storageTransferAcknowledged: '转移已确认：', storageTransferInspected: '已检查转移位置，未重新执行操作：', storageTransferSource: '源对象', storageTransferDestination: '目标对象', storageTransferPresent: '存在', storageTransferAbsent: '不存在', storageTransferUnknown: '转移结果未知。再次写入前，请刷新桶清单以检查源对象和目标对象。移动可能留下两个对象。', downloadObject: '下载（签名 URL）', deleteObject: '删除对象', versions: '版本', storageVersionPath: '待恢复对象路径', storageFindVersions: '查找保留版本', storageVersionNote: '可输入完整对象路径查找，包括已删除的对象。恢复需要尚未清理的保留版本，并会替换当前对象；需要 Provider 支持。', storageVersionLimit: '仅显示最近 100 个保留版本。', storageRestoreUnknown: '结果未知。重试前请刷新对象与版本，服务端可能已完成修改。', storageRestoredVersion: '已恢复为新版本：', typeObjectPath: '请输入完整对象路径以确认删除。', typeVersionId: '请输入完整版本 ID 以确认恢复。', storageUploadLinkTitle: '签名上传链接', storageUploadLinkPath: '上传目标路径', storageUploadLinkOverwrite: '允许替换这个文件', storageUploadLinkNote: '持有链接的人可在最长两小时内向此路径上传，仍受桶的文件限制。新链接不会撤销旧链接。', storageUploadLinkCreate: '生成上传链接', storageUploadLinkFailed: '无法签发上传链接。请检查路径和权限；当前后端可能尚不支持签名上传。', storageUploadLinkReady: '上传链接已就绪', storageUploadLinkCreateOnly: '仅允许创建：不会替换已有文件。', storageUploadLinkUrl: '上传 URL', storageUploadLinkUse: '使用 PUT 请求发送文件字节并设置 Content-Type。上传后刷新对象列表；清除此视图不会撤销链接。', storageUploadLinkCopy: '复制上传链接', storageUploadLinkClear: '清除上传链接', storageUploadLinkCopied: '已复制上传链接。', storageUploadLinkCopyFailed: '无法复制链接，请选中上方 URL 手动复制。', storageUploadLinkExpired: '分享前请重新生成上传链接。', storagePreviewImage: '预览图片', storageCloseImagePreview: '关闭图片预览', storageImagePreviewLoading: '正在加载图片…', storageImagePreviewFailed: '无法加载图片。请重新签发链接后重试，或下载文件。', signedUrlTitle: '签名下载链接', signedUrlRemaining: '剩余秒数', signedUrlExpired: '下载链接已失效，请重新签发后下载。', signedUrlCopy: '复制下载链接', signedUrlRenew: '重新签发下载链接', signedUrlCopied: '已复制下载链接。', signedUrlCopyFailed: '无法复制链接，仍可使用下载入口。', signedUrlShareNote: '持有此链接的人可在失效前下载该对象；复制不会延长有效期。', signedUrlExpires: '签名 URL 失效时间', signedUrlExpiry: '签名 URL 有效期', signedUrlExpiryNote: 'W-Storage 允许 1–3600 秒。控制台仅提供白名单时长；默认仍为 5 分钟。', storageCapabilities: '存储能力', storageLifecycle: '生命周期与保留策略', storageLifecycleNote: '仅当 W-Storage discovery 声明支持 lifecycle 时才展示保留策略；不支持的部署保持明确不可用，绝不虚构规则。', storageLifecycleUnsupported: '生命周期策略不可用', storageLifecycleUnsupportedNote: '当前项目的 W-Storage discovery 报告 lifecycle=false，或生命周期端点不可用。未虚构任何保留规则。', noLifecycleRules: '此存储桶尚无生命周期规则。', editLifecycleRule: '新增或编辑规则', lifecycleRuleId: '规则 ID', lifecyclePrefix: '对象前缀（可选）', lifecycleExpirationDays: '当前版本过期天数（可选）', lifecycleNoncurrentDays: '非当前版本过期天数（可选）', saveLifecycleRule: '保存生命周期规则', clearLifecycle: '清除全部生命周期规则', typeBucketIdLifecycle: '请输入完整存储桶 ID，以清除全部生命周期规则。', storageAudit: '有界存储审计', auditEvents: '条事件', auditTruncated: '仅显示最新 200 条', storageInvalid: '请检查字段限制和完整确认文本；未执行任何变更。', storageFailed: 'W-Storage 拒绝了操作或返回了无效响应。', storageDone: '存储操作已完成，并已刷新有界视图。',
      discoveryErrors: { key: '请输入有效的 wid_pk_ publishable key。', auth: 'W-ID 认证缺失或已过期，请重新登录后重试。', forbidden: 'W-DB 拒绝了该项目或密钥，请确认有效 Workspace 成员关系及项目密钥。', network: '无法连接 W-DB，可能是网络或浏览器 CORS 错误；请清除密钥后重试。', invalid: 'W-DB 返回的项目 discovery 不匹配或契约无效。' },
      endUserPlane: '我使用的应用', endUserPlaneNote: '使用某个 SaaS 不代表加入它的开发团队。', noApps: '尚无应用关系。', logins: '次登录', searchApps: '搜索应用', searchAppsPlaceholder: '应用名称或 Client ID', noAppResults: '没有符合搜索条件的应用。',
    },
    meta: {
      homeTitle: 'W Platform — 舰队框架与建设路线',
      homeDescription: '查看 W 的舰队框架、共享能力和产品建设路线。使用 W-ID 登录后查看总览。',
      productTitleSuffix: 'W Platform',
    },
  },
};

export function dict(lang: Lang): Dict {
  return DICTS[lang];
}

/**
 * Build a localized href from a language-independent route path.
 * routePath is always the canonical English path: '/', '/w-id', '/products/w-id'.
 */
export function localizedHref(routePath: string, lang: Lang): string {
  if (lang === DEFAULT_LANG) return routePath;
  if (routePath === '/') return '/zh';
  return '/zh' + routePath;
}
