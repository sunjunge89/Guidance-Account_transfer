export default async function handler(req, res) {
  const email = req.query.email;

  if (!email) {
    res.status(400).json({ status: 'error', message: 'email is required' });
    return;
  }

  // ⚠️ 새 배포 URL로 교체됨 (2026-07 매직링크 버전)
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVOA4vbxabqczif6EAMwGk4DdMgg5W_yWxGlYaSQv3VJ-VPflCXvAxPClZK_LkX2U3Kw/exec';

  try {
    // 캐시버스팅 파라미터(_) 추가로 캐시 회피 (Node fetch는 cache 옵션 미지원이라 여기선 사용 안 함)
    const response = await fetch(
      `${APPS_SCRIPT_URL}?email=${encodeURIComponent(email)}&_=${Date.now()}`,
      {
        method: 'GET',
        redirect: 'follow',
      }
    );

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // 구글이 JSON이 아닌 응답(예: 에러 페이지 등)을 준 경우, 디버깅을 위해 그대로 노출
      res.status(502).json({
        status: 'error',
        message: 'apps script returned non-json response',
        upstream_status: response.status,
        upstream_body_preview: rawText.slice(0, 300),
      });
      return;
    }

    // 브라우저/중간 프록시가 이 응답을 캐시하지 않도록 명시
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'unknown error',
    });
  }
}
