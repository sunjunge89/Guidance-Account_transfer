// KT nasmedia - 구글애즈 계정 이관 가이드 : 매직링크 확인/승인 프록시
// 브라우저 ↔ Google Apps Script(exec) 사이를 중계한다.
// GET  : 토큰 상태 확인 (부작용 없음)
// POST : 실제 승인 처리 ("인증 완료하기" 버튼 클릭 시 호출)

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJMPcJH3yq1vmigGIutrLQ9VV0T_vFZB8WjNqF-mU5KRLFpmNYz_AJ7IgSfO5_CZXa8Q/exec';

module.exports = async function handler(req, res) {
  const token = req.method === 'POST' ? req.body?.token : req.query.token;

  if (!token) {
    res.status(400).json({ status: 'error', message: 'token이 필요합니다.' });
    return;
  }

  const targetUrl = `${APPS_SCRIPT_URL}?token=${encodeURIComponent(token)}&_=${Date.now()}`;

  let response;
  try {
    if (req.method === 'POST') {
      // Apps Script doPost로 전달 (form-urlencoded)
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token=${encodeURIComponent(token)}`,
        redirect: 'follow',
      });
    } else {
      response = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
    }
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
}
