import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'

export function formatDescription(text: string): string {
  if (!text) return '';
  
  // First, decode any HTML entities that might be present
  let formatted = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Replace <br /> tags with newlines
  formatted = formatted.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove other HTML-like tags
  formatted = formatted.replace(/<[^>]+>/g, '');
  
  // Encode HTML entities to prevent XSS
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Split into paragraphs and preserve line breaks
  return formatted.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
}

/**
 * Format description for safe HTML rendering with preserved formatting
 * This function sanitizes HTML but allows safe formatting tags
 */
export function formatDescriptionForHTML(text: string): string {
  if (!text) return '';
  
  // First, decode any HTML entities that might be present
  let formatted = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Remove dangerous tags and their content
  formatted = formatted.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  formatted = formatted.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  formatted = formatted.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');
  formatted = formatted.replace(/<embed[^>]*>/gi, '');
  formatted = formatted.replace(/<link[^>]*>/gi, '');
  formatted = formatted.replace(/<meta[^>]*>/gi, '');
  
  // Remove dangerous attributes from all tags
  formatted = formatted.replace(/(<[^>]+)\s+(on\w+|javascript:|data:|vbscript:)[^>]*/gi, '$1');
  
  // Allow safe formatting tags: span, b, i, strong, em, br, p, div
  // Remove any other tags but keep their content
  formatted = formatted.replace(/<(?!\/?(?:span|b|i|strong|em|br|p|div)(?:\s[^>]*)?\s*>)[^>]+>/gi, '');
  
  // Clean up any remaining dangerous attributes in allowed tags
  formatted = formatted.replace(/(<(?:span|b|i|strong|em|br|p|div)[^>]*?)\s+(on\w+|javascript:|data:|vbscript:)[^>]*/gi, '$1');
  
  return formatted;
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
    
    // Check file size to determine reading strategy
    const stats = fs.statSync(filePath);
    
    // For small files (< 1MB), use synchronous reading for better performance
    if (stats.size < 1024 * 1024) {
      const content = fs.readFileSync(filePath, 'utf8');
      return safeJsonParse(content, filePath);
    }
    
    // For larger files, log a warning and still use sync (async version available separately)
    console.warn(`Large JSON file detected (${stats.size} bytes): ${filePath}. Consider using readJsonFileStreaming for better memory efficiency.`);
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
