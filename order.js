/**
 * functions/api/order.js
 * ─────────────────────────────────────────────────────────────
 * Cloudflare Pages Function — handles POST /api/order
 *
 * What it does:
 *   1. Receives the form submission (application/x-www-form-urlencoded)
 *   2. Parses and validates the fields
 *   3. Sends a notification email to the shop owner via MailChannels
 *   4. Returns a JSON response (success or error)
 *
 * Cloudflare Pages Functions docs:
 *   https://developers.cloudflare.com/pages/functions/
 *
 * MailChannels (free on Cloudflare Workers) docs:
 *   https://support.mailchannels.com/hc/en-us/articles/4565898ookingnow
 *
 * HOW TO DEPLOY:
 *   1. Place this file at: functions/api/order.js in your repo root.
 *   2. Deploy to Cloudflare Pages (connect your Git repo in the dashboard).
 *   3. Cloudflare will automatically create the /api/order route.
 *   4. Update OWNER_EMAIL below to your real email address.
 *
 * ─────────────────────────────────────────────────────────────
 */

// ── CONFIGURATION ─────────────────────────────────────────────
// REPLACE: change this to your real email address
const OWNER_EMAIL = 'you@example.com';

// REPLACE: change this to your shop's name (shown as sender)
const SHOP_NAME   = 'Silly Stitches';

// REPLACE: "From" address used in the notification email.
// Must be a domain you own or that is authorised via SPF/DKIM for MailChannels.
// For testing, you can use: orders@yourdomain.com
const FROM_EMAIL  = 'orders@yourdomain.com';
// ─────────────────────────────────────────────────────────────


/**
 * Cloudflare Pages Functions export the onRequest handler.
 * We only accept POST; all other methods return 405.
 */
export async function onRequestPost(context) {
  try {
    // ── 1. Parse form body ──────────────────────────────────────
    const contentType = context.request.headers.get('Content-Type') || '';

    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return jsonResponse({ error: 'Unsupported content type.' }, 415);
    }

    const body   = await context.request.text();
    const params = new URLSearchParams(body);

    const name     = (params.get('name')     || '').trim();
    const email    = (params.get('email')    || '').trim();
    const product  = (params.get('product')  || '').trim();
    const quantity = (params.get('quantity') || '').trim();
    const notes    = (params.get('notes')    || '').trim();

    // ── 2. Server-side validation ───────────────────────────────
    const errors = [];

    if (!name)                               errors.push('Name is required.');
    if (!email || !isValidEmail(email))      errors.push('A valid email is required.');
    if (!product)                            errors.push('Product is required.');
    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
      errors.push('A valid quantity is required.');
    }

    if (errors.length > 0) {
      return jsonResponse({ error: errors.join(' ') }, 400);
    }

    // ── 3. Build email content ──────────────────────────────────
    const emailText = buildEmailText({ name, email, product, quantity, notes });
    const emailHtml = buildEmailHtml({ name, email, product, quantity, notes });

    // ── 4. Send via MailChannels ────────────────────────────────
    /**
     * MailChannels HTTP API is available for free inside Cloudflare Workers.
     * No API key is needed — Cloudflare handles authentication.
     * See: https://blog.cloudflare.com/sending-email-from-workers-with-mailchannels/
     *
     * NOTE: MailChannels now requires Domain Lockdown or DKIM to prevent abuse.
     * See: https://support.mailchannels.com/hc/en-us/articles/16918954360845
     * Add a TXT record: "_mailchannels.yourdomain.com" → "v=mc1 cfid=your-cf-account-tag"
     */
    const mailPayload = {
      personalizations: [
        {
          to: [{ email: OWNER_EMAIL, name: SHOP_NAME }],
        },
      ],
      from: {
        email: FROM_EMAIL,
        name:  `${SHOP_NAME} Orders`,
      },
      reply_to: {
        email: email,
        name:  name,
      },
      subject: `✦ New Order from ${name} — ${product}`,
      content: [
        { type: 'text/plain', value: emailText },
        { type: 'text/html',  value: emailHtml },
      ],
    };

    const mailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(mailPayload),
    });

    // MailChannels returns 202 on success
    if (mailResponse.status !== 202) {
      const mailError = await mailResponse.text();
      console.error('MailChannels error:', mailResponse.status, mailError);
      return jsonResponse(
        { error: 'Failed to send email. Please contact us directly.' },
        502
      );
    }

    // ── 5. Return success ───────────────────────────────────────
    return jsonResponse({ success: true, message: 'Order received! We will be in touch soon.' }, 200);

  } catch (err) {
    console.error('Unexpected error in /api/order:', err);
    return jsonResponse({ error: 'An unexpected error occurred.' }, 500);
  }
}

/**
 * Any non-POST request → 405 Method Not Allowed
 */
export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method not allowed.' }, 405);
}


/* ── HELPERS ────────────────────────────────────────────────── */

/** Returns a JSON Response with the given status code. */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*', // adjust if needed
    },
  });
}

/** Basic email format validation. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Plain-text email body. */
function buildEmailText({ name, email, product, quantity, notes }) {
  return `
New order received via Silly Stitches website
═══════════════════════════════════════════

Customer: ${name}
Email:    ${email}
Product:  ${product}
Quantity: ${quantity}
Notes:    ${notes || 'None provided'}

═══════════════════════════════════════════
Reply directly to this email to contact the customer.
`.trim();
}

/** HTML email body — styled for readability in email clients. */
function buildEmailHtml({ name, email, product, quantity, notes }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#fdf8f2;font-family:'Helvetica Neue',Arial,sans-serif;color:#3a2e28;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="
          background-color:#ffffff;
          border-radius:16px;
          overflow:hidden;
          border:1px solid #e8d9c5;
          box-shadow:0 4px 20px rgba(122,92,78,0.1);
          max-width:100%;
        ">

          <!-- Header -->
          <tr>
            <td style="
              background-color:#c4706a;
              padding:28px 40px;
              text-align:center;
            ">
              <p style="margin:0;font-size:1.8rem;">🧵</p>
              <h1 style="
                margin:8px 0 0;
                font-size:1.4rem;
                font-weight:600;
                color:#ffffff;
                letter-spacing:0.02em;
              ">New Order — Silly Stitches</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 24px;font-size:0.95rem;color:#7a5c4e;">
                You've received a new order via your website. Details are below.
              </p>

              <!-- Order table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="
                background-color:#fdf8f2;
                border-radius:10px;
                border:1px solid #e8d9c5;
                overflow:hidden;
              ">
                ${orderRow('Customer', name)}
                ${orderRow('Email', `<a href="mailto:${email}" style="color:#c4706a;font-weight:600;">${email}</a>`)}
                ${orderRow('Product', `<strong>${product}</strong>`)}
                ${orderRow('Quantity', quantity)}
                ${orderRow('Notes', notes || '<em style="color:#a08070;">None provided</em>')}
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin-top:32px;">
                <a href="mailto:${email}?subject=Re: Your Silly Stitches Order"
                  style="
                    display:inline-block;
                    background-color:#c4706a;
                    color:#ffffff;
                    padding:14px 28px;
                    border-radius:50px;
                    text-decoration:none;
                    font-weight:700;
                    font-size:0.9rem;
                  "
                >
                  Reply to Customer →
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              padding:20px 40px;
              border-top:1px solid #e8d9c5;
              text-align:center;
              font-size:0.78rem;
              color:#a08070;
            ">
              Silly Stitches · Handmade with love ♥
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`.trim();
}

/** Returns a two-column table row for the email. */
function orderRow(label, value) {
  return `
    <tr>
      <td style="
        padding:14px 20px;
        font-size:0.82rem;
        font-weight:700;
        color:#a08070;
        text-transform:uppercase;
        letter-spacing:0.06em;
        border-bottom:1px solid #e8d9c5;
        width:35%;
        vertical-align:top;
      ">${label}</td>
      <td style="
        padding:14px 20px;
        font-size:0.92rem;
        color:#3a2e28;
        border-bottom:1px solid #e8d9c5;
        vertical-align:top;
      ">${value}</td>
    </tr>
  `;
}
