import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, isValidUrl, isWeakMetadata, updateUrlData } from "@/lib/url-store"
import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, force } = body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required and must be a string' }, 
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return NextResponse.json(
        { error: 'URL cannot be empty' }, 
        { status: 400 }
      );
    }

    // Validate URL format
    if (!isValidUrl(trimmedUrl)) {
      return NextResponse.json(
        { 
          error: 'Invalid URL format. Please include a valid domain (e.g., https://example.com or example.com)' 
        }, 
        { status: 400 }
      );
    }

    // Normalize URL for consistency
    let normalizedUrl: string;
    try {
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + trimmedUrl;
      } else {
        normalizedUrl = trimmedUrl;
      }
      
      const urlObj = new URL(normalizedUrl);
      normalizedUrl = urlObj.toString();
      
      // Remove trailing slash for consistency
      if (normalizedUrl.endsWith('/') && urlObj.pathname === '/') {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
    } catch (error) {
      console.error('URL normalization error:', error);
      return NextResponse.json(
        { error: 'Invalid URL format' }, 
        { status: 400 }
      );
    }

    console.log(`Processing URL: ${normalizedUrl}`);

    // Check for existing short code
    try {
      const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
      
      if (existingShortCode && !force) {
        console.log(`Found existing short code: ${existingShortCode}`);
        const existingData = await getUrl(existingShortCode);
        
        if (existingData) {
          // Optionally refresh weak metadata
          if (isWeakMetadata(existingData)) {
            try {
              console.log('Refreshing weak metadata for existing URL');
              const freshMetadata = await fetchPageMetadata(normalizedUrl);
              const updatedData = await updateUrlData(existingShortCode, freshMetadata);
              
              return NextResponse.json({
                shortCode: existingShortCode,
                metadata: updatedData || existingData
              });
            } catch (refreshError) {
              console.warn('Failed to refresh metadata:', refreshError);
              // Return existing data even if refresh fails
            }
          }
          
          return NextResponse.json({
            shortCode: existingShortCode,
            metadata: existingData
          });
        }
      }
    } catch (error) {
      console.warn('Error checking existing URL:', error);
      // Continue with creating new short code
    }

    // Create new short code
    let shortCode: string;
    let metadata: any;

    try {
      shortCode = await createShortCode(normalizedUrl);
      metadata = await getUrl(shortCode);
      
      console.log(`Created short code: ${shortCode}`);
      
      return NextResponse.json({
        shortCode,
        metadata
      });
      
    } catch (createError) {
      console.error('Error creating short code:', createError);
      
      // Return specific error messages
      if (createError instanceof Error) {
        if (createError.message.includes('Invalid URL')) {
          return NextResponse.json(
            { error: 'The provided URL is not valid' },
            { status: 400 }
          );
        }
        if (createError.message.includes('Failed to generate')) {
          return NextResponse.json(
            { error: 'Unable to generate short code. Please try again.' },
            { status: 500 }
          );
        }
        if (createError.message.includes('Failed to save')) {
          return NextResponse.json(
            { error: 'Unable to save shortened URL. Please try again.' },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to create shortened URL. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unhandled error in shorten API:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
      },
      { status: 500 }
    );
  }
}