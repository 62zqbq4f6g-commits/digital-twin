-- Phase 14: Enable Supabase Realtime for cross-device sync
-- This enables instant sync when notes are created/updated/deleted on other devices

-- Enable Realtime for the notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

-- Ensure the table has replica identity for DELETE events
ALTER TABLE notes REPLICA IDENTITY FULL;

-- Note: Run this in Supabase SQL Editor
-- After running, Realtime will broadcast INSERT, UPDATE, DELETE events
-- The client subscribes via supabase.channel().on('postgres_changes', ...)
