import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKLOG_PATH = path.resolve(__dirname, '..', '..', 'dev_reviews', 'backlog_melhorias.json');

export function isInspectorEnabled() {
  return process.env.ENABLE_DEV_INSPECTOR !== 'false';
}

export function readBacklog() {
  try {
    if (!fs.existsSync(BACKLOG_PATH)) {
      const dir = path.dirname(BACKLOG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify({ updated_at: new Date().toISOString(), reviews: [] }, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(BACKLOG_PATH, 'utf8');
    return JSON.parse(raw || '{ "reviews": [] }');
  } catch (err) {
    console.warn('[DEV-INSPECTOR] Erro ao ler backlog:', err.message);
    return { updated_at: new Date().toISOString(), reviews: [] };
  }
}

export function saveReview(data) {
  const current = readBacklog();
  const reviews = Array.isArray(current.reviews) ? current.reviews : [];

  const nextSeq = reviews.length + 1;
  const id = `REV-${String(nextSeq).padStart(3, '0')}`;

  const newEntry = {
    id,
    timestamp: new Date().toISOString(),
    status: 'pendente', // pendente | em_analise | implementado | descartado
    severidade: data.severidade || 'media', // baixa | media | alta | bloqueante
    tela_rota: data.tela_rota || 'desconhecida',
    contexto_operacional: {
      filtros_ativos: data.filtros_ativos || {},
      sku_foco: data.sku_foco || null,
      amostra_skus_ids: data.amostra_skus_ids || [],
    },
    critica: String(data.critica || '').trim(),
    sugestao_impacto: String(data.sugestao_impacto || '').trim(),
    resolucao: null,
  };

  reviews.unshift(newEntry);
  current.updated_at = new Date().toISOString();
  current.reviews = reviews;

  const dir = path.dirname(BACKLOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(current, null, 2), 'utf8');

  return newEntry;
}

export function updateReviewStatus(id, status, resolutionNotes = '') {
  const current = readBacklog();
  const reviews = Array.isArray(current.reviews) ? current.reviews : [];
  const found = reviews.find((r) => r.id === id);
  if (!found) return null;

  found.status = status;
  if (resolutionNotes) {
    found.resolucao = {
      data: new Date().toISOString(),
      notas: resolutionNotes,
    };
  }

  current.updated_at = new Date().toISOString();
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(current, null, 2), 'utf8');
  return found;
}

export function getInspectorStatus() {
  const enabled = isInspectorEnabled();
  const backlog = readBacklog();
  const reviews = backlog.reviews || [];
  const countPending = reviews.filter((r) => r.status === 'pendente').length;
  return {
    enabled,
    total: reviews.length,
    countPending,
    latestUpdated: backlog.updated_at,
  };
}

