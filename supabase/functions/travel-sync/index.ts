import { validateState } from './model.js';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed = new Set(['https://sherlock3rd.github.io', 'http://127.0.0.1:8788', 'http://localhost:8788', 'http://127.0.0.1:8789']);
const limit = 2_000_000;

// The user explicitly chose a no-login, publicly editable shared trip.
// No credential is accepted from the browser for privileged database access.
Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const headers = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin',
    'Access-Control-Allow-Origin': origin && allowed.has(origin) ? origin : 'https://sherlock3rd.github.io',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type, if-none-match',
    'Access-Control-Expose-Headers':'ETag' };
  const send = (data: unknown, status = 200, extra = {}) => new Response(data === null ? null : JSON.stringify(data), {status,headers:{...headers,...extra}});
  if (origin && !allowed.has(origin)) return send({error:'Origin not allowed'},403);
  if (req.method === 'OPTIONS') return send(null,204);
  if (!['GET','POST'].includes(req.method)) return send({error:'Method not allowed'},405);
  const database = async (path: string, body?: unknown) => {
    const response = await fetch(url+'/rest/v1/'+path, {method:body ? 'POST':'GET', headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'}, body:body ? JSON.stringify(body):undefined, signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('Database unavailable');
    return response.json();
  };
  try {
    if (req.method === 'GET') {
      if(req.headers.has('if-none-match')) {
        const [meta]=await database('travel_workspaces?id=eq.main&select=version');
        if(meta && req.headers.get('if-none-match')==='"'+meta.version+'"')return send(null,304,{ETag:'"'+meta.version+'"'});
      }
      const [row] = await database('travel_workspaces?id=eq.main&select=version,document,updated_at');
      if (!row) return send({error:'Workspace not initialized'},503);
      const tag='"'+row.version+'"';
      if (req.headers.get('if-none-match') === tag) return send(null,304,{ETag:tag});
      return send({version:row.version,document:row.document,updatedAt:row.updated_at},200,{ETag:tag});
    }
    if (!req.headers.get('content-type')?.includes('application/json')) return send({error:'JSON required'},415);
    if (Number(req.headers.get('content-length') || 0) > limit) return send({error:'Document too large'},413);
    const reader=req.body?.getReader(); const chunks:Uint8Array[]=[]; let size=0;
    if (!reader) return send({error:'Missing body'},400);
    for (;;) { const {done,value}=await reader.read(); if(done)break;size+=value.length;if(size>limit){await reader.cancel();return send({error:'Document too large'},413);}chunks.push(value); }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let payload;
    try { payload=JSON.parse(new TextDecoder().decode(bytes)); } catch { return send({error:'Invalid JSON'},400); }
    if (!Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 0 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.mutationId || '')) return send({error:'Invalid version or request ID'},400);
    let document;
    try { document=validateState(payload.document); } catch { return send({error:'Invalid travel document'},400); }
    const result=await database('rpc/travel_save',{expected_version:payload.expectedVersion,next_document:document,mutation_id:payload.mutationId});
    return send(result,result.status==='conflict'?409:result.status==='ok'?200:503);
  } catch { return send({error:'Cloud temporarily unavailable'},503); }
});
