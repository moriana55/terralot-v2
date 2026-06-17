const { createClient } = require("@supabase/supabase-js");

const url = "https://jjepqeltkmudjawsmpml.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZXBxZWx0a211ZGphd3NtcG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDYxNzcsImV4cCI6MjA5MTA4MjE3N30.4nwMwuOAwSIJIzW2ozIMbEzNYrYXR7J3wSX6f0bWjJ8";

const supabase = createClient(url, anon);

async function run() {
  const { data, error } = await supabase.from("updates").select("*");
  if (error) {
    console.error("Error fetching updates:", error);
    return;
  }
  console.log("UPDATES:", JSON.stringify(data, null, 2));
}

run();
