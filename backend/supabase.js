const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

global.WebSocket = require('ws');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

module.exports = supabase;
