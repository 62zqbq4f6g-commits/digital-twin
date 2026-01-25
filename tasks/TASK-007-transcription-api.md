# TASK-007: Transcription API (Whisper)

## Overview
Create API endpoint that transcribes audio to text using OpenAI Whisper.

## Priority
P0 — Week 2, Day 1-2

## Dependencies
- TASK-006 (Voice recording returns audio blob)

## Outputs
- `/api/transcribe-voice.js` — New file

## Acceptance Criteria

### Endpoint
- [ ] POST /api/transcribe-voice
- [ ] Accepts multipart/form-data with audio file
- [ ] Returns transcribed text
- [ ] Completes in < 5 seconds for 60s audio

### Request
- [ ] `audio`: Binary audio data (WebM, WAV, MP3)
- [ ] `userId`: From auth

### Response
```json
{
  "success": true,
  "text": "transcribed text here",
  "duration": 45.2,
  "processingTime": 2340
}
```

### Error Handling
- [ ] EMPTY_AUDIO: No audio provided
- [ ] INVALID_FORMAT: Unsupported audio format
- [ ] TRANSCRIPTION_FAILED: Whisper API error
- [ ] UNAUTHORIZED: Missing userId

## Implementation

```javascript
// api/transcribe-voice.js

import OpenAI from 'openai';

export const config = { runtime: 'edge' };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const audio = formData.get('audio');
    const userId = formData.get('userId');

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!audio) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'EMPTY_AUDIO' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert to File object for Whisper API
    const file = new File([audio], 'recording.webm', { type: audio.type });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'json',
    });

    return new Response(
      JSON.stringify({
        success: true,
        text: transcription.text,
        processingTime: Date.now() - startTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'TRANSCRIPTION_FAILED', message: error.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

## Test Checklist

- [ ] Empty audio returns 400
- [ ] Missing userId returns 401
- [ ] Valid audio returns transcribed text
- [ ] Processes 60s audio in < 5 seconds
- [ ] Handles WebM format
- [ ] Handles WAV format
- [ ] Error response includes code
