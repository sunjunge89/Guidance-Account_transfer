// KT nasmedia - 구글애즈 계정 이관 가이드 : 임직원 인증 프록시
// 브라우저 ↔ Google Apps Script(exec) 사이를 중계한다.
// (2026-07 재설계)

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJMPcJH3yq1vmigGIutrLQ9VV0T_vFZB8WjNqF-mU5KRLFpmNYz_AJ7IgSfO5_CZXa8Q/exec';

module.exports = async function handler(req, res) {
  const email = req.query.email;
  const logoutEmail = req.query.logout;

  let targetParam;
  if (logoutEmail) {
    targetParam = `logout=${encodeURIComponent(logoutEmail)}`;
  } else if (email) {
    targetParam = `email=${encodeURIComponent(email)}`;
  } else {
    res.status(400).json({ status: 'error', message: 'email 또는 logout 파라미터가 필요합니다.' });
    return;
  }

  // 캐시버스팅 파라미터(_) 추가로 Google 프록시단 캐시 회피
  // 주의: Node(undici) fetch는 { cache: 'no-store' } 옵션을 지원하지 않아 함수가 크래시 나므로 사용하지 않는다.
  const targetUrl = `${APPS_SCRIPT_URL}?${targetParam}&_=${Date.now()}`;

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
    // Apps Script가 JSON이 아닌 응답(에러 페이지 등)을 준 경우 - 디버깅을 위해 원문 일부를 그대로 노출
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
}
