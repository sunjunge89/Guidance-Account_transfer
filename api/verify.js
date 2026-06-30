export default async function handler(req, res) {
  const email = req.query.email;

  if (!email) {
    res.status(400).json({ status: 'error', message: 'email is required' });
    return;
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfDR10iH-wnl_jy2KWL-oTeTlULNzlffziXt-ipBVXS9hpvstKUtPa4Z8lLRyfhK_d6g/exec';

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      redirect: 'follow'
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // 구글이 JSON이 아닌 응답(에러 페이지 등)을 준 경우, 디버깅을 위해 그대로 노출
      res.status(502).json({
        status: 'error',
        message: 'apps script returned non-json response',
        upstream_status: response.status,
        upstream_body_preview: rawText.slice(0, 300)
      });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'failed to reach verification server',
      error_detail: String(err)
    });
  }
}
