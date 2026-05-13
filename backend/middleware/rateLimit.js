import { rateLimit } from 'express-rate-limit';

// Tighter limit for AI endpoints — Claude calls are expensive
export const aiLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many AI requests — please wait a moment' },
});

// Standard API limit per authenticated user (keyed by clientId header if set)
export const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 min
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.clientId || req.ip,
});
