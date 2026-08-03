// KT nasmedia - 구글애즈 계정 이관 가이드 : 임직원 인증 프록시 (6자리 코드)
// 브라우저 ↔ Google Apps Script(exec) 중계.
//   POST { action:'send',   email }        → 코드 발송
//   POST { action:'verify', email, code }  → 코드 검증
// (2026-08 단순화판)

// ▼▼▼ 새 Gmail 계정으로 재배포하면 이 URL을 새 exec URL로 교체하세요 ▼▼▼
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvrQmPiHJ8K2twvzGAPxkdsvhs_q78B1BFW4TJXB9hsp095xOt0aGIkJJjqQMCdFMR/exec';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'POST만 허용됩니다.' });
    return;
  }

  const body = req.body || {};
  const action = body.action;
  const email = body.email;
  const code = body.code;

  if (action !== 'send' && action !== 'verify') {
    res.status(400).json({ status: 'error', message: 'action이 올바르지 않습니다.' });
    return;
  }
  if (!email) {
    res.status(400).json({ status: 'error', message: 'email이 필요합니다.' });
    return;
  }

  const params = new URLSearchParams();
  params.set('action', action);
  params.set('email', email);
  if (action === 'verify') params.set('code', code || '');

  let response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'follow',
    });
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'apps script fetch failed: ' + err.message });
    return;
  }

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    res.status(502).json({
      status: 'error',
      message: 'apps script returned non-json response',
      upstream_status: response.status,
      upstream_body_preview: rawText.slice(0, 300),
    });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json(data);
};
