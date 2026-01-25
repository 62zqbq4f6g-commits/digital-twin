/**
 * INSCRIPT: Voice Transcription API (Edge Runtime)
 *
 * Phase 16 - Enhancement System
 * Transcribes audio to text using OpenAI Whisper.
 *
 * Target: < 5 seconds for 60s audio
 *
 * Supported formats: WebM, WAV, MP3, M4A, FLAC, OGG
 */

import OpenAI from 'openai';

export const config = { runtime: 'edge' };

// Supported audio MIME types
const SUPPORTED_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/flac',
  'audio/ogg',
  'audio/opus',
  'video/webm', // WebM can be video container with audio
];

// File extension mapping
const TYPE_TO_EXT = {
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'video/webm': 'webm',
};

export default async function handler(req) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
      }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const startTime = Date.now();

  try {
    // Parse form data
    let formData;
    try {
      formData = await req.formData();
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Request must be multipart/form-data' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const audio = formData.get('audio');
    const userId = formData.get('userId');

    // Validation: userId required
    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validation: audio required
    if (!audio) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_AUDIO', message: 'No audio provided' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validation: audio must be a file/blob
    if (!(audio instanceof Blob)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_FORMAT', message: 'Audio must be a file' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validation: check audio type
    const audioType = audio.type || 'audio/webm';
    const isSupported = SUPPORTED_TYPES.some(t => audioType.startsWith(t.split('/')[0]) || audioType === t);

    if (!isSupported && audio.size > 0) {
      // Only reject if we have content but wrong type
      // Some browsers don't set type correctly, so we'll try anyway if there's content
      console.warn(`[transcribe-voice] Unusual audio type: ${audioType}, attempting anyway`);
    }

    // Validation: check file size (max 25MB for Whisper)
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (audio.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'Audio file must be under 25MB' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validation: check minimum size (likely empty)
    if (audio.size < 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_AUDIO', message: 'Audio file is empty or too small' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`[transcribe-voice] Processing audio for user: ${userId}`);
    console.log(`[transcribe-voice] Audio size: ${(audio.size / 1024).toFixed(1)}KB, type: ${audioType}`);

    // Get file extension
    const ext = TYPE_TO_EXT[audioType] || 'webm';

    // Convert to File object for Whisper API
    const file = new File([audio], `recording.${ext}`, { type: audioType });

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json', // Get duration info
    });

    const processingTime = Date.now() - startTime;

    console.log(`[transcribe-voice] Complete in ${processingTime}ms`);
    console.log(`[transcribe-voice] Transcribed ${transcription.text?.length || 0} chars`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcription.text,
        duration: transcription.duration || null,
        language: transcription.language || null,
        processingTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('[transcribe-voice] Error:', error);

    // Check for specific OpenAI errors
    const errorMessage = error.message || 'Transcription failed';
    const isRateLimit = errorMessage.includes('rate limit');
    const isInvalidFile = errorMessage.includes('Invalid file') || errorMessage.includes('format');

    if (isInvalidFile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_FORMAT', message: 'Unsupported audio format' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (isRateLimit) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again' },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'TRANSCRIPTION_FAILED', message: errorMessage },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
