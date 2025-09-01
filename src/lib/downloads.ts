import fs from 'fs'
import path from 'path'
import debug from 'debug'
import type { DownloadItem } from '@/types/api'
import { readJsonFile } from './utils'

const log = debug('ia-mirror:lib:downloads')

const DOWNLOADS_FILE = path.join(process.cwd(), 'downloads.json')

export function readDownloads(): DownloadItem[] {
  const downloads = readJsonFile(DOWNLOADS_FILE)
  return downloads || []
}

export function writeDownloads(downloads: DownloadItem[]): boolean {
  try {
    fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify(downloads, null, 2))
    return true
  } catch (error) {
    console.error('Error writing downloads:', error)
    return false
  }
}

export function findDownloadByIdentifier(identifier: string): DownloadItem | undefined {
  const downloads = readDownloads()
  return downloads.find(d => d.identifier === identifier)
}

export function updateDownloadStatus(identifier: string, updates: Partial<DownloadItem>): boolean {
  const downloads = readDownloads()
  const index = downloads.findIndex(d => d.identifier === identifier)
  
  if (index === -1) {
    return false
  }
  
  downloads[index] = { ...downloads[index], ...updates }
  return writeDownloads(downloads)
}