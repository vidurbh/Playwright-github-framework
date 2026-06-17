const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

global.WebSocket = require('ws');

const { createClient } = require('@supabase/supabase-js');

const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  serviceKey,
  {
    global: {
      headers: {
        // Explicitly send the service role key to guarantee RLS bypass
        Authorization: `Bearer ${serviceKey}`
      }
    }
  }
);

module.exports = supabase;