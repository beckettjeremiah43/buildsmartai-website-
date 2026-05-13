import { createClient } from '@supabase/supabase-js';

let _client = null;

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  }
  return _client;
}

// Proxy so all existing supabase.from() / supabase.auth calls work unchanged
// but the client is only created on first actual use, not at module load time
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getClient()[prop];
  },
});
