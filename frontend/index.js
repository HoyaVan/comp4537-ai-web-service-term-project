(() => {
  const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

  function ensureRoot() {
    let el = document.getElementById('app');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app';
      document.body.appendChild(el);
    }
    return el;
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = message;
      status.style.color = isError ? '#b91c1c' : '#065f46';
    }
  }

  async function pingBackend() {
    setStatus('Pinging backend...');
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        credentials: 'omit'
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : await res.text();
      setStatus(`OK (${res.status}) → ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    } catch (err) {
      setStatus(`Failed to reach backend at ${BACKEND_URL} → ${err}`, true);
    }
  }

  function render() {
    const root = ensureRoot();
    root.innerHTML = '';

    const container = document.createElement('div');
    container.style.maxWidth = '640px';
    container.style.margin = '40px auto';
    container.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    container.style.lineHeight = '1.5';

    const title = document.createElement('h1');
    title.textContent = 'Frontend App';
    title.style.margin = '0 0 8px';

    const subtitle = document.createElement('div');
    subtitle.textContent = `Backend: ${BACKEND_URL}`;
    subtitle.style.color = '#475569';
    subtitle.style.marginBottom = '16px';

    const btn = document.createElement('button');
    btn.textContent = 'Ping /api/health';
    btn.style.cursor = 'pointer';
    btn.style.background = '#4f46e5';
    btn.style.color = 'white';
    btn.style.border = '0';
    btn.style.padding = '10px 14px';
    btn.style.borderRadius = '8px';
    btn.onclick = pingBackend;

    const status = document.createElement('div');
    status.id = 'status';
    status.style.marginTop = '14px';
    status.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(btn);
    container.appendChild(status);
    root.appendChild(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();


