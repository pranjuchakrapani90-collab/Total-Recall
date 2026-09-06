// Cloudflare Worker bridge for Total Recall.
// Store your TickTick OAuth access token as a Worker secret named TICKTICK_ACCESS_TOKEN.
// Never put the token in index.html or this repository.

const ALLOWED_ORIGIN = 'https://pranjuchakrapani90-collab.github.io';
const RESPONSIBILITIES = ['SDE-TECH','SDE-REV','SDE-ESTT','HOME-MANAGER','BROTHER','SON'];
const API = 'https://api.ticktick.com/open/v1';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

function normTag(t) {
  return String(t || '').trim().toUpperCase().replace(/\s+/g, '-');
}

function taskTags(task) {
  const raw = task && task.tags;
  if (Array.isArray(raw)) return raw.map(normTag);
  if (raw && typeof raw === 'object') return Object.keys(raw).map(normTag);
  if (typeof raw === 'string') return raw.split(',').map(normTag);
  return [];
}

function tomorrowInZone(timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  const y = parts.find(p=>p.type==='year').value;
  const m = parts.find(p=>p.type==='month').value;
  const d = parts.find(p=>p.type==='day').value;
  const base = new Date(Date.UTC(Number(y), Number(m)-1, Number(d)));
  base.setUTCDate(base.getUTCDate()+1);
  return base.toISOString().slice(0,10);
}

async function tick(path, token) {
  const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('TickTick API HTTP ' + r.status + ' for ' + path);
  return r.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'GET') return new Response('Method not allowed', { status:405, headers:corsHeaders(origin) });

    const url = new URL(request.url);
    if (url.pathname !== '/' && url.pathname !== '/responsibility-tasks') return new Response('Not found', { status:404, headers:corsHeaders(origin) });
    if (!env.TICKTICK_ACCESS_TOKEN) return new Response(JSON.stringify({error:'TICKTICK_ACCESS_TOKEN secret is not configured'}), {status:500, headers:{...corsHeaders(origin),'Content-Type':'application/json'}});

    try {
      const tz = env.TIME_ZONE || 'Asia/Kolkata';
      const target = tomorrowInZone(tz);
      const groups = Object.fromEntries(RESPONSIBILITIES.map(k => [k, []]));
      const projects = await tick('/project', env.TICKTICK_ACCESS_TOKEN);

      for (const project of projects || []) {
        if (!project || !project.id) continue;
        let tasks = [];
        try { tasks = await tick('/project/' + encodeURIComponent(project.id) + '/task', env.TICKTICK_ACCESS_TOKEN); }
        catch (_) { continue; }
        for (const task of tasks || []) {
          const due = task.dueDate || task.due || '';
          if (!due || String(due).slice(0,10) !== target) continue;
          const tags = taskTags(task);
          const matches = RESPONSIBILITIES.filter(r => tags.indexOf(r) >= 0);
          for (const responsibility of matches) {
            groups[responsibility].push({
              id: task.id || '',
              title: task.title || '(Untitled TickTick task)',
              due: String(due).slice(0,16),
              project: project.name || '',
              tags
            });
          }
        }
      }

      for (const k of RESPONSIBILITIES) {
        const seen = new Set();
        groups[k] = groups[k].filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
      }

      return new Response(JSON.stringify({ date: target, timeZone: tz, responsibilities: groups }), {
        status:200,
        headers:{...corsHeaders(origin),'Content-Type':'application/json'}
      });
    } catch (e) {
      return new Response(JSON.stringify({error:String(e && e.message || e)}), {status:502, headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
    }
  }
};
