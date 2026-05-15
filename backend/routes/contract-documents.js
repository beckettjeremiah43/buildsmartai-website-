import { supabase }    from '../lib/supabase.js';
import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router  = Router({ mergeParams: true });
const BUCKET  = 'contract-docs';
const EXPIRES = 60 * 60; // 1 hour signed URL

router.use(requireAuth);

// ── Guard: ensure contract belongs to this client ─────────────────────────────
async function ownContract(req, res, next) {
  const { data, error } = await supabase
    .from('contracts')
    .select('id')
    .eq('id', req.params.contractId)
    .eq('client_id', req.clientId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Contract not found' });
  next();
}

// ── GET /api/contracts/:contractId/documents ──────────────────────────────────
router.get('/', ownContract, async (req, res, next) => {
  try {
    const { data: docs, error } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('contract_id', req.params.contractId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Generate short-lived signed download URLs
    const withUrls = await Promise.all((docs || []).map(async doc => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.path, EXPIRES);
      return { ...doc, url: signed?.signedUrl ?? null };
    }));

    res.json(withUrls);
  } catch (err) { next(err); }
});

// ── POST /api/contracts/:contractId/documents ─────────────────────────────────
// Called by the frontend after it has uploaded the file to Supabase Storage.
// Body: { name, path, size, mime_type }
router.post('/', ownContract, async (req, res, next) => {
  try {
    const { name, path, size, mime_type } = req.body;
    if (!name || !path) return res.status(400).json({ error: 'name and path are required' });

    const { data, error } = await supabase
      .from('contract_documents')
      .insert({
        contract_id: req.params.contractId,
        client_id:   req.clientId,
        name,
        path,
        size:      size      ? Number(size)      : null,
        mime_type: mime_type ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    // Return the doc with a fresh signed URL
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, EXPIRES);

    res.status(201).json({ ...data, url: signed?.signedUrl ?? null });
  } catch (err) { next(err); }
});

// ── DELETE /api/contracts/:contractId/documents/:docId ────────────────────────
router.delete('/:docId', ownContract, async (req, res, next) => {
  try {
    // Fetch path first
    const { data: doc, error: fetchErr } = await supabase
      .from('contract_documents')
      .select('path')
      .eq('id', req.params.docId)
      .eq('contract_id', req.params.contractId)
      .single();
    if (fetchErr || !doc) return res.status(404).json({ error: 'Document not found' });

    // Delete from storage (best-effort)
    await supabase.storage.from(BUCKET).remove([doc.path]);

    // Delete metadata row
    const { error } = await supabase
      .from('contract_documents')
      .delete()
      .eq('id', req.params.docId);
    if (error) throw error;

    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
