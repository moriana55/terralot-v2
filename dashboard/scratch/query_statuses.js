const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjepqeltkmudjawsmpml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZXBxZWx0a211ZGphd3NtcG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDYxNzcsImV4cCI6MjA5MTA4MjE3N30.4nwMwuOAwSIJIzW2ozIMbEzNYrYXR7J3wSX6f0bWjJ8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: statuses, error: err1 } = await supabase.from('bot_statuses').select('*').order('bot_no');
  if (err1) {
    console.error(err1);
    return;
  }
  console.log('--- Bot Statuses ---');
  console.log(JSON.stringify(statuses, null, 2));

  const { data: comments, error: err2 } = await supabase.from('bot_comments').select('*').order('bot_no');
  if (err2) {
    console.error(err2);
    return;
  }
  console.log('--- Bot Comments ---');
  console.log(JSON.stringify(comments, null, 2));
}

run();
