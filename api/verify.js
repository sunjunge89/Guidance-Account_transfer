// KT nasmedia - 구글애즈 계정 이관 가이드 : 임직원 인증 프록시
// 브라우저 ↔ Google Apps Script(exec) 사이를 중계한다.
// (2026-07 재설계)

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVOA4vbxabqczif6EAMwGk4DdMgg5W_yWxGlYaSQv3VJ-VPflCXvAxPClZK_LkX2U3Kw/exec';

export default async function handler(req, res) {
  const email = req.query.email;

  if (!email) {
    res.status(400).json({ status: 'error', message: 'email is required' });
    return;
  }

  // 캐시버스팅 파라미터(_) 추가로 Google 프록시단 캐시 회피
  // 주의: Node(undici) fetch는 { cache: 'no-store' } 옵션을 지원하지 않아 함수가 크래시 나므로 사용하지 않는다.
  const targetUrl = `${APPS_SCRIPT_URL}?email=${encodeURIComponent(email)}&_=${Date.now()}`;

  let response;
  try {
    response = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
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
