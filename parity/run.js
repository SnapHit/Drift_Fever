/* THE PARITY TEST. See parity/README.md. Sets the time zone before anything
   touches a Date, then hands over to the orchestrator. */
process.env.TZ = process.env.PARITY_TZ || 'Australia/Sydney';
await import('./orchestrate.js');
