import crypto from 'crypto';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '12');
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'team@nextplayevents.com';
const SENDER_NAME = process.env.SENDER_NAME || 'Nextplay Events';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Handle CORS preflight requests
const handleOptions = () => {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: 'OK',
  };
};

// Generate a unique check-in token
const generateCheckInToken = () => {
  return crypto.randomUUID();
};

// Generate QR code data
const generateQRCodeData = (token, email, name) => {
  const qrData = {
    token,
    email,
    name,
  };
  return encodeURIComponent(JSON.stringify(qrData));
};

// Create/update contact in Brevo
const upsertContactInBrevo = async (contactData) => {
  try {
    // First, try to create a new contact
    const createResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: contactData.email,
        attributes: contactData.attributes,
        listIds: [BREVO_LIST_ID],
      }),
    });

    if (createResponse.ok) {
      return { success: true, created: true };
    }

    // If contact already exists (409 Conflict or 400 duplicate_parameter), update it instead
    const createErrorText = await createResponse.text();
    if (createResponse.status === 409 || (createResponse.status === 400 && createErrorText.includes('duplicate'))) {
      const updateResponse = await fetch(
        `https://api.brevo.com/v3/contacts/${contactData.email}`,
        {
          method: 'PUT',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attributes: contactData.attributes,
            listIds: [BREVO_LIST_ID],
          }),
        }
      );

      if (updateResponse.ok) {
        return { success: true, created: false };
      }

      throw new Error(
        `Failed to update contact: ${updateResponse.status} ${await updateResponse.text()}`
      );
    }

    throw new Error(
      `Failed to create contact: ${createResponse.status} ${createErrorText}`
    );
  } catch (error) {
    throw new Error(`Brevo contact operation failed: ${error.message}`);
  }
};

// Send confirmation email via Brevo
const sendConfirmationEmail = async (name, email, checkInToken) => {
  try {
    const qrCodeData = generateQRCodeData(checkInToken, email, name);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrCodeData}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              color: #ffffff;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            }
            .header {
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              padding: 40px 20px;
              text-align: center;
              border-bottom: 3px solid #d63447;
            }
            .header h1 {
              font-size: 32px;
              color: #d63447;
              margin-bottom: 10px;
              font-weight: 700;
            }
            .content {
              padding: 40px 20px;
              background: #1a1a1a;
            }
            .greeting {
              font-size: 18px;
              margin-bottom: 20px;
              color: #ffffff;
            }
            .event-details {
              background: rgba(214, 52, 71, 0.1);
              border-left: 4px solid #d63447;
              padding: 20px;
              margin: 30px 0;
              border-radius: 4px;
            }
            .event-details h3 {
              color: #d63447;
              margin-bottom: 12px;
              font-size: 16px;
            }
            .event-detail-item {
              margin: 8px 0;
              font-size: 14px;
              color: #e0e0e0;
            }
            .event-detail-item strong {
              color: #d63447;
              min-width: 100px;
              display: inline-block;
            }
            .qr-section {
              text-align: center;
              margin: 40px 0;
              padding: 30px 20px;
              background: rgba(214, 52, 71, 0.05);
              border-radius: 8px;
            }
            .qr-section h3 {
              color: #d63447;
              margin-bottom: 20px;
              font-size: 16px;
            }
            .qr-code {
              display: inline-block;
              background: white;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .qr-code img {
              display: block;
              width: 250px;
              height: 250px;
              border: none;
            }
            .qr-instructions {
              font-size: 14px;
              color: #e0e0e0;
              margin-top: 15px;
              font-weight: 500;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              background: #d63447;
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 600;
              font-size: 16px;
              transition: background 0.3s ease;
            }
            .button:hover {
              background: #c02840;
            }
            .footer {
              background: #0d0d0d;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #999;
              border-top: 1px solid #333;
            }
            .footer-text {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're In! 🎉</h1>
              <p style="color: #e0e0e0; font-size: 14px;">Your RSVP has been confirmed</p>
            </div>

            <div class="content">
              <div class="greeting">
                Hi <strong>${name.split(' ')[0]}</strong>,
              </div>

              <p style="margin-bottom: 20px; color: #e0e0e0;">
                Thank you for confirming your attendance at the Nextplay event! We're excited to see you there.
              </p>

              <div class="event-details">
                <h3>📅 Event Details</h3>
                <div class="event-detail-item">
                  <strong>Date:</strong> April 16, 2026
                </div>
                <div class="event-detail-item">
                  <strong>Time:</strong> 6:30 PM - 9:30 PM
                </div>
                <div class="event-detail-item">
                  <strong>Location:</strong> Mexico City
                </div>
              </div>

              <div class="qr-section">
                <h3>Your Check-in QR Code</h3>
                <p style="color: #e0e0e0; margin-bottom: 15px; font-size: 14px;">
                  Present this QR code at the door for seamless check-in
                </p>
                <div class="qr-code">
                  <img src="${qrCodeUrl}" alt="Check-in QR Code">
                </div>
                <div class="qr-instructions">
                  📱 Have this ready when you arrive
                </div>
              </div>

              <div class="button-container">
                <a href="https://nextplay-zillow-mexico-city.netlify.app" class="button">
                  View Event Page
                </a>
              </div>

              <p style="margin-top: 30px; color: #999; font-size: 13px;">
                If you have any questions or need to make changes to your RSVP, please don't hesitate to reach out.
              </p>
            </div>

            <div class="footer">
              <div class="footer-text">© 2026 Nextplay Events. All rights reserved.</div>
              <div class="footer-text">Mexico City | April 16, 2026</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: SENDER_NAME,
            email: SENDER_EMAIL,
          },
          to: [
            {
              email: email,
              name: name,
            },
          ],
          subject: 'Your Nextplay Event RSVP is Confirmed',
          htmlContent: emailHtml,
        }),
      }
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Email send failed: ${emailResponse.status} ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to send confirmation email: ${error.message}`);
  }
};

// Normalize form field names to handle different input variations
const normalizeFormData = (formData) => {
  return {
    name: formData.name || '',
    email: formData.email || '',
    jobTitle: formData.jobTitle || '',
    company: formData.company || '',
    linkedIn: formData.linkedIn || formData.linkedinProfile || '',
    city: formData.city || '',
    careerInterest: formData.careerInterest || formData.careerOpportunities || '',
    zillowOptIn: formData.zillowOptIn || formData.talentCommunity || '',
    level: formData.level || '',
    businessUnit: formData.businessUnit || '',
    engineerSpecialty: formData.engineerSpecialty || '',
    relocation: formData.relocation || '',
    englishProficiency: formData.englishProficiency || '',
    questions: formData.question || formData.questions || '',
  };
};

// Main handler
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    let formData;
    try {
      formData = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Normalize field names
    formData = normalizeFormData(formData);

    // Validate required fields
    if (!formData.name || !formData.email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Missing required fields: name and email',
        }),
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid email format' }),
      };
    }

    // Generate check-in token
    const checkInToken = generateCheckInToken();

    // Prepare contact attributes for Brevo
    const contactAttributes = {
      FIRSTNAME: formData.name.split(' ')[0],
      LASTNAME: formData.name.split(' ').slice(1).join(' ') || '',
      JOB_TITLE: formData.jobTitle,
      COMPANY: formData.company,
      LINKEDIN: formData.linkedIn,
      CITY: formData.city,
      CAREER_INTEREST: formData.careerInterest,
      ZILLOW_OPT_IN: formData.zillowOptIn,
      LEVEL: formData.level,
      BUSINESS_UNIT: formData.businessUnit,
      ENGINEER_SPECIALTY: formData.engineerSpecialty,
      RELOCATION: formData.relocation,
      ENGLISH_PROFICIENCY: formData.englishProficiency,
      QUESTIONS: formData.questions,
      CHECKIN_TOKEN: checkInToken,
      CHECKED_IN: 'No',
    };

    // Create/update contact in Brevo
    await upsertContactInBrevo({
      email: formData.email,
      attributes: contactAttributes,
    });

    // Send confirmation email
    await sendConfirmationEmail(formData.name, formData.email, checkInToken);

    // Return success response
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'RSVP submitted successfully',
        checkInToken: checkInToken,
        email: formData.email,
      }),
    };
  } catch (error) {
    console.error('RSVP handler error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
    };
  }
};
