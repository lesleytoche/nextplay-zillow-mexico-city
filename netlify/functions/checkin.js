const BREVO_API_KEY = process.env.BREVO_API_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: 'OK' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { token, email, name } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing email in QR data' }),
      };
    }

    // 1. Look up the contact in Brevo
    const contactRes = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'api-key': BREVO_API_KEY,
          Accept: 'application/json',
        },
      }
    );

    if (!contactRes.ok) {
      if (contactRes.status === 404) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: 'not_found',
            message: 'This attendee was not found in the RSVP list.',
          }),
        };
      }
      throw new Error(`Brevo lookup failed: ${contactRes.status}`);
    }

    const contact = await contactRes.json();
    const attributes = contact.attributes || {};

    // 2. Verify the check-in token matches
    if (token && attributes.CHECKIN_TOKEN && attributes.CHECKIN_TOKEN !== token) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: 'invalid_token',
          message: 'Invalid QR code. This does not match our records.',
        }),
      };
    }

    // 3. Check if already checked in
    if (attributes.CHECKED_IN === 'Yes') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          alreadyCheckedIn: true,
          message: 'This attendee has already been checked in.',
          attendee: {
            name: `${attributes.FIRSTNAME || ''} ${attributes.LASTNAME || ''}`.trim() || name || email,
            email: email,
            company: attributes.COMPANY || '',
            jobTitle: attributes.JOB_TITLE || '',
            level: attributes.LEVEL || '',
            checkedInAt: attributes.CHECKED_IN_AT || 'Earlier',
          },
        }),
      };
    }

    // 4. Mark as checked in
    const now = new Date().toISOString();
    const updateRes = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attributes: {
            CHECKED_IN: 'Yes',
            CHECKED_IN_AT: now,
          },
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('Failed to update check-in status:', errText);
      // Still return success info even if update fails
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        alreadyCheckedIn: false,
        message: 'Check-in successful!',
        attendee: {
          name: `${attributes.FIRSTNAME || ''} ${attributes.LASTNAME || ''}`.trim() || name || email,
          email: email,
          company: attributes.COMPANY || '',
          jobTitle: attributes.JOB_TITLE || '',
          level: attributes.LEVEL || '',
          checkedInAt: now,
        },
      }),
    };
  } catch (err) {
    console.error('Check-in error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: 'server_error',
        message: 'Something went wrong. Please try again or check in manually.',
      }),
    };
  }
};
