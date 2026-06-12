require('dotenv').config();
global.WebSocket = require('ws');

const { createClient } = require('@supabase/supabase-js');
const archiver = require('archiver');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ------------------------
// ZIP folder (FIXED)
// ------------------------
async function zipFolder(folderPath, outputPath) {
  const fs = require('fs');

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });
}

// ------------------------
// Save test run (update pending run if exists, otherwise insert)
// ------------------------
async function saveTestRun(data) {
  // Try to find a pending "triggered" run (created by backend at trigger time)
  // and update it with actual results. This preserves the org_id from the trigger.
  const { data: pendingRuns, error: fetchError } = await supabase
    .from('test_runs')
    .select('id, org_id')
    .eq('status', 'triggered')
    .order('id', { ascending: false })
    .limit(1);

  if (!fetchError && pendingRuns && pendingRuns.length > 0) {
    // Update the pending run with actual results, preserving org_id from trigger
    const pendingRun = pendingRuns[0];
    const updateData = { ...data };
    delete updateData.org_id; // keep the org_id from the trigger
    // If the pending run already has org_id, use it; otherwise use what was passed
    if (pendingRun.org_id) {
      updateData.org_id = pendingRun.org_id;
    }

    const { error: updateError } = await supabase
      .from('test_runs')
      .update(updateData)
      .eq('id', pendingRun.id);

    if (updateError) {
      console.error('❌ DB Update Failed:', updateError.message);
      // Fallback: insert as new
      await insertFallback(data);
    } else {
      console.log('✅ Pending run updated (id:', pendingRun.id, ', org_id:', updateData.org_id || 'none', ')');
    }
  } else {
    // No pending run found, insert as new
    await insertFallback(data);
  }
}

// Insert as new record (fallback)
async function insertFallback(data) {
  const { error } = await supabase
    .from('test_runs')
    .insert([data]);

  if (error) {
    console.error('❌ DB Insert Failed:', error.message);
  } else {
    console.log('✅ Test run inserted to Supabase (org_id:', data.org_id || 'none', ')');
  }
}

// ------------------------
// Upload file
// ------------------------
async function uploadFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    return null;
  }

  const file = fs.readFileSync(filePath);

  const { error } = await supabase
    .storage
    .from('test-artifacts')
    .upload(fileName, file, {
      contentType: 'application/octet-stream',
      upsert: true
    });

  if (error) {
    console.error('❌ Upload failed:', error.message);
    return null;
  }

  const { data } = supabase
    .storage
    .from('test-artifacts')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// ------------------------
// EXPORT EVERYTHING (IMPORTANT FIX)
// ------------------------
module.exports = {
  saveTestRun,
  uploadFile,
  zipFolder   // ✅ THIS WAS MISSING
};