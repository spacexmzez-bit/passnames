import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import words from './words.json';
const h = React.createElement;
function App() {
  const [status, setStatus] = useState('جاهز للفحص');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true); setStatus('جارٍ فحص الاتصال…');
    try {
      const r = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error('تعذر الاتصال بالخادم');
      if (!Array.isArray(words) || words.length < 36 || words.some(w => typeof w !== 'string' || !w.trim())) throw new Error('ملف الكلمات غير صالح');
      await new Promise((resolve, reject) => {
        const url = new URL('/parties/setup/setup-check', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(url); let received = false;
        const timer = setTimeout(() => { socket.close(); reject(new Error('انتهت مهلة فحص الاتصال الفوري')); }, 12000);
        socket.onmessage = event => { try { if (!JSON.parse(event.data).ok) throw new Error(); received = true; clearTimeout(timer); socket.close(); resolve(); } catch { clearTimeout(timer); socket.close(); reject(new Error('استجابة غير صالحة')); } };
        socket.onerror = () => { clearTimeout(timer); reject(new Error('فشل الاتصال الفوري')); };
        socket.onclose = () => { if (!received) { clearTimeout(timer); reject(new Error('أُغلق الاتصال قبل اكتمال الفحص')); } };
      });
      setStatus('نجح الفحص ✓ الخادم والاتصال الفوري وملف الكلمات جاهزة');
    } catch (e) { setStatus('فشل الفحص: ' + e.message); }
    finally { setBusy(false); }
  }
  return h('main', null,
    h('div', { className: 'badge' }, 'المرحلة الأولى · الإعداد'),
    h('h1', null, 'كلمات سرية'),
    h('p', { className: 'lead' }, 'تلميح واحد. احتمالات كثيرة.'),
    h('section', null, h('h2', null, 'البداية جاهزة'), h('p', null, 'هذه صفحة التحقق من الإعداد. ستُضاف اللعبة في المرحلة الثانية والغرف الخاصة في المرحلة الثالثة.'),
      h('button', { onClick: check, disabled: busy }, busy ? 'جارٍ الفحص…' : 'فحص الإعداد'),
      h('p', { role: 'status', 'aria-live': 'polite' }, status)),
    h('footer', null, 'عربي فقط · الوضع العادي والوضع الموسّع'));
}
createRoot(document.getElementById('root')).render(h(App));
