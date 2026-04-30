const fs = require('fs');

let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace('BUILD_TIMESTAMP', new Date().toISOString());
fs.writeFileSync('sw.js', sw);

let auth = fs.readFileSync('js/auth.js', 'utf8');
auth = auth
  .replace('YOUR_SUPABASE_URL', process.env.SUPABASE_URL || '')
  .replace('YOUR_SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY || '');
fs.writeFileSync('js/auth.js', auth);
