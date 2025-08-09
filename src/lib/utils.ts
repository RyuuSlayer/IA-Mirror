import fs from 'fs'
import { NextResponse } from 'next/server'

export function formatDescription(text: string): string {
  if (!text) return '';
  
  // Replace <br /> tags with newlines
  let formatted = text.replace(/<br\s*\/?>/g, '\n');
  
  // Remove other HTML-like tags
  formatted = formatted.replace(/<[^>]+>/g, '');
  
  // Split into paragraphs
  return formatted.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
}

/**
 * Safely parse JSON with validation
 * @param content - The JSON string content to parse
 * @param filePath - Optional file path for error logging
 * @returns Parsed JSON object or null if invalid
 */
export function safeJsonParse(content: string, filePath?: string): any | null {
  // Validate content
  if (!content || typeof content !== 'string' || content.trim() === '') {
    if (filePath) {
      console.warn(`Empty or invalid content in: ${filePath}`);
    }
    return null;
  }
  
  try {
    const parsed = JSON.parse(content);
    
    // Validate parsed result
    if (!parsed || typeof parsed !== 'object') {
      if (filePath) {
        console.warn(`Invalid JSON structure in: ${filePath}`);
      }
      return null;
    }
    
    return parsed;
  } catch (parseError) {
    if (filePath) {
      console.warn(`JSON parse error in ${filePath}:`, parseError);
    }
    return null;
  }
}

export function readJsonFile(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return safeJsonParse(content, filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// API Response utilities
export function createErrorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function createSuccessResponse(data?: any, message?: string) {
  const response: any = { success: true };
  if (message) response.message = message;
  if (data !== undefined) {
    return NextResponse.json(data);
  }
  return NextResponse.json(response);
}
