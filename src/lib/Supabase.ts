// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
 
const SUPABASE_URL = 'https://bggxuslnvevogddrvcxh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZ3h1c2xudmV2b2dkZHJ2Y3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTY3MzAsImV4cCI6MjA5Mjk5MjczMH0.mcK48dha0H1rxMVKEh-jHquA_mLfTUGzKhy27pHLPmM';
 
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
// ─── Types ────────────────────────────────────────────────────────────────────
export type ChatMode = 'chat' | 'code' | 'analysis';
 
export interface ChatSession {
  id: string;
  mode: ChatMode;
  title: string;
  document_name?: string | null;
  created_at: string;
  updated_at: string;
}
 
export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
 
// ─── Session helpers ──────────────────────────────────────────────────────────
 
export async function createSession(mode: ChatMode, title = 'New Chat', document_name?: string): Promise<ChatSession | null> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ mode, title, document_name: document_name ?? null })
    .select()
    .single();
  if (error) { console.error('createSession:', error); return null; }
  return data;
}
 
export async function listSessions(mode?: ChatMode): Promise<ChatSession[]> {
  let query = supabase
    .from('chat_sessions')
    .select()
    .order('updated_at', { ascending: false })
    .limit(50);
  if (mode) query = query.eq('mode', mode);
  const { data, error } = await query;
  if (error) { console.error('listSessions:', error); return []; }
  return data ?? [];
}
 
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
}
 
export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from('chat_sessions').delete().eq('id', sessionId);
}
 
// ─── Message helpers ──────────────────────────────────────────────────────────
 
export async function saveMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ session_id: sessionId, role, content })
    .select()
    .single();
  if (error) { console.error('saveMessage:', error); return null; }
  // Touch the session updated_at
  await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
  return data;
}
 
export async function loadMessages(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) { console.error('loadMessages:', error); return []; }
  return data ?? [];
}
