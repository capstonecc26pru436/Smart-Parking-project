import fetch from 'node-fetch';
async function run() {
  const res = await fetch("http://localhost:3000/api/sync");
  const json = await res.json();
  console.log("JSON:", json);
}
run();
