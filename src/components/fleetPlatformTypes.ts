export type FleetPlatformStatus = 'implemented' | 'partial' | 'verify' | 'planned' | 'outOfScope';

export type FleetPlatformDetail = {
  feature: string;
  reference: string;
  owner: string;
  current: string;
  status: FleetPlatformStatus;
  next: string;
  source: string;
  url: string;
};

export type FleetPlatform = { id: string; label: string; rows: FleetPlatformDetail[] };
