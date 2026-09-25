const response = await fetch("http://localhost:3000/announcements", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    appointmentRef: "ops-2026-09-04-17",
    workflow: "delayed",
    effectiveAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    message: "Evening virtual appointments are running 20 minutes behind schedule."
  })
});

console.log(await response.json());
if (!response.ok) process.exitCode = 1;
