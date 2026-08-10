import { configured, supabase, getShowId, getSession } from './supabase.js';

const showId=getShowId();
let cache=null;

const esc=(s='')=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function loadLockedLocations(){
  if(cache)return cache;
  if(!configured||!showId||!supabase)return [];
  try{
    const session=await getSession();
    if(!session)return [];
    const {data,error}=await supabase.from('production_locations')
      .select('id,episode_id,episode_name,set_name,location_name,address,contact_name,contact_phone,status,source,metadata')
      .eq('show_id',showId)
      .eq('status','Selected')
      .eq('source','location_list')
      .order('location_name',{ascending:true});
    if(error)throw error;
    cache=(data||[]).filter(x=>!x.metadata?.archived_at);
    return cache;
  }catch(e){console.error('Locked location picker failed',e);return []}
}

function value(id){return document.querySelector(id)?.value||''}
function setValue(id,v){const el=document.querySelector(id);if(el){el.value=v||'';el.dispatchEvent(new Event('input',{bubbles:true}))}}

async function augmentAssignment(){
  const modal=document.querySelector('#modalRoot .modal');
  if(!modal||modal.dataset.lockedLocationPicker==='1')return;
  const h2=modal.querySelector('h2');
  if(!h2||!/^Add Assignment$/i.test(h2.textContent.trim()))return;
  modal.dataset.lockedLocationPicker='1';
  const locations=await loadLockedLocations();
  const details=modal.querySelector('#detailsPanel .form-grid');
  if(!details)return;
  const wrap=document.createElement('div');
  wrap.className='field full locked-location-field';
  wrap.innerHTML=`<label>Locked Location</label><select id="f_lockedLocationId"><option value="">Select a locked location…</option>${locations.map(l=>`<option value="${esc(l.id)}">${esc(l.location_name||'Unnamed location')}${l.set_name?` — ${esc(l.set_name)}`:''}</option>`).join('')}</select><small class="locked-location-help">Loads the selected location's address and contact information from Location List.</small>`;
  details.prepend(wrap);
  const select=wrap.querySelector('select');
  const queryId=new URLSearchParams(location.search).get('locationId')||'';
  if(queryId&&locations.some(l=>l.id===queryId))select.value=queryId;
  const apply=()=>{
    const loc=locations.find(l=>l.id===select.value);if(!loc)return;
    setValue('#f_episode',loc.episode_name||loc.episode_id||value('#f_episode'));
    setValue('#f_set',loc.set_name||value('#f_set'));
    setValue('#f_location',loc.location_name||'');
    setValue('#f_address',loc.address||'');
    setValue('#f_contact',loc.contact_name||'');
    setValue('#f_phone',loc.contact_phone||'');
    ['#f_location','#f_address','#f_contact','#f_phone'].forEach(id=>document.querySelector(id)?.setAttribute('data-locked-location-id',loc.id));
  };
  select.onchange=apply;
  if(select.value)apply();
}

document.addEventListener('click',()=>setTimeout(augmentAssignment,0));
document.addEventListener('keydown',()=>setTimeout(augmentAssignment,0));
loadLockedLocations();

const style=document.createElement('style');
style.textContent=`.locked-location-field{grid-column:1/-1!important;background:#f4f8fa;border:1px solid #cbd9e1;border-radius:8px;padding:12px}.locked-location-field label{color:#168e89!important}.locked-location-help{display:block;margin-top:5px;color:#60788b;font-size:11px;font-weight:600;text-transform:none;letter-spacing:0}`;
document.head.append(style);
