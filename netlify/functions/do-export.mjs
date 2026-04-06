export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200 });
  }

  try {
    const brevoApiKey = Netlify.env.get("BREVO_API_KEY");
    const brevoListId = Netlify.env.get("BREVO_LIST_ID") || "12";

    // Fetch all contacts from the Brevo list
    let allContacts = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const res = await fetch(
        `https://api.brevo.com/v3/contacts/lists/${brevoListId}/contacts?limit=${limit}&offset=${offset}`,
        {
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) break;

      const data = await res.json();
      const contacts = data.contacts || [];
      allContacts = allContacts.concat(contacts);

      if (contacts.length < limit) break;
      offset += limit;
    }

    // Build CSV
    const headers = [
      "Name",
      "Email",
      "Job Title",
      "Company",
      "LinkedIn",
      "City",
      "Level",
      "Career Interest",
      "Talent Community",
      "Business Unit",
      "Engineer Specialty",
      "Relocation",
      "English Proficiency",
      "Questions",
      "Checked In",
      "Checked In At",
    ];

    let csv = headers.join(",") + "\n";

    for (const contact of allContacts) {
      const attrs = contact.attributes || {};
      const email = (contact.email || "").toLowerCase().trim();
      const name = [attrs.FIRSTNAME, attrs.LASTNAME].filter(Boolean).join(" ");

      const checkedInAt = attrs.CHECKED_IN_AT || "";
      const checkedIn = checkedInAt ? "Yes" : "No";

      const row = [
        name,
        email,
        attrs.JOB_TITLE || "",
        attrs.COMPANY || "",
        attrs.LINKEDIN || "",
        attrs.CITY || "",
        attrs.LEVEL || "",
        attrs.CAREER_INTEREST || "",
        attrs.TALENT_COMMUNITY || "",
        attrs.BUSINESS_UNIT || "",
        attrs.ENGINEER_SPECIALTY || "",
        attrs.RELOCATION || "",
        attrs.ENGLISH_PROFICIENCY || "",
        attrs.QUESTIONS || "",
        checkedIn,
        checkedInAt,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

      csv += row.join(",") + "\n";
    }

    const filename = `nextplay-rsvps-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Export failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
