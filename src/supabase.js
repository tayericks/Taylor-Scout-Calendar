import { createClient } from '@supabase/supabase-js';
import { createSharedCookieStorage } from './sharedAuthStorage.js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:createSharedCookieStorage()}}) : null;
export const getShowId = () => { const p = new URLSearchParams(location.search); return p.get('show') || p.get('showId') || ''; };
export async function getSession(){ if(!configured) return null; const {data,error}=await supabase.auth.getSession(); if(error) throw error; return data.session; }
export async function loadCalendar(showId){ const {data,error}=await supabase.from('tool_documents').select('payload,revision,updated_at').eq('show_id',showId).eq('tool_key','calendar').maybeSingle(); if(error) throw error; return data; }
export async function saveCalendar(showId,payload){ const {data,error}=await supabase.from('tool_documents').upsert({show_id:showId,tool_key:'calendar',payload},{onConflict:'show_id,tool_key'}).select('revision,updated_at').single(); if(error) throw error; return data; }
export function subscribeCalendar(showId,callback){ if(!configured||!showId)return()=>{}; const ch=supabase.channel(`calendar:${showId}`).on('postgres_changes',{event:'*',schema:'public',table:'tool_documents',filter:`show_id=eq.${showId}`},p=>{if(p.new?.tool_key==='calendar'||p.old?.tool_key==='calendar')callback(p)}).subscribe(); return()=>supabase.removeChannel(ch); }
export async function syncCalendarLocations(showId,events){
  const assignments=events.filter(e=>e.eventType!=='note'&&e.location);
  const {data:existing,error:loadError}=await supabase.from('production_locations').select('id,metadata').eq('show_id',showId).eq('source','calendar');
  if(loadError) throw loadError;
  const byEvent=new Map((existing||[]).map(r=>[r.metadata?.calendar_event_id,r.id]));
  const rows=assignments.map(e=>({
    ...(byEvent.get(e.id)?{id:byEvent.get(e.id)}:{}), show_id:showId, episode_id:e.episode||null, episode_name:e.episode||null,
    set_name:e.set||'', location_name:e.location||'Untitled Location', address:e.address||'', contact_name:e.contact||'', contact_phone:e.phone||'',
    status:'Scheduled', source:'calendar', notes:e.notes||'', metadata:{calendar_event_id:e.id,unit:e.unit||'',scenes:e.scenes||'',daily_sets:e.dailySets||{},schedule:{prep_start:e.prepStart||null,prep_end:e.prepEnd||null,shoot_start:e.shootStart||null,shoot_end:e.shootEnd||null,hold_start:e.holdStart||null,hold_end:e.holdEnd||null,strike_start:e.strikeStart||null,strike_end:e.strikeEnd||null},key_ids:e.keyIds||[]}
  }));
  if(rows.length){const {error}=await supabase.from('production_locations').upsert(rows); if(error) throw error;}
}
