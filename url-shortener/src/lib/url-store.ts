console.log('Environment check:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
  supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not set',
  vercelEnv: process.env.VERCEL ? 'Vercel' : 'Local'
});

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your Vercel environment variables.');
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface UrlData {
  originalUrl: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  createdAt: number;
  [key: string]: unknown;
}

function normalizeUrl(url: string): string {
  try {
    let urlToNormalize = url;
    if (!urlToNormalize.startsWith('http://') && !urlToNormalize.startsWith('https://')) {
      urlToNormalize = 'https://' + urlToNormalize;
    }
    
    const urlObj = new URL(urlToNormalize);
    let normalized = urlObj.toString();
    
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    const hostname = urlObj.hostname.toLowerCase();
    normalized = normalized.replace(urlObj.hostname, hostname);
    
    return normalized;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url.trim();
  }
}

export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  const normalizedUrl = normalizeUrl(url);

  const { data: existingUrl } = await supabase
    .from('urls')
    .select('short_code')
    .eq('original_url', normalizedUrl)
    .single();

  if (existingUrl) {
    return existingUrl.short_code;
  }

  let shortCode: string;
  let attempts = 0;
  let isUnique = false;

  do {
    shortCode = Math.random().toString(36).substring(2, 10);
    attempts++;
    
    if (attempts > 10) {
      throw new Error('Failed to generate unique short code');
    }

    // Check if short code exists
    const { data: existing } = await supabase
      .from('urls')
      .select('short_code')
      .eq('short_code', shortCode)
      .single();

    isUnique = !existing;
  } while (!isUnique);

  // Insert into database
  const { error } = await supabase
    .from('urls')
    .insert({
      short_code: shortCode,
      original_url: url,
      title: metadata?.title,
      description: metadata?.description,
      image: metadata?.image,
      favicon: metadata?.favicon,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Supabase insert error:', error);
    throw new Error('Failed to create short URL');
  }

  return shortCode;
}

export async function getUrl(shortCode: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('urls')
      .select('original_url')
      .eq('short_code', shortCode)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return null;
    }

    return data?.original_url || null;
  } catch (error) {
    console.error('Error getting URL:', error);
    return null;
  }
}

export async function getUrlData(shortCode: string): Promise<UrlData | undefined> {
  try {
    const { data, error } = await supabase
      .from('urls')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (error || !data) {
      console.error('Supabase error:', error);
      return undefined;
    }

    return {
      originalUrl: data.original_url,
      title: data.title,
      description: data.description,
      image: data.image,
      favicon: data.favicon,
      createdAt: new Date(data.created_at).getTime()
    };
  } catch (error) {
    console.error('Error getting URL data:', error);
    return undefined;
  }
}

export async function getAllUrls(): Promise<{ shortCode: string; originalUrl: string }[]> {
  try {
    const { data, error } = await supabase
      .from('urls')
      .select('short_code, original_url')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    return data.map(item => ({
      shortCode: item.short_code,
      originalUrl: item.original_url
    }));
  } catch (error) {
    console.error('Error getting all URLs:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, metadata } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(url);
    const shortCode = await createShortCode(normalizedUrl, metadata);
    
    return NextResponse.json({ 
      shortCode,
     shortUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/${shortCode}`
    });
  } catch (error) {
    console.error('Error creating short URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}