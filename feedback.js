/* Feedback intake.
   Sends what the visitor wrote to Core and always lands them somewhere: a receipt
   with what happens next, or a refusal that says why and what to do instead. */

// Mirrors CORE_ORIGIN in site-core.js. Declared here rather than imported so this
// static page does not pull the whole conversation runtime in to post one form.
const CORE_ORIGIN = 'https://api.lotbiai.com';
const FEEDBACK_URL = `${CORE_ORIGIN}/v2/feedback`;
const MESSAGE_MIN_LENGTH = 5;

const form = document.getElementById('feedback-form');
const messageField = document.getElementById('feedback-message');
const emailField = document.getElementById('feedback-email');
const counter = document.getElementById('feedback-count');
const statusLine = document.getElementById('feedback-status');
const submitButton = document.getElementById('feedback-submit');
const donePanel = document.getElementById('feedback-done');
const receiptSlot = document.getElementById('feedback-receipt-id');
const nextSlot = document.getElementById('feedback-next');
const againButton = document.getElementById('feedback-again');

function setStatus(text, tone) {
  statusLine.textContent = text || '';
  if (tone) {
    statusLine.setAttribute('data-tone', tone);
  } else {
    statusLine.removeAttribute('data-tone');
  }
}

function markInvalid(field, invalid) {
  if (!field) return;
  if (invalid) {
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.removeAttribute('aria-invalid');
  }
}

function updateCount() {
  counter.textContent = String(messageField.value.trim().length);
}

function selectedCategory() {
  const checked = form.querySelector('input[name="category"]:checked');
  return checked ? checked.value : '';
}

/* Core answers a refusal with {detail:{message,next}}. Show both: the reason alone
   leaves someone stuck, and the next step alone hides why they were stopped. */
async function refusal(response) {
  let detail = null;
  try {
    const body = await response.json();
    detail = body && body.detail;
  } catch (error) {
    detail = null;
  }
  if (detail && typeof detail === 'object' && detail.message) {
    return {code: detail.code || '', text: [detail.message, detail.next].filter(Boolean).join(' ')};
  }
  if (response.status === 429) {
    return {code: 'FEEDBACK_RATE_LIMITED', text: '짧은 시간에 너무 많이 보내셨습니다. 잠시 후 다시 보내주세요.'};
  }
  return {code: '', text: '의견을 보내지 못했습니다. 잠시 후 다시 시도해주세요.'};
}

function showReceipt(result) {
  receiptSlot.textContent = result.receipt_id || '';
  nextSlot.textContent = result.next || '';
  form.hidden = true;
  donePanel.hidden = false;
  donePanel.scrollIntoView({block: 'nearest'});
  donePanel.querySelector('h2').setAttribute('tabindex', '-1');
  donePanel.querySelector('h2').focus();
}

messageField.addEventListener('input', () => {
  updateCount();
  if (messageField.value.trim().length >= MESSAGE_MIN_LENGTH) {
    markInvalid(messageField, false);
    setStatus('');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = messageField.value.trim();
  const email = emailField.value.trim();

  // Checked here as well as in Core so an empty send answers instantly instead of
  // costing a round trip to be told the obvious.
  if (message.length < MESSAGE_MIN_LENGTH) {
    markInvalid(messageField, true);
    setStatus(`내용을 입력해주세요. 어떤 점이 좋았는지 또는 불편했는지 ${MESSAGE_MIN_LENGTH}자 이상 적어주세요.`);
    messageField.focus();
    return;
  }

  markInvalid(messageField, false);
  markInvalid(emailField, false);
  submitButton.disabled = true;
  setStatus('보내는 중입니다…', 'pending');

  try {
    const response = await fetch(FEEDBACK_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({category: selectedCategory(), message, email}),
    });

    if (!response.ok) {
      const {code, text} = await refusal(response);
      // Only point at the email field when the email is what Core objected to.
      if (code === 'FEEDBACK_EMAIL_INVALID') {
        markInvalid(emailField, true);
        emailField.focus();
      } else if (code.startsWith('FEEDBACK_MESSAGE_')) {
        markInvalid(messageField, true);
        messageField.focus();
      }
      setStatus(text);
      submitButton.disabled = false;
      return;
    }

    setStatus('');
    showReceipt(await response.json());
  } catch (error) {
    // Network failure, offline, or the request never reached Core.
    setStatus('인터넷 연결이 불안정해 의견을 보내지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
    submitButton.disabled = false;
  }
});

againButton.addEventListener('click', () => {
  form.reset();
  updateCount();
  markInvalid(messageField, false);
  markInvalid(emailField, false);
  setStatus('');
  submitButton.disabled = false;
  donePanel.hidden = true;
  form.hidden = false;
  messageField.focus();
});

updateCount();
