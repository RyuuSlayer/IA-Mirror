// API Response Types
export interface ApiResponse<T = any> {
  success?: boolean
  message?: string
  error?: string
  data?: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

// Metadata Types
export interface MetadataFile {
  name: string
  size: number
  format?: string
  source?: string
  md5?: string
  sha1?: string
  crc32?: string
  mtime?: string
  original?: string
  local?: boolean
}

export interface ItemMetadata {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string | string[]
  date?: string
  collections?: string[]
  downloads?: number
  files?: MetadataFile[]
  thumbnailFile?: string
  subject?: string | string[]
  language?: string | string[]
  publisher?: string
  uploader?: string
  addeddate?: string
  publicdate?: string
  updatedate?: string
  backup_location?: string
}

export interface RawMetadata {
  created: number
  d1: string
  d2: string
  dir: string
  files: MetadataFile[]
  files_count: number
  item_last_updated: number
  item_size: number
  metadata: {
    identifier: string
    title: string
    description?: string
    mediatype?: string
    creator?: string | string[]
    date?: string
    collection?: string | string[]
    downloads?: number
    subject?: string | string[]
    language?: string | string[]
    publisher?: string
    uploader?: string
    addeddate?: string
    publicdate?: string
    updatedate?: string
    [key: string]: any
  }
  reviews?: any[]
  server: string
  uniq: number
  workable_servers: string[]
}

// Search Types
export interface SearchParams {
  query: string
  mediatype?: string
  sort?: string
  page?: number
  size?: number
}

export interface SearchResult {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  downloads?: number
  collection?: string[]
  subject?: string[]
  language?: string[]
  licenseurl?: string
  thumbnailUrl?: string
  downloaded?: boolean
  ignored?: boolean
}

export interface BrowseResponse {
  items: SearchResult[]
  total: number
  page: number
  size: number
  pages: number
}

// Download Types
export interface DownloadItem {
  identifier: string
  title: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  progress?: number
  error?: string
  startedAt?: string
  completedAt?: string
  pid?: number
  file?: string
  destinationPath?: string
  mediatype?: string
  isDerivative?: boolean
}

export interface DownloadRequest {
  identifier: string
  title: string
  mediatype?: string
  file?: string
  action?: string
  isDerivative?: boolean
}

// Settings Types
export interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipHashCheck: boolean
}

// Maintenance Types
export interface MaintenanceIssue {
  identifier: string
  type: 'missing-file' | 'corrupted-file' | 'metadata-mismatch'
  description: string
  error?: string
  path?: string
  size?: number
  item?: string
  file?: string
  expected?: number
  actual?: number
  isDerivative?: boolean
}

export interface MaintenanceResult {
  success: boolean
  message: string
  type?: 'refresh-metadata' | 'verify-files' | 'find-derivatives' | 'derivatives'
  issues?: MaintenanceIssue[]
  error?: string
  deletedFiles?: string[]
  failedFiles?: string[]
  queuedFiles?: string[]
  stats?: {
    totalItems: number
    processedItems: number
    issuesFound: number
  }
}

export interface MaintenanceRequest {
  action: 'refresh-metadata' | 'verify-files' | 'redownload-mismatched' | 'redownload-single' | 'find-derivatives' | 'remove-derivatives' | 'remove-single-derivative'
  identifier?: string
  filename?: string
}

// Local Items Types
export interface LocalItem {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  collection?: string[]
  thumbnailFile?: string
  fileCount?: number
  downloadDate: string
}

// Error Types
export interface ApiError {
  error: string
  status?: number
  details?: any
}

// CSRF Types
export interface CsrfTokenResponse {
  token: string
}

// File Types
export interface FileInfo {
  name: string
  size: number
  type: string
  lastModified: number
  path: string
}

// Media Type Constants
export const MEDIA_TYPES = {
  TEXTS: 'texts',
  MOVIES: 'movies', 
  AUDIO: 'audio',
  SOFTWARE: 'software',
  IMAGE: 'image',
  DATA: 'data',
  WEB: 'web',
  COLLECTION: 'collection',
  ACCOUNT: 'account'
} as const

export type MediaType = typeof MEDIA_TYPES[keyof typeof MEDIA_TYPES]

// Sort Options
export const SORT_OPTIONS = {
  RELEVANCE: 'relevance',
  TITLE: 'title',
  DATE: 'date',
  CREATOR: 'creator',
  DOWNLOADS: 'downloads'
} as const

export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS]

// Health Check Types
export interface HealthCheckService {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  responseTime?: number
  lastChecked: string
  details?: Record<string, any>
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version?: string
  services: HealthCheckService[]
  summary: {
    total: number
    healthy: number
    unhealthy: number
    degraded: number
  }
}