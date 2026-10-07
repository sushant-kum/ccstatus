const sub = process.argv[2];
if (sub === 'statusline') {
  const { runStatusline } = await import('./statusline-cmd.js');
  await runStatusline();
} else {
  const { render } = await import('ink');
  const { App } = await import('./app.js');
  render(<App />);
}
