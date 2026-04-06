import crypto from "crypto";

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
    const {
      name,
      email,
      jobTitle,
      company,
      linkedin,
      city,
      careerInterest,
      talentCommunity,
      level,
      businessUnit,
      engineerSpecialty,
      relocation,
      englishProficiency,
      questions,
    } = body;

    if (!email || !name) {
      return new Response(
        JSON.stringify({ success: false, message: "Name and email are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const brevoApiKey = Netlify.env.get("BREVO_API_KEY");
    const brevoListId = parseInt(Netlify.env.get("BREVO_LIST_ID") || "12");
    const senderEmail = Netlify.env.get("SENDER_EMAIL") || "team@nextplayevents.com";

    // Split name into first and last
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Generate check-in token
    const checkInToken = crypto.randomBytes(32).toString("hex");

    // Create or update contact in Brevo
    const contactPayload = {
      email: email.toLowerCase().trim(),
      attributes: {
        FIRSTNAME: firstName,
        LASTNAME: lastName,
        JOB_TITLE: jobTitle || "",
        COMPANY: company || "",
        LINKEDIN: linkedin || "",
        CITY: city || "",
        LEVEL: level || "",
        CAREER_INTEREST: careerInterest || "",
        TALENT_COMMUNITY: talentCommunity || "",
        BUSINESS_UNIT: businessUnit || "",
        ENGINEER_SPECIALTY: engineerSpecialty || "",
        RELOCATION: relocation || "",
        ENGLISH_PROFICIENCY: englishProficiency || "",
        QUESTIONS: questions || "",
      },
      listIds: [brevoListId],
      updateEnabled: true,
    };

    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contactPayload),
    });

    if (!contactRes.ok) {
      const errText = await contactRes.text();
      // "duplicate_parameter" means contact exists - that's OK with updateEnabled
      if (!errText.includes("duplicate_parameter") && !errText.includes("Contact already exist")) {
        console.error("Brevo contact error:", errText);
      }
    }

    // Send confirmation email with QR code data
    const qrData = JSON.stringify({ email: email.toLowerCase().trim(), name, token: checkInToken });

    const emailPayload = {
      sender: { name: "Nextplay Events", email: senderEmail },
      to: [{ email: email.toLowerCase().trim(), name }],
      subject: "You're In! Nextplay LIVE — Mexico City 2026",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D0D0D; color: #fff; padding: 40px 24px; border-radius: 12px;">
          <h1 style="color: #D94130; margin-bottom: 8px;">NEXTPLAY LIVE</h1>
          <h2 style="color: #fff; font-size: 18px; margin-bottom: 24px;">Mexico City 2026</h2>
          <p>Hi ${firstName},</p>
          <p>Your RSVP is confirmed! We can't wait to see you.</p>
          <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> Thursday, April 16, 2026</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> 6:30 PM – 9:30 PM (CST)</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> Terraza Timberland, Mexico City</p>
            <p style="margin: 4px 0;"><strong>Dress Code:</strong> Smart Casual</p>
          </div>
          <p style="margin-bottom: 16px;">Show this QR code at the door for check-in:</p>
          <div style="text-align: center; margin: 24px 0;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}" alt="Check-in QR Code" style="border-radius: 8px; border: 4px solid #D94130;" />
          </div>
          <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 32px;">Presented by Zillow | nextplayevents.com</p>
        </div>
      `,
    };

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailRes.ok) {
      console.error("Email send error:", await emailRes.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "RSVP confirmed!",
        checkInToken,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("RSVP error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
