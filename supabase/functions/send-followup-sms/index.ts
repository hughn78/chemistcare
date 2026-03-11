import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — require a valid JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for DB queries (needs cross-user access to find due follow-ups)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find consultations finalised 24-48 hours ago that haven't had a follow-up SMS
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { data: consults, error: consultError } = await supabase
      .from("consultations")
      .select("id, patient_first_name, patient_last_name, finalised_at")
      .eq("status", "finalised")
      .not("finalised_at", "is", null)
      .gte("finalised_at", fortyEightHoursAgo)
      .lte("finalised_at", twentyFourHoursAgo);

    if (consultError) {
      console.error("Error fetching consults:", consultError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch consultations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!consults || consults.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No consults due for follow-up" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ consultId: string; status: string }> = [];

    for (const consult of consults) {
      const patientName = [consult.patient_first_name, consult.patient_last_name]
        .filter(Boolean)
        .join(" ") || "Patient";

      // Check if follow-up already sent for this consult
      const { data: existingMsg } = await supabase
        .from("sms_messages")
        .select("id")
        .eq("consult_id", consult.id)
        .eq("message_type", "follow_up")
        .eq("direction", "outbound")
        .limit(1)
        .maybeSingle();

      if (existingMsg) {
        results.push({ consultId: consult.id, status: "already_sent" });
        continue;
      }

      // Look up patient phone from the eight_cpa_patient_snapshots or sms_messages
      // First try to find a phone from prior SMS messages for this consult
      const { data: priorSms } = await supabase
        .from("sms_messages")
        .select("patient_phone")
        .eq("consult_id", consult.id)
        .eq("direction", "outbound")
        .limit(1)
        .maybeSingle();

      if (!priorSms?.patient_phone) {
        results.push({ consultId: consult.id, status: "no_phone" });
        continue;
      }

      const patientPhone = priorSms.patient_phone;

      // Check opt-in consent
      const { data: consent } = await supabase
        .from("patient_sms_consent")
        .select("opted_in")
        .eq("patient_phone", patientPhone)
        .maybeSingle();

      if (consent && !consent.opted_in) {
        results.push({ consultId: consult.id, status: "opted_out" });
        continue;
      }

      const messageBody = `Hi ${patientName}, how did your consult go? Rate 1-5 (1=poor, 5=excellent).\n\nAny issues? Reply or call (03) XXXX XXXX.\n\nThanks, ChemistCare\nReply STOP to unsubscribe.`;

      // Send via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const formData = new URLSearchParams();
      formData.append("To", patientPhone);
      formData.append("From", TWILIO_PHONE_NUMBER);
      formData.append("Body", messageBody);

      const twilioResponse = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const twilioData = await twilioResponse.json();

      if (twilioResponse.ok) {
        await supabase.from("sms_messages").insert({
          patient_name: patientName,
          patient_phone: patientPhone,
          message_type: "follow_up",
          message_body: messageBody,
          twilio_sid: twilioData.sid,
          status: twilioData.status || "queued",
          direction: "outbound",
          consult_id: consult.id,
        });
        sentCount++;
        results.push({ consultId: consult.id, status: "sent" });
      } else {
        await supabase.from("sms_messages").insert({
          patient_name: patientName,
          patient_phone: patientPhone,
          message_type: "follow_up",
          message_body: messageBody,
          status: "failed",
          direction: "outbound",
          consult_id: consult.id,
        });
        failedCount++;
        results.push({ consultId: consult.id, status: "failed" });
        console.error("Twilio error for consult", consult.id, twilioData);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failedCount, total: consults.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-followup-sms error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
