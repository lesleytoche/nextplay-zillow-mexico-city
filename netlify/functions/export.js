const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '12');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Fetch all contacts from a Brevo list (handles pagination)
const fetchAllContacts = async (listId) => {
  const allContacts = [];
  const limit = 50;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `https://api.brevo.com/v3/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'api-key': BREVO_API_KEY,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Brevo API error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const contacts = data.contacts || [];
    allContacts.push(...contacts);

    if (contacts.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allContacts;
};

// Escape a CSV field value
const escapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Convert contacts to CSV string
const contactsToCSV = (contacts) => {
  const headers = [
    'Email',
    'First Name',
    'Last Name',
    'Job Title',
    'Company',
    'LinkedIn',
    'City',
    'Level',
    'Business Unit',
    'Engineer Specialty',
    'Relocation',
    'English Proficiency',
    'Career Interest',
    'Zillow Opt-In',
    'Questions',
    'Checked In',
    'Checked In At',
    'RSVP Date',
  ];

  const rows = contacts.map((contact) => {
    const attrs = contact.attributes || {};
    return [
      contact.email,
      attrs.FIRSTNAME || '',
      attrs.LASTNAME || '',
      attrs.JOB_TITLE || '',
      attrs.COMPANY || '',
      attrs.LINKEDIN || '',
      attrs.CITY || '',
      attrs.LEVEL || '',
      attrs.BUSINESS_UNIT || '',
      attrs.ENGINEER_SPECIALTY || '',
      attrs.RELOCATION || '',
      attrs.ENGLISH_PROFICIENCY || '',
      attrs.CAREER_INTEREST || '',
      attrs.ZILLOW_OPT_IN || '',
      attrs.QUESTIONS || '',
      attrs.CHECKED_IN || 'No',
      attrs.CHECKED_IN_AT || '',
      contact.createdAt || '',
    ].map(escapeCSV);
  });

  return [headers.map(escapeCSV).join(','), ...rows.map((r) => r.join(','))].join('\n');
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: 'OK' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const contacts = await fetchAllContacts(BREVO_LIST_ID);

    const csv = contactsToCSV(contacts);
    const now = new Date().toISOString().slice(0, 10);

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nextplay-mexico-city-rsvps-${now}.csv"`,
      },
      body: csv,
    };
  } catch (err) {
    console.error('Export error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to export contacts',
        message: err.message,
      }),
    };
  }
};
