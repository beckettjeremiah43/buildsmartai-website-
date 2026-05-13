import { supabase } from '../lib/supabase.js';
import { Router }            from 'express';
import { Resend }            from 'resend';
import { createClient }      from '@supabase/supabase-js';
import { requireAuth }       from '../middleware/auth.js';
import { generateDailySummary } from '../services/claude.js';

const router   = Router();
const resend   = new Resend(process.env.RESEND_API_KEY);
