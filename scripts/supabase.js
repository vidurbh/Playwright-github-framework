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
// Save test run
// ------------------------
async function saveTestRun(data) {
  const { error } = await supabase
    .from('test_runs')
    .insert([data]);

  if (error) {
    console.error('❌ DB Insert Failed:', error.message);
  } else {
    console.log('✅ Test run saved to Supabase');
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