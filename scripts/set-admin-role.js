const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'backend', '.env') });

global.WebSocket = require('ws');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node scripts/set-admin-role.js <email>');
    console.error('Example: node scripts/set-admin-role.js user@example.com');
    process.exit(1);
  }

  console.log(`Looking up user: ${email}...`);

  // Find the user's profile
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .single();

  if (findError) {
    console.error('Error finding user:', findError.message);
    console.error('\nMake sure the user has logged in at least once (so their profile exists in the DB).');
    process.exit(1);
  }

  console.log('Found user:', JSON.stringify(profile, null, 2));
  console.log(`Current role: ${profile.role}`);

  // Update role to admin
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin', updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select();

  if (error) {
    console.error('Error updating role:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Successfully updated ${email} to admin role.`);
  console.log('User:', JSON.stringify(data, null, 2));
  console.log('\n⚠️  The user needs to log out and log back in for the change to take effect.');
  console.log('Or if they are already logged in, they can refresh the page.');
}

main();