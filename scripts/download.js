const fs = require('fs')
const path = require('path')
const https = require('https')
const debug = require('debug')('ia-mirror:download')

// Load config
function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config.json')
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'))
    }
  } catch (error) {
    console.warn('Could not load config, using defaults:', error.message)
  }
  return { skipDerivativeFiles: false }
}

// Check if a file is a derivative
function isDerivativeFile(filename) {
  const derivativePatterns = [
    /_thumb\./i,      // Thumbnails
    /_itemimage\./i,  // Item images
    /__ia_thumb\./i,  // IA thumbnails
    /_files\./i,      // File listings
    /_meta\./i,       // Metadata files
    /\.gif$/i,        // GIF versions
    /\b(thumb|small|medium|large)\d*\./i,  // Size variants
    /_spectrogram\./i // Audio spectrograms
  ]
  
  return derivativePatterns.some(pattern => pattern.test(filename))
}

// Check if file is derivative based on metadata
function isDerivativeFromMetadata(file) {
  return file.source === 'derivative' || (file.original !== undefined && file.original !== '')
}

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

// Get command line arguments
const [,, identifier, cacheDir, mediaType = 'other', targetFile] = process.argv

if (!identifier || !cacheDir) {
  console.error('Usage: node download.js <identifier> <cacheDir> [mediaType] [targetFile]')
  process.exit(1)
}

// Sanitize file paths to prevent directory traversal attacks
function sanitizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path')
  }
  
  // Remove any path traversal attempts
  const sanitized = filePath
    .replace(/\.\./g, '') // Remove .. sequences
    .replace(/[\/\\]+/g, '/') // Normalize path separators
    .replace(/^[\/\\]+/, '') // Remove leading slashes
    .replace(/[\/\\]+$/, '') // Remove trailing slashes
  
  // Additional validation
  if (sanitized.includes('..') || sanitized.startsWith('/') || sanitized.startsWith('\\')) {
    throw new Error('Path traversal attempt detected')
  }
  
  return sanitized
}

// Validate that a file path is safe to use
function validateSafePath(basePath, filePath) {
  const resolvedBase = path.resolve(basePath)
  const resolvedPath = path.resolve(basePath, filePath)
  
  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected')
  }
  
  return resolvedPath
}

console.log('Starting download script with:')
console.log('- Identifier:', identifier)
console.log('- Cache directory:', cacheDir)
console.log('- Media type:', mediaType)
console.log('- Target file:', targetFile || '(all files)')

// Create cache directory if it doesn't exist
if (!fs.existsSync(cacheDir)) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true })
    console.log('Created cache directory:', cacheDir)
  } catch (error) {
    console.error('Failed to create cache directory:', error)
    process.exit(1)
  }
}

// Ensure the path exists and create all necessary directories
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath)
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log('Downloading file:', { url, destPath })
    
    // Create directory if it doesn't exist
    ensureDirectoryExists(destPath)
    
    // Create write stream
    const file = fs.createWriteStream(destPath)
    let totalBytes = 0
    let downloadedBytes = 0
    let lastProgressUpdate = Date.now()

    console.log(`Downloading ${url} to ${destPath}`)
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`Following redirect to: ${response.headers.location}`)
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`))
        return
      }

      const contentLength = response.headers['content-length'] || '0'
      totalBytes = parseInt(contentLength, 10) || 0

      response.pipe(file)

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        // Log progress every second
        const now = Date.now()
        if (now - lastProgressUpdate >= 1000) {
          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100)
            console.log(`Progress: ${progress}%`)
          } else {
            console.log(`Downloaded ${downloadedBytes} bytes`)
          }
          lastProgressUpdate = now
        }
      })

      file.on('finish', () => {
        file.close()
        console.log(`Download completed: ${destPath}`)
        resolve()
      })

      file.on('error', (err) => {
        console.error(`Error writing file: ${err}`)
        fs.unlink(destPath, () => reject(err))
      })
    })

    request.on('error', (err) => {
      console.error(`Error downloading file: ${err}`)
      reject(err)
    })
  })
}

async function fetchWithRedirects(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`Following redirect to: ${response.headers.location}`)
        fetchWithRedirects(response.headers.location)
          .then(resolve)
          .catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`))
        return
      }

      let data = ''
      response.on('data', chunk => data += chunk)
      response.on('end', () => resolve(JSON.parse(data)))
    })

    request.on('error', reject)
  })
}

async function downloadItem() {
  try {
    // Get item metadata
    const metadataUrl = `https://archive.org/metadata/${identifier}`
    console.log(`Fetching metadata from ${metadataUrl}`)
    const metadata = await fetchWithRedirects(metadataUrl)
    console.log('Got metadata:', JSON.stringify(metadata, null, 2))

    // Use the media type from command line or metadata
    const itemMediaType = mediaType !== 'other' ? mediaType : metadata.metadata?.mediatype
    const folderName = MEDIA_TYPE_FOLDERS[itemMediaType] || 'other'
    const itemDir = path.join(cacheDir, folderName, identifier)
    
    console.log(`Using media type: ${itemMediaType}`)
    console.log(`Using folder: ${folderName}`)
    console.log(`Item directory: ${itemDir}`)
    
    // Create item directory
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true })
    }

    // Save metadata
    const metadataPath = path.join(itemDir, 'metadata.json')
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    // Get the specific file we want to download from command line args
    if (targetFile) {
      console.log(`Looking for specific file: ${targetFile}`)
      const file = metadata.files.find(f => f.name === targetFile)
      if (!file) {
        throw new Error(`File ${targetFile} not found in metadata`)
      }

      // Sanitize and validate the target file path
      const sanitizedTargetFile = sanitizePath(targetFile)
      const cleanFileName = sanitizedTargetFile.split('/').pop().replace(/[<>:"/\\|?*]/g, '_')
      const fileUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(targetFile)}`
      const filePath = validateSafePath(itemDir, sanitizedTargetFile)
      
      // Create subdirectories if needed
      const fileDir = path.dirname(filePath)
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true })
      }

      // Skip if file already exists and has correct size
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        if (stats.size === file.size) {
          console.log(`File already exists with correct size: ${cleanFileName}`)
          process.exit(0)
        }
        console.log(`File exists but size mismatch, re-downloading: ${cleanFileName}`)
      }

      console.log(`Downloading ${cleanFileName} from ${fileUrl}`)
      await downloadFile(fileUrl, filePath)
      console.log(`Successfully downloaded ${cleanFileName}`)
    } else {
      // Download all files if no specific file is specified
      if (metadata.files) {
        // Load config to check derivative file settings
        const config = loadConfig()
        const skipDerivativeFiles = config.skipDerivativeFiles || false
        
        for (const file of metadata.files) {
          let sanitizedFileName, cleanFileName, fileUrl, filePath
          
          try {
            // Sanitize and validate the file path
            sanitizedFileName = sanitizePath(file.name)
            cleanFileName = sanitizedFileName.split('/').pop().replace(/[<>:"/\\|?*]/g, '_')
            fileUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`
            filePath = validateSafePath(itemDir, sanitizedFileName)
          } catch (pathError) {
            console.log(`Skipping file with unsafe path: ${file.name} - ${pathError.message}`)
            continue
          }
          
          // Skip derivative files if the setting is enabled
          if (skipDerivativeFiles) {
            if (isDerivativeFromMetadata(file) || isDerivativeFile(file.name)) {
              console.log(`Skipping derivative file: ${cleanFileName}`)
              continue
            }
          }
          
          // Create subdirectories if needed
          const fileDir = path.dirname(filePath)
          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true })
          }

          // Skip if file already exists and has correct size
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath)
            if (stats.size === file.size) {
              console.log(`File already exists with correct size: ${cleanFileName}`)
              continue
            }
            console.log(`File exists but size mismatch, re-downloading: ${cleanFileName}`)
          }

          console.log(`Downloading ${cleanFileName} from ${fileUrl}`)
          await downloadFile(fileUrl, filePath)
          console.log(`Successfully downloaded ${cleanFileName}`)
        }
      }
    }

    console.log('Download completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Download failed:', error)
    process.exit(1)
  }
}

downloadItem()
