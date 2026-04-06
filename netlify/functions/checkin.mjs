export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();

    if (!email) {
      return new Response(JSON.stringify({ success: false, message: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const brevoApiKey = Netlify.env.get("BREVO_API_KEY");
    const brevoListId = Netlify.env.get("BREVO_LIST_ID") || "12";

    // Look up contact in Brevo
    const contactRes = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!contactRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "This attendee was not found in the RSVP list.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const contact = await contactRes.json();

    // Verify contact is in the event list
    const listId = parseInt(brevoListId);
    if (!contact.listIds || !contact.listIds.includes(listId)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "This attendee was not found in the RSVP list.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const attrs = contact.attributes || {};
    const name =
      [attrs.FIRSTNAME, attrs.LASTNAME].filter(Boolean).join(" ") ||
      body.name ||
      email;

    // Check if already checked in using Brevo attribute
    const existingCheckIn = attrs.CHECKED_IN_AT || "";

    if (existingCheckIn) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyCheckedIn: true,
          message: "Already checked in",
          attendee: {
            name: name,
            email: email,
            company: attrs.COMPANY || "",
            jobTitle: attrs.JOB_TITLE || "",
            level: attrs.LEVEL || "",
            checkedInAt: existingCheckIn,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mark as checked in by updating Brevo contact attribute
    const checkedInAt = new Date().toISOString();

    await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attributes: {
            CHECKED_IN_AT: checkedInAt,
          },
        }),
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        alreadyCheckedIn: false,
        message: "Check-in successful!",
        attendee: {
          name: name,
          email: email,
          company: attrs.COMPANY || "",
          jobTitle: attrs.JOB_TITLE || "",
          level: attrs.LEVEL || "",
          checkedInAt: checkedInAt,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Check-in error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
