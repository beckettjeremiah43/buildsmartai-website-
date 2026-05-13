import { supabase } from '../lib/supabase.js';
import { Router }      from 'express';
import Anthropic        from '@anthropic-ai/sdk';
import { requireAuth, requireJwt } from '../middleware/auth.js';

const router    = Router();
