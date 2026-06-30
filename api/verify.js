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

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'failed to reach verification server' });
  }
}
