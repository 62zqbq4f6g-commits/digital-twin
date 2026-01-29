/**
 * INSCRIPT: Chunked Audio Upload API (Edge Runtime)
 *
 * Phase 17 - Ambient Listening (TASK-022)
 * Handles chunked uploads for long recordings (up to 2 hours).
 * Each chunk is transcribed immediately with Whisper.
 *
 * Target: < 2 seconds per chunk upload
 *
 * Flow:
 * 1. Client splits recording into 5-minute chunks
 * 2. Each chunk uploaded here → transcribed immediately
 * 3. Transcript stored in session record
 * 4. When all chunks complete → process-ambient.js finalizes
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, handlePreflightEdge } from './lib/cors-edge.js';
import { requireAuthEdge } from './lib/auth-edge.js';

export const config = { runtime: 'edge' };

// Max file size per chunk: 25MB (Whisper limit)
const MAX_CHUNK_SIZE = 25 * 1024 * 1024;

// Supported audio MIME types
const SUPPORTED_TYPES = [
  'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg',
  'audio/mp4', 'audio/m4a', 'audio/flac', 'audio/ogg',
  'video/webm',
];

const TYPE_TO_EXT = {
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'video/webm': 'webm',
};

export default async function handler(req) {
  // CORS headers (restricted to allowed origins)
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight
  const preflightResponse = handlePreflightEdge(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
      }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Auth check - prevent API credit abuse
  const { user, errorResponse } = await requireAuthEdge(req, corsHeaders);
  if (errorResponse) return errorResponse;

  const t0 = Date.now();

  try {
    // Parse multipart form data
    let formData;
    try {
      formData = await req.formData();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Request must be multipart/form-data' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Extract fields
    const audio = formData.get('audio');
    const userId = formData.get('userId');
    const sessionId = formData.get('sessionId');
    const chunkIndex = parseInt(formData.get('chunkIndex') || '0', 10);
    const totalChunks = parseInt(formData.get('totalChunks') || '1', 10);

    // ============================================
    // VALIDATION
    // ============================================

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'MISSING_SESSION', message: 'sessionId required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!audio || !(audio instanceof Blob)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_AUDIO', message: 'No audio provided' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (audio.size > MAX_CHUNK_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'CHUNK_TOO_LARGE', message: 'Audio chunk must be under 25MB' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (audio.size < 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_AUDIO', message: 'Audio chunk is empty or too small' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`[upload-audio-chunk] === REQUEST START ===`);
    console.log(`[upload-audio-chunk] User: ${userId}`);
    console.log(`[upload-audio-chunk] Session: ${sessionId}`);
    console.log(`[upload-audio-chunk] Chunk ${chunkIndex + 1}/${totalChunks}, Size: ${(audio.size / 1024).toFixed(1)}KB`);

    // ============================================
    // INITIALIZE CLIENTS
    // ============================================

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ============================================
    // ENSURE SESSION EXISTS
    // ============================================

    // Check/create session record
    console.log(`[upload-audio-chunk] Checking for existing session in ambient_recordings...`);

    const { data: existingSession, error: fetchError } = await supabase
      .from('ambient_recordings')
      .select('id, status, chunks_received, total_chunks, transcripts')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[upload-audio-chunk] Session fetch error:', fetchError.message, fetchError.code, fetchError.details);

      // Check if table doesn't exist
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'ambient_recordings table does not exist. Please run the Phase 17 migration.',
            code: 'TABLE_NOT_FOUND',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch session: ${fetchError.message}`,
          code: 'SESSION_ERROR',
          details: fetchError.details || fetchError.hint,
          dbCode: fetchError.code,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`[upload-audio-chunk] Session fetch result: exists=${!!existingSession}`);

    let session = existingSession;

    if (!session) {
      // Create new session
      console.log(`[upload-audio-chunk] No existing session, creating new one...`);
      const { data: newSession, error: createError } = await supabase
        .from('ambient_recordings')
        .insert({
          id: sessionId,
          user_id: userId,
          status: 'uploading',
          mode: 'room', // Default, can be updated by client
          total_chunks: totalChunks,
          chunks_received: 0,
          transcripts: {},
        })
        .select()
        .single();

      if (createError) {
        console.error('[upload-audio-chunk] Session create error:', createError.message, createError.code, createError.details);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to create session: ${createError.message}`,
            code: 'SESSION_CREATE_FAILED',
            details: createError.details,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      session = newSession;
      console.log(`[upload-audio-chunk] Created new session: ${sessionId}`, JSON.stringify(newSession));
    } else {
      console.log(`[upload-audio-chunk] Found existing session: ${sessionId}, status: ${session.status}`);
    }

    // Verify session is still accepting uploads
    if (session.status !== 'uploading' && session.status !== 'recording') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'SESSION_CLOSED', message: `Session is ${session.status}, not accepting uploads` },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ============================================
    // TRANSCRIBE WITH WHISPER
    // ============================================

    console.log(`[PERF] Starting Whisper transcription: ${Date.now() - t0}ms`);

    const audioType = audio.type || 'audio/webm';
    const ext = TYPE_TO_EXT[audioType] || 'webm';
    const file = new File([audio], `chunk_${chunkIndex}.${ext}`, { type: audioType });

    let transcript = '';
    let duration = 0;

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        response_format: 'verbose_json',
      });

      transcript = transcription.text || '';
      duration = transcription.duration || 0;

      console.log(`[PERF] Whisper complete: ${Date.now() - t0}ms, ${transcript.length} chars`);
    } catch (whisperError) {
      console.error('[upload-audio-chunk] Whisper error:', whisperError);
      // Don't fail the upload - store empty transcript
      transcript = '[Transcription failed for this chunk]';
    }

    // ============================================
    // UPDATE SESSION WITH TRANSCRIPT
    // ============================================

    const transcripts = session.transcripts || {};
    transcripts[chunkIndex] = {
      text: transcript,
      duration: duration,
      uploadedAt: new Date().toISOString(),
    };

    const chunksReceived = (session.chunks_received || 0) + 1;
    const allChunksReceived = chunksReceived >= totalChunks;

    const { error: updateError } = await supabase
      .from('ambient_recordings')
      .update({
        transcripts: transcripts,
        chunks_received: chunksReceived,
        status: allChunksReceived ? 'transcribed' : 'uploading',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[upload-audio-chunk] Session update error:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to save transcript' },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const processingTime = Date.now() - t0;

    console.log(`[upload-audio-chunk] Chunk ${chunkIndex + 1}/${totalChunks} complete in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        chunkIndex,
        totalChunks,
        chunksReceived,
        allChunksReceived,
        transcript: transcript.slice(0, 200) + (transcript.length > 200 ? '...' : ''),
        duration,
        processingTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('[upload-audio-chunk] Error:', error.message);
    console.error('[upload-audio-chunk] Stack:', error.stack);

    // Check for common configuration issues
    if (!process.env.OPENAI_API_KEY) {
      console.error('[upload-audio-chunk] Missing OPENAI_API_KEY environment variable');
    }
    if (!process.env.SUPABASE_URL) {
      console.error('[upload-audio-chunk] Missing SUPABASE_URL environment variable');
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      console.error('[upload-audio-chunk] Missing SUPABASE_SERVICE_KEY environment variable');
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
