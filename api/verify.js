/**
 * 구글애즈 계정 이관 가이드 - 임직원 인증 (매직링크 방식)
 *
 * 시트 컬럼 구조 (헤더 포함, 1행은 헤더):
 * A: 요청일시   B: 이메일   C: 토큰   D: 상태(대기중/승인)   E: 승인시각
 *
 * 동작 방식:
 * 1) 프론트에서 ?email=xxx 로 요청
 *    - 이미 유효한 '승인' 상태가 있으면 → { status: 'approved', approvedAt }
 *    - '대기중' 토큰이 아직 유효기간(10분) 안이면 → 재발송 없이 { status: 'pending' } (메일함 확인 유도)
 *    - 그 외(신규/만료) → 새 토큰 발급 + 메일 발송 + { status: 'pending' }
 * 2) 사용자가 메일의 링크 클릭 → ?token=xxx 로 요청
 *    - 토큰이 유효(미사용, 10분 이내)하면 → 시트에 '승인' 처리 + 승인시각 기록 + 안내 HTML 페이지 표시
 */

const TOKEN_TTL_MS = 10 * 60 * 1000;       // 매직링크 유효기간: 10분
const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000; // 승인 유효기간: 24시간 (프론트 세션 TTL과 동일)
const SHEET_NAME = '시트2';
const ALLOWED_DOMAIN = 'nasmedia.co.kr';

function doGet(e) {
  const params = e.parameter;

  if (params.token) {
    return handleTokenVerification(params.token);
  }

  if (params.email) {
    const email = String(params.email).trim().toLowerCase();

    // 서버 사이드 도메인 검증 (프론트 우회 대비 - 여기가 유일하게 신뢰 가능한 지점)
    if (!isAllowedDomain(email)) {
      return jsonResponse({ status: 'error', message: '허용되지 않은 이메일 도메인입니다.' });
    }

    return handleEmailRequest(email);
  }

  return jsonResponse({ status: 'error', message: 'email 또는 token 파라미터가 필요합니다.' });
}

function isAllowedDomain(email) {
  const parts = email.split('@');
  return parts.length === 2 && parts[1] === ALLOWED_DOMAIN;
}

function handleEmailRequest(email) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  // 이메일 기준 마지막(가장 최근) 행 찾기
  let lastRowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === email) {
      lastRowIndex = i;
    }
  }

  if (lastRowIndex !== -1) {
    const row = data[lastRowIndex];
    const status = String(row[3]).trim();
    const requestedAt = new Date(row[0]);
    const approvedAt = row[4] ? new Date(row[4]) : null;

    if (status === '승인' && approvedAt && (now.getTime() - approvedAt.getTime() < APPROVAL_TTL_MS)) {
      return jsonResponse({ status: 'approved', approvedAt: approvedAt.getTime() });
    }

    if (status === '대기중' && (now.getTime() - requestedAt.getTime() < TOKEN_TTL_MS)) {
      // 아직 유효한 링크가 발송된 상태 → 재발송하지 않고 대기 안내만
      return jsonResponse({ status: 'pending' });
    }
    // 그 외(승인 만료 / 토큰 만료)는 아래로 내려가 새로 발급
  }

  // 신규 토큰 발급 + 메일 발송
  const token = Utilities.getUuid();
  const nowStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([nowStr, email, token, '대기중', '']);

  sendMagicLinkEmail(email, token);

  return jsonResponse({ status: 'pending' });
}

function handleTokenVerification(token) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === token) {
      const status = String(data[i][3]).trim();
      const requestedAt = new Date(data[i][0]);

      if (status === '승인') {
        return htmlResponse('이미 인증이 완료된 링크입니다.', '이 창은 닫으셔도 됩니다.');
      }

      if (now.getTime() - requestedAt.getTime() > TOKEN_TTL_MS) {
        return htmlResponse('만료된 링크입니다.', '가이드 페이지로 돌아가서 인증을 다시 신청해주세요. (유효시간 10분)');
      }

      // 인증 처리
      const approvedAtStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      sheet.getRange(i + 1, 4).setValue('승인');
      sheet.getRange(i + 1, 5).setValue(approvedAtStr);

      return htmlResponse('임직원 인증이 완료되었습니다 🖤', '이 창은 닫고, 원래 가이드 페이지 탭으로 돌아가주세요.');
    }
  }

  return htmlResponse('유효하지 않은 링크입니다.', '가이드 페이지에서 인증을 다시 신청해주세요.');
}

function sendMagicLinkEmail(email, token) {
  const url = ScriptApp.getService().getUrl() + '?token=' + encodeURIComponent(token);
  const subject = '[KT nasmedia] 구글애즈 계정 이관 가이드 - 임직원 인증';
  const plainBody =
    '아래 링크를 클릭하면 임직원 인증이 완료됩니다.\n\n' +
    url + '\n\n' +
    '※ 본인이 요청하지 않았다면 이 메일을 무시해주세요.\n' +
    '※ 링크 유효시간은 발급 후 10분입니다.';

  const htmlBody =
    '<p>아래 버튼을 클릭하면 임직원 인증이 완료됩니다.</p>' +
    '<p><a href="' + url + '" style="display:inline-block;background:#111;color:#fff;' +
    'padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;">' +
    '임직원 인증하기</a></p>' +
    '<p style="color:#888;font-size:13px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.<br>' +
    '링크 유효시간은 발급 후 10분입니다.</p>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody
  });
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlResponse(title, subtitle) {
  const html =
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;' +
    'background:#F1F3F4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}' +
    '.box{background:#fff;border-radius:20px;padding:48px 40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:420px;}' +
    'h1{font-size:22px;margin:0 0 12px;}' +
    'p{font-size:15px;color:#555;margin:0;line-height:1.6;}' +
    '</style></head><body><div class="box"><h1>' + title + '</h1><p>' + subtitle + '</p></div></body></html>';

  return HtmlService.createHtmlOutput(html);
}

/**
 * (선택) 컬럼 헤더가 없는 새 시트에서 시작할 경우 최초 1회 실행
 */
function setupHeaderRow() {
  const sheet = getSheet();
  sheet.getRange(1, 1, 1, 5).setValues([['요청일시', '이메일', '토큰', '상태', '승인시각']]);
}
