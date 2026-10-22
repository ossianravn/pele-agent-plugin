/* global pele */
'use strict';

const $ = (id) => document.getElementById(id);
const list = $('list');
const stage = $('stage');

/** @type {Map<string, {id: string, title: string, caption: string, source: string, type: string, revision: number, updatedAt: string}>} */
const diagrams = new Map();
const unread = new Set();
let selectedId = null;
// Follow the most recent update until the reader picks an older diagram.
let following = true;
let mounted = null;
let project = '';

const TYPE_NAMES = {
  flowchart: 'Flowchart',
  sequence: 'Sequence',
  state: 'State',
  class: 'Class',
  er: 'Entity relationship',
  gantt: 'Gantt',
  journey: 'User journey',
  xychart: 'XY chart',
  quadrantChart: 'Quadrant chart',
  gitGraph: 'Git graph',
  treeView: 'Tree view',
  mindmap: 'Mind map',
  c4: 'C4',
  eventmodeling: 'Event modeling',
  usecase: 'Use case',
  wardley: 'Wardley map',
};

function typeName(type) {
  return TYPE_NAMES[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

function relativeTime(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

function newest() {
  let latest = null;
  for (const diagram of diagrams.values()) {
    if (!latest || diagram.updatedAt > latest.updatedAt) latest = diagram;
  }
  return latest;
}

function metaText(diagram) {
  const revisions = diagram.revision > 1 ? ` · revision ${diagram.revision}` : '';
  return `${typeName(diagram.type)} · updated ${relativeTime(diagram.updatedAt)}${revisions}`;
}

function renderList() {
  list.replaceChildren(
    ...[...diagrams.values()].map((diagram) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'item';
      button.setAttribute('aria-current', String(diagram.id === selectedId));
      button.addEventListener('click', () => select(diagram.id, diagram.id === newest()?.id));

      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = diagram.title;
      const meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.textContent = `${typeName(diagram.type)} · ${relativeTime(diagram.updatedAt)}`;
      button.append(title, meta);
      if (unread.has(diagram.id)) {
        const dot = document.createElement('span');
        dot.className = 'item-unread';
        dot.setAttribute('aria-label', 'Updated');
        button.append(dot);
      }

      const item = document.createElement('li');
      item.append(button);
      return item;
    }),
  );
}

function renderView() {
  const diagram = diagrams.get(selectedId);
  $('empty').hidden = Boolean(diagram);
  $('view').hidden = !diagram;
  document.title = [diagram?.title, project, 'Diagrams'].filter(Boolean).join(' · ');
  if (!diagram) return;

  $('title').textContent = diagram.title;
  $('meta').textContent = metaText(diagram);
  $('caption').textContent = diagram.caption;
  $('caption').hidden = !diagram.caption;

  if (mounted?.source === diagram.source) return;
  if (mounted) mounted.update(diagram.source);
  else mounted = pele.mount(stage, diagram.source);
}

function select(id, follow) {
  selectedId = id;
  following = follow;
  unread.delete(id);
  renderList();
  renderView();
  list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function onUpsert(diagram) {
  diagrams.set(diagram.id, diagram);
  if (following || selectedId === null) {
    select(diagram.id, true);
  } else {
    if (diagram.id !== selectedId) unread.add(diagram.id);
    renderList();
    if (diagram.id === selectedId) renderView();
  }
}

function onRemove({ id }) {
  diagrams.delete(id);
  unread.delete(id);
  if (selectedId === id) {
    const next = newest();
    select(next?.id ?? null, true);
  } else {
    renderList();
  }
}

function setStatus(state, text) {
  $('status').dataset.state = state;
  $('status').textContent = text;
}

function connect() {
  const events = new EventSource('/events');
  events.addEventListener('open', () => setStatus('live', 'Live'));
  events.addEventListener('error', () => setStatus('offline', 'Offline · showing the last diagrams'));
  events.addEventListener('snapshot', (event) => {
    const snapshot = JSON.parse(event.data);
    project = snapshot.project;
    $('project').textContent = project || 'Diagrams';
    // A reconnect after a server restart brings a fresh board; keep what the reader has unless it is replaced.
    for (const diagram of snapshot.diagrams) diagrams.set(diagram.id, diagram);
    const keep = selectedId && diagrams.has(selectedId) && !following;
    select(keep ? selectedId : newest()?.id ?? null, !keep);
  });
  events.addEventListener('upsert', (event) => onUpsert(JSON.parse(event.data)));
  events.addEventListener('remove', (event) => onRemove(JSON.parse(event.data)));
}

/* Actions */

$('copy').addEventListener('click', async () => {
  const diagram = diagrams.get(selectedId);
  if (!diagram) return;
  const button = $('copy');
  try {
    await navigator.clipboard.writeText(diagram.source);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => (button.textContent = 'Copy source'), 1500);
});

const EXPORTED_VARIABLES = [
  '--pele-bg', '--pele-fg', '--pele-muted', '--pele-line', '--pele-surface', '--pele-surface-alt',
  '--pele-border', '--pele-accent', '--pele-critical', '--pele-radius', '--pele-font', '--pele-font-mono',
  '--done-fill', '--done-stroke', '--active-fill', '--active-stroke', '--blocked-fill', '--blocked-stroke',
  '--todo-stroke',
];

const STATUS_RULES = [...document.styleSheets]
  .flatMap((sheet) => [...sheet.cssRules])
  .filter((rule) => rule.selectorText?.startsWith('.pele-node.'))
  .map((rule) => rule.cssText)
  .join('\n');

/** The diagram as a standalone SVG, with the theme's current colors fixed into the file. */
function exportSvg() {
  const svg = stage.querySelector('svg.pele');
  if (!svg) return null;
  const copy = svg.cloneNode(true);
  const computed = getComputedStyle(stage);
  const variables = EXPORTED_VARIABLES.map((name) => `${name}:${computed.getPropertyValue(name).trim()}`).join(';');
  copy.setAttribute('style', `${variables};${svg.getAttribute('style') ?? ''};background:var(--pele-bg)`);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = STATUS_RULES;
  copy.prepend(style);
  const { width, height } = svg.viewBox.baseVal;
  return {
    markup: new XMLSerializer().serializeToString(copy),
    width,
    height,
    background: computed.getPropertyValue('--pele-bg').trim(),
  };
}

function save(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function flash(button, text) {
  const label = button.textContent;
  button.textContent = text;
  setTimeout(() => (button.textContent = label), 1500);
}

$('download').addEventListener('click', () => {
  const exported = exportSvg();
  if (exported) save(new Blob([exported.markup], { type: 'image/svg+xml' }), `${selectedId}.svg`);
});

// Twice the diagram's natural size, so the image stays sharp in documents and slides.
const PNG_SCALE = 2;
const PNG_MARGIN = 24;

$('download-png').addEventListener('click', () => {
  const exported = exportSvg();
  if (!exported) return;
  const button = $('download-png');
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((exported.width + PNG_MARGIN * 2) * PNG_SCALE);
    canvas.height = Math.ceil((exported.height + PNG_MARGIN * 2) * PNG_SCALE);
    const context = canvas.getContext('2d');
    context.scale(PNG_SCALE, PNG_SCALE);
    context.fillStyle = exported.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, PNG_MARGIN, PNG_MARGIN, exported.width, exported.height);
    try {
      canvas.toBlob((blob) => (blob ? save(blob, `${selectedId}.png`) : flash(button, 'PNG failed')), 'image/png');
    } catch {
      // A diagram that embeds images from the web can't be read back from a canvas.
      flash(button, 'PNG failed');
    }
  };
  image.onerror = () => flash(button, 'PNG failed');
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exported.markup)}`;
});

setInterval(() => {
  renderList();
  const diagram = diagrams.get(selectedId);
  if (diagram) $('meta').textContent = metaText(diagram);
}, 30_000);

connect();
