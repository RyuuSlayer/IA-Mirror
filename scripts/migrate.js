const fs = require('fs')
const path = require('path')
const debug = require('debug')('ia-mirror:migrate')

// Map of media types to folder names
const MEDIA_TYPE_FOLDERS = {
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

// Get cache directory from environment or use default
const cacheDir = process.env.CACHE_DIR || 'S:\\Internet Archive'

// Create cache directory if it doesn't exist
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true })
}

// Function to move directory recursively
function moveDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    debug(`Source directory does not exist: ${source}`)
    return
  }

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true })
  }

  const items = fs.readdirSync(source)
  for (const item of items) {
    const sourcePath = path.join(source, item)
    const destPath = path.join(destination, item)

    if (fs.statSync(sourcePath).isDirectory()) {
      moveDirectory(sourcePath, destPath)
    } else {
      if (!fs.existsSync(destPath)) {
        fs.renameSync(sourcePath, destPath)
      }
    }
  }

  // Try to remove the source directory if it's empty
  try {
    fs.rmdirSync(source)
  } catch (error) {
    debug(`Could not remove source directory ${source}: ${error.message}`)
  }
}

// Migrate items from old media type folders to new ones
async function migrateItems() {
  debug('Starting migration...')
  debug('Cache directory:', cacheDir)

  // Check all potential old media type folders
  for (const [oldType, newFolder] of Object.entries(MEDIA_TYPE_FOLDERS)) {
    const oldPath = path.join(cacheDir, oldType)
    const newPath = path.join(cacheDir, newFolder)

    if (fs.existsSync(oldPath)) {
      debug(`Found old media type folder: ${oldType}`)
      debug(`Moving items from ${oldPath} to ${newPath}`)

      try {
        moveDirectory(oldPath, newPath)
        debug(`Successfully migrated ${oldType} to ${newFolder}`)
      } catch (error) {
        console.error(`Error migrating ${oldType}:`, error)
      }
    }
  }

  debug('Migration completed')
}

// Run migration
migrateItems().catch(console.error)
