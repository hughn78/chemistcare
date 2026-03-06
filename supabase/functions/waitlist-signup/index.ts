import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, pharmacy_name } = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: insertError } = await supabase
      .from("waitlist_entries")
      .insert({
        email: email.toLowerCase().trim(),
        role: role || null,
        pharmacy_name: pharmacy_name || null,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, message: "You're already on the waitlist!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertError;
    }

    // Send notification via Lovable AI Gateway
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey) {
      try {
        await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "user",
                content: `Generate a brief notification for hugh@blackshawsroadpharmacy.com.au: New ChemistCareOS waitlist signup from ${email}${role ? `, role: ${role}` : ""}${pharmacy_name ? `, pharmacy: ${pharmacy_name}` : ""}. Keep to 2 sentences.`,
              },
            ],
            max_tokens: 150,
          }),
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    }

    console.log(`New waitlist signup: ${email} | role: ${role} | pharmacy: ${pharmacy_name}`);

    return new Response(
      JSON.stringify({ success: true, message: "You're on the list! We'll be in touch shortly." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Waitlist error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
