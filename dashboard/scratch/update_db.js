const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjepqeltkmudjawsmpml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZXBxZWx0a211ZGphd3NtcG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDYxNzcsImV4cCI6MjA5MTA4MjE3N30.4nwMwuOAwSIJIzW2ozIMbEzNYrYXR7J3wSX6f0bWjJ8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Updating statuses for Bot 8 (FEMA) and Bot 9 (Road Access) to "tamamlandı"...');
  
  const { data: d1, error: e1 } = await supabase.from('bot_statuses').upsert({
    bot_no: 8,
    status: 'tamamlandı',
    updated_at: new Date().toISOString()
  });
  if (e1) console.error('Error updating Bot 8:', e1);
  else console.log('Bot 8 updated successfully!');

  const { data: d2, error: e2 } = await supabase.from('bot_statuses').upsert({
    bot_no: 9,
    status: 'tamamlandı',
    updated_at: new Date().toISOString()
  });
  if (e2) console.error('Error updating Bot 9:', e2);
  else console.log('Bot 9 updated successfully!');

  const { data: d3, error: e3 } = await supabase.from('bot_statuses').upsert({
    bot_no: 1,
    status: 'tamamlandı',
    updated_at: new Date().toISOString()
  });
  if (e3) console.error('Error updating Bot 1:', e3);
  else console.log('Bot 1 updated successfully!');

  const { data: d4, error: e4 } = await supabase.from('bot_statuses').upsert({
    bot_no: 16,
    status: 'tamamlandı',
    updated_at: new Date().toISOString()
  });
  if (e4) console.error('Error updating Bot 16:', e4);
  else console.log('Bot 16 updated successfully!');
}

run();
