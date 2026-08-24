import { createClient } from '@supabase/supabase-js';
import { createSharedCookieStorage } from './sharedAuthStorage.js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:createSharedCookieStorage()}}) : null;
export const getShowId = () => { const p = new URLSearchParams(location.search); return p.get('show') || p.get('showId') || ''; };
export async function getSession(){ if(!configured) return null; const {data,error}=await supabase.auth.getSession(); if(error) throw error; return data.session; }
const calendarTokens=new Map();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const scheduleOf=e=>({prep_start:e.prepStart||null,prep_end:e.prepEnd||null,shoot_start:e.shootStart||null,shoot_end:e.shootEnd||null,hold_start:e.holdStart||null,hold_end:e.holdEnd||null,strike_start:e.strikeStart||null,strike_end:e.strikeEnd||null});
const eventLink=e=>({event_id:e.id,episode:e.episode||null,unit:e.unit||'',set:e.set||'',scenes:e.scenes||'',daily_sets:e.dailySets||{},schedule:scheduleOf(e),key_ids:e.keyIds||[]});
function eventIndex(locations){const map=new Map();for(const row of locations||[]){if(row.metadata?.calendar_event_id)map.set(row.metadata.calendar_event_id,row.id);for(const entry of row.metadata?.calendar_events||[]){if(entry?.event_id)map.set(entry.event_id,row.id)}}return map}
export async function loadCalendar(showId){
  const [{data:doc,error:docError},{data:locations,error:locationsError}] = await Promise.all([
    supabase.from('tool_documents').select('payload,revision,updated_at').eq('show_id',showId).eq('tool_key','calendar').maybeSingle(),
    supabase.from('production_locations').select('id,metadata').eq('show_id',showId)
  ]);
  if(docError) throw docError;if(locationsError) throw locationsError;if(doc?.updated_at)calendarTokens.set(showId,doc.updated_at);if(!doc?.payload) return doc;
  const byEvent=eventIndex(locations);
  const events=Array.isArray(doc.payload.events)?doc.payload.events.map(e=>({...e,keyIds:Array.isArray(e.keyIds)?e.keyIds:[],locationId:e.locationId||byEvent.get(e.id)||''})):doc.payload.events;
  return {...doc,payload:{...doc.payload,events}};
}
export async function saveCalendar(showId,payload){const{data:current,error:loadError}=await supabase.from('tool_documents').select('payload,revision,updated_at').eq('show_id',showId).eq('tool_key','calendar').maybeSingle();if(loadError)throw loadError;const known=calendarTokens.get(showId)||'';if(current&&same(current.payload,payload)){calendarTokens.set(showId,current.updated_at);return current}if(current&&(!known||current.updated_at!==known))throw new Error('Calendar changed in another session. Reload before saving so newer schedule changes are not overwritten.');const{data,error}=await supabase.from('tool_documents').upsert({show_id:showId,tool_key:'calendar',payload},{onConflict:'show_id,tool_key'}).select('revision,updated_at').single();if(error)throw error;calendarTokens.set(showId,data.updated_at);return data;}
export function subscribeCalendar(showId,callback){ if(!configured||!showId)return()=>{}; const ch=supabase.channel(`calendar:${showId}`).on('postgres_changes',{event:'*',schema:'public',table:'tool_documents',filter:`show_id=eq.${showId}`},p=>{const k=p.new?.tool_key||p.old?.tool_key||'';if(k==='calendar'||k.startsWith('location-tombstone:'))callback(p)}).on('postgres_changes',{event:'*',schema:'public',table:'production_locations',filter:`show_id=eq.${showId}`},callback).subscribe(); return()=>supabase.removeChannel(ch); }
export async function syncCalendarLocations(showId,events){
  const assignments=events.filter(e=>e.eventType!=='note'&&(e.location||e.locationId));
  const [{data:existing,error:loadError},{data:tombstones,error:tombError}]=await Promise.all([supabase.from('production_locations').select('*').eq('show_id',showId),supabase.from('tool_documents').select('tool_key').eq('show_id',showId).like('tool_key','location-tombstone:%')]);
  if(loadError) throw loadError;if(tombError)throw tombError;
  const deletedIds=new Set((tombstones||[]).map(x=>x.tool_key.slice('location-tombstone:'.length)));
  const byEvent=eventIndex(existing),existingById=new Map((existing||[]).map(r=>[r.id,r])),grouped=new Map(),newRows=[];
  for(const e of assignments){
    const canonicalId=e.locationId||byEvent.get(e.id)||'';
    if(!canonicalId){newRows.push({show_id:showId,episode_id:e.episode||null,episode_name:e.episode||null,set_name:e.set||'',location_name:e.location||'Untitled Location',address:e.address||'',contact_name:e.contact||'',contact_phone:e.phone||'',status:'Scheduled',source:'calendar',notes:e.notes||'',metadata:{calendar_event_id:e.id,calendar_events:[eventLink(e)],unit:e.unit||'',scenes:e.scenes||'',daily_sets:e.dailySets||{},schedule:scheduleOf(e),key_ids:e.keyIds||[]}});continue}
    const current=existingById.get(canonicalId);if(deletedIds.has(canonicalId)||!current||current.metadata?.archived_at)continue;
    const bucket=grouped.get(canonicalId)||[];bucket.push(e);grouped.set(canonicalId,bucket)
  }
  const rows=[];
  for(const [canonicalId,linkedEvents] of grouped){const current=existingById.get(canonicalId);if(!current||current.metadata?.archived_at||deletedIds.has(canonicalId))continue;const currentEvents=Array.isArray(current.metadata?.calendar_events)?current.metadata.calendar_events:current.metadata?.calendar_event_id?[{event_id:current.metadata.calendar_event_id,episode:current.episode_name||current.episode_id||null,unit:current.metadata?.unit||'',set:current.set_name||'',scenes:current.metadata?.scenes||'',daily_sets:current.metadata?.daily_sets||{},schedule:current.metadata?.schedule||{},key_ids:current.metadata?.key_ids||[]}]:[];const merged=new Map(currentEvents.map(x=>[x.event_id,x]));for(const e of linkedEvents)merged.set(e.id,eventLink(e));const primary=linkedEvents[0];rows.push({id:canonicalId,show_id:showId,episode_id:primary.episode||current.episode_id||null,episode_name:primary.episode||current.episode_name||null,set_name:primary.set||current.set_name||'',location_name:primary.location||current.location_name||'Untitled Location',address:primary.address||current.address||'',contact_name:primary.contact||current.contact_name||'',contact_phone:primary.phone||current.contact_phone||'',status:'Scheduled',source:current.source||'calendar',notes:primary.notes||current.notes||'',metadata:{...(current.metadata||{}),calendar_event_id:primary.id,calendar_events:[...merged.values()],unit:primary.unit||'',scenes:primary.scenes||'',daily_sets:primary.dailySets||{},schedule:scheduleOf(primary),key_ids:primary.keyIds||[]}})}
  let saved=[];if(rows.length){const{data,error}=await supabase.from('production_locations').upsert(rows).select('id,metadata');if(error)throw error;saved.push(...(data||[]))}if(newRows.length){const{data,error}=await supabase.from('production_locations').insert(newRows).select('id,metadata');if(error)throw error;saved.push(...(data||[]))}
  const resolved=eventIndex(saved);assignments.forEach(e=>{const canonical=e.locationId||resolved.get(e.id)||byEvent.get(e.id);if(canonical)e.locationId=canonical});return saved;
}
