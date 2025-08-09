import fs from 'fs'
import path from 'path'
import { getConfig } from './config'
import { readJsonFile } from './utils'
import debug from 'debug'

const log = debug('ia-mirror:lib:localItems')

// Map of media types to folder names
export const MEDIA_TYPE_FOLDERS: { [key: string]: string } = {
  'texts': 'books',
  'movies': 'videos',
  'audio': 'audio',
  'software': 'software',
  'image': 'images',
  'etree': 'concerts',
  'data': 'data',
  'web': 'web',
  'collection': 'collections',
  'account': 'accounts'
}

// Reverse map for folder to media type
export const FOLDER_TO_MEDIA_TYPE = Object.entries(MEDIA_TYPE_FOLDERS).reduce((acc, [type, folder]) => {
  acc[folder] = type
  return acc
}, {} as { [key: string]: string })

interface ItemInfo {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  downloads?: number
  collection?: string[]
  downloadDate: string
  thumbnailFile?: string
}

interface GetLocalItemsParams {
  mediatype?: string
  sort?: string
  hideDownloaded?: boolean
  search?: string
  page?: number
  pageSize?: number
  showAll?: boolean
}

export async function getLocalItems({
  mediatype,
  sort = '-downloads',
  hideDownloaded = false,
  search = '',
  page = 1,
  pageSize = 20,
  showAll = false
}: GetLocalItemsParams): Promise<{ items: ItemInfo[], total: number }> {
  const config = await getConfig()
  const localItems: ItemInfo[] = []

  // Get all media type folders
  const folders = Object.values(MEDIA_TYPE_FOLDERS)
  
  // If mediatype is specified, only search in that folder
  const foldersToSearch = mediatype 
    ? [MEDIA_TYPE_FOLDERS[mediatype]].filter(Boolean)
    : folders

  // Search through each folder
  for (const folder of foldersToSearch) {
    const folderPath = path.join(config.cacheDir, folder)
    
    if (fs.existsSync(folderPath)) {
      const items = fs.readdirSync(folderPath)
      
      for (const item of items) {
        const itemPath = path.join(folderPath, item)
        const metadataPath = path.join(itemPath, 'metadata.json')
        
        if (fs.existsSync(metadataPath)) {
          const metadata = readJsonFile(metadataPath)
          
          if (!metadata) {
            log('Failed to parse metadata for', item)
            continue
          }
          
          try {
            
            // Find a suitable thumbnail file
            let thumbnailFile = null
            if (metadata.files) {
              for (const file of metadata.files) {
                if (file.name.toLowerCase().endsWith('.jpg') ||
                  file.name.toLowerCase().endsWith('.jpeg') ||
                  file.name.toLowerCase().endsWith('.png')) {
                  thumbnailFile = file.name
                  break
                }
              }
            }

            const itemData = {
              identifier: item,
              title: metadata.metadata?.title || item,
              description: metadata.metadata?.description,
              mediatype: FOLDER_TO_MEDIA_TYPE[folder],
              creator: metadata.metadata?.creator,
              date: metadata.metadata?.date,
              downloads: metadata.metadata?.downloads,
              collection: metadata.metadata?.collection,
              downloadDate: fs.statSync(metadataPath).mtime.toISOString(),
              thumbnailFile
            }

            // Always add the item if there's no search query
            // Otherwise, check if it matches the search terms
            if (!search || 
                itemData.title.toLowerCase().includes(search.toLowerCase()) ||
                itemData.description?.toLowerCase().includes(search.toLowerCase()) ||
                itemData.creator?.toLowerCase().includes(search.toLowerCase()) ||
                itemData.mediatype?.toLowerCase().includes(search.toLowerCase())) {
              localItems.push(itemData)
            }
          } catch (error) {
            log('Error reading metadata for', item, ':', error)
          }
        }
      }
    }
  }

  // Sort items
  const sortedItems = localItems.sort((a, b) => {
    switch (sort) {
      case '-downloads':
        return (b.downloads || 0) - (a.downloads || 0)
      case 'downloads':
        return (a.downloads || 0) - (b.downloads || 0)
      case '-date':
        return new Date(b.downloadDate).getTime() - new Date(a.downloadDate).getTime()
      case 'date':
        return new Date(a.downloadDate).getTime() - new Date(b.downloadDate).getTime()
      case 'title':
        return a.title.localeCompare(b.title)
      case '-title':
        return b.title.localeCompare(a.title)
      default:
        return 0
    }
  })

  // If showAll is true, return all items, otherwise paginate
  const total = sortedItems.length
  if (showAll) {
    return { items: sortedItems, total }
  }

  const start = (page - 1) * pageSize
  const end = start + pageSize
  return { items: sortedItems.slice(start, end), total }
}
