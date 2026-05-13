import { supabase } from '../lib/supabase.js';
import { Router }       from 'express';
import Stripe           from 'stripe';
import { requireAuth }  from '../middleware/auth.js';

const router   = Router();
const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
