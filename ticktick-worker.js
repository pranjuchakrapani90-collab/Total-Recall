// Cloudflare Worker bridge for Total Recall.
// Store your TickTick access token as a Worker secret named TICKTICK_ACCESS_TOKEN.
// Never put the token in index.html or this repository.

const ALLOWED_ORIGIN = 'https://pranjuchakrapani90-collab.github.io';
const RESPONSIBILITIES = ['SDE-TECH','SDE-REV','SDE-ESTT','HOME-MANAGER','BROTHER','SON'];
const API = 'https://api.ticktick.com/open/v1';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

function normTag(t) {
  return String(t || '').trim().replace(/^#/, '').toUpperCase().replace(/\s+/g, '-');
}

function taskTags(task) {
  const raw = task && task.tags;
  if (Array.isArray(raw)) return raw.map(normTag);
  if (raw && typeof raw === 'object') return Object.keys(raw).map(normTag);
  if (typeof raw === 'string') return raw.split(',').map(normTag);
  return [];
}

function todayInZone(timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  const y = parts.find(p=>p.type==='year').value;
  const m = parts.find(p=>p.type==='month').value;
  const d = parts.find(p=>p.type==='day').value;
  return `${y}-${m}-${d}`;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

function localIsoStart(date) {
  return date + 'T00:00:00.000+0530';
}

function localIsoEnd(date) {
  return date + 'T23:59:59.999+0530';
}

function dateInZone(value, timeZone) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0,10);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const y = parts.find(p=>p.type==='year').value;
  const m = parts.find(p=>p.type==='month').value;
  const day = parts.find(p=>p.type==='day').value;
  return `${y}-${m}-${day}`;
}

async function tick(path, token, options = {}) {
  const r = await fetch(API + path, {
    method: options.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      ...(options.body ? {'Content-Type':'application/json'} : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('TickTick API HTTP ' + r.status + ' for ' + path + ': ' + text.slice(0,300));
  }
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
      const target = todayInZone(tz);
      const groups = Object.fromEntries(RESPONSIBILITIES.map(k => [k, []]));

      // Search by due-date range for TODAY in the configured timezone.
      const dueFrom = localIsoStart(target);
      const dueTo = localIsoEnd(target);
      let result;
      let source = 'search';
      try {
        result = await tick('/task/search', env.TICKTICK_ACCESS_TOKEN, {
          method: 'POST',
          body: { dueFrom, dueTo, status: [0] }
        });
      } catch (_) {
        // Fallback for accounts/API versions where task search is unavailable.
        source = 'filter';
        result = await tick('/task/filter', env.TICKTICK_ACCESS_TOKEN, {
          method: 'POST',
          body: {
            startDate: localIsoStart(addDays(target, -1)),
            endDate: localIsoEnd(addDays(target, 1)),
            status: [0]
          }
        });
      }

      const tasks = Array.isArray(result) ? result : ((result && result.tasks) || []);
      let dueMatches = 0;
      let taggedMatches = 0;

      for (const task of tasks) {
        const due = task && (task.dueDate || task.due || '');
        if (!due || dateInZone(due, tz) !== target) continue;
        dueMatches++;
        const tags = taskTags(task);
        const matches = RESPONSIBILITIES.filter(r => tags.indexOf(r) >= 0);
        if (matches.length) taggedMatches++;
        for (const responsibility of matches) {
          groups[responsibility].push({
            id: task.id || '',
            title: task.title || '(Untitled TickTick task)',
            due: String(due).slice(0,16),
            projectId: task.projectId || '',
            tags
          });
        }
      }

      for (const k of RESPONSIBILITIES) {
        const seen = new Set();
        groups[k] = groups[k].filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      }

      const response = {
        date: target,
        timeZone: tz,
        responsibilities: groups,
        debug: { source, taskCount: tasks.length, dueMatches, taggedMatches }
      };

      return new Response(JSON.stringify(response), {
        status:200,
        headers:{...corsHeaders(origin),'Content-Type':'application/json'}
      });
    } catch (e) {
      return new Response(JSON.stringify({error:String(e && e.message || e)}), {status:502, headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
    }
  }
};
