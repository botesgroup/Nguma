// Import required libraries
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define the structure of the notification record we expect from the trigger
interface NotificationRecord {
  id: string;
  user_id: string;
  message: string;
  link_to?: string;
  type?: string;
  priority?: string;
}

// Enhanced email template with type and priority support
const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'transaction': return '💰';
    case 'profit': return '📈';
    case 'contract': return '📄';
    case 'admin': return '⚙️';
    case 'system': return '🔔';
    default: return '🔔';
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'urgent': return '#EF4444'; // Red
    case 'high': return '#F59E0B'; // Orange
    case 'medium': return '#3B82F6'; // Blue
    case 'low': return '#6B7280'; // Gray
    default: return '#3B82F6';
  }
};

const getPriorityLabel = (priority?: string) => {
  switch (priority) {
    case 'urgent': return 'URGENT';
    case 'high': return 'IMPORTANT';
    case 'medium': return 'INFO';
    case 'low': return 'INFO';
    default: return 'INFO';
  }
};

// Enhanced HTML email template
const createEmailHtml = (message: string, link?: string, type?: string, priority?: string) => {
  const icon = getNotificationIcon(type);
  const priorityColor = getPriorityColor(priority);
  const priorityLabel = getPriorityLabel(priority);
  const siteUrl = Deno.env.get("SITE_URL") || "https://nguma.org";
  const fullLink = link ? new URL(link, siteUrl).toString() : null;

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification Nguma</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6; 
        color: #1F2937;
        background-color: #F3F4F6;
        padding: 20px;
      }
      .email-wrapper { 
        max-width: 600px; 
        margin: 0 auto; 
        background-color: #FFFFFF;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .email-header { 
        background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
        padding: 30px 20px;
        text-align: center;
        color: #FFFFFF;
      }
      .email-header h1 { 
        font-size: 28px; 
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.5px;
      }
      .priority-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-top: 10px;
        background-color: ${priorityColor};
        color: #FFFFFF;
      }
      .email-body { 
        padding: 40px 30px;
      }
      .notification-icon {
        font-size: 48px;
        text-align: center;
        margin-bottom: 20px;
      }
      .message-content { 
        background-color: #F9FAFB;
        padding: 20px;
        border-radius: 8px;
        border-left: 4px solid ${priorityColor};
        margin-bottom: 30px;
      }
      .message-content p {
        font-size: 16px;
        color: #374151;
        margin: 0;
      }
      .cta-button { 
        display: inline-block;
        padding: 14px 32px;
        background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
        color: #FFFFFF !important;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);
      }
      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(102, 126, 234, 0.5);
      }
      .button-container {
        text-align: center;
        margin: 30px 0;
      }
      .email-footer { 
        background-color: #F9FAFB;
        padding: 30px;
        text-align: center;
        border-top: 1px solid #E5E7EB;
      }
      .email-footer p {
        font-size: 13px;
        color: #6B7280;
        margin: 8px 0;
      }
      .email-footer a {
        color: #667EEA;
        text-decoration: none;
        font-weight: 500;
      }
      .divider {
        height: 1px;
        background: linear-gradient(90deg, rgba(102,126,234,0) 0%, rgba(102,126,234,0.3) 50%, rgba(102,126,234,0) 100%);
        margin: 20px 0;
      }
      @media only screen and (max-width: 600px) {
        .email-body { padding: 30px 20px; }
        .email-header { padding: 25px 15px; }
        .email-header h1 { font-size: 24px; }
        .cta-button { padding: 12px 24px; font-size: 14px; }
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-header">
        <h1>Nguma</h1>
        ${priority && (priority === 'urgent' || priority === 'high') ? `<div class="priority-badge">${priorityLabel}</div>` : ''}
      </div>
      
      <div class="email-body">
        <div class="notification-icon">${icon}</div>
        
        <div class="message-content">
          <p>${message}</p>
        </div>
        
        <div class="divider"></div>
        
        ${fullLink ? `
          <div class="button-container">
            <a href="${fullLink}" class="cta-button">Voir les détails</a>
          </div>
        ` : ''}
      </div>
      
      <div class="email-footer">
        <p><strong>Nguma</strong> - Votre plateforme d'investissement</p>
        <p>Vous recevez cet e-mail car vous avez activé les notifications pour votre compte.</p>
        <div class="divider"></div>
        <p>
          <a href="${siteUrl}">Accéder à Nguma</a> • 
          <a href="${siteUrl}/support">Support</a>
        </p>
      </div>
    </div>
  </body>
  </html>
`;
};

serve(async (req) => {
  console.log("--- New Request Received ---");

  // 1. Check for security key
  const authHeader = req.headers.get("Authorization")!;
  console.log("Auth Header:", authHeader ? "Present" : "Missing");
  if (authHeader !== `Bearer ${Deno.env.get("FUNCTION_SECRET")}`) {
    console.error("Unauthorized: Invalid or missing security key.");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("Request authorized. Processing...");
    // 2. Get the notification record from the request body
    const { record } = await req.json();
    const notification = record as NotificationRecord;
    console.log("Parsed Notification Record:", notification);

    // 3. Create a Supabase client to fetch user data
    const supabaseAdmin = createClient(
      Deno.env.get("PROJECT_SUPABASE_URL") ?? '',
      Deno.env.get("SERVICE_ROLE_KEY") ?? ''
    );
    console.log("Supabase admin client created.");

    // 4. Fetch the user's email from the profiles table
    console.log(`Fetching profile for user_id: ${notification.user_id}`);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", notification.user_id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      throw new Error(`Failed to fetch profile for user ${notification.user_id}: ${profileError.message}`);
    }
    console.log("Profile data fetched:", profile);

    const userEmail = profile.email;
    if (!userEmail) {
      console.error(`Email not found for user ${notification.user_id}`);
      throw new Error(`Email not found for user ${notification.user_id}`);
    }
    console.log(`Found user email: ${userEmail}`);

    // 5. Get the Resend API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set.");
      throw new Error("RESEND_API_KEY is not set in environment variables.");
    }
    console.log("Resend API Key: Present");

    // 6. Construct and send the email using the Resend API
    console.log("Constructing email HTML...");
    const emailHtml = createEmailHtml(notification.message, notification.link_to, notification.type, notification.priority);

    const emailPayload = {
      from: "Nguma <noreply@nguma.org>",
      to: userEmail,
      subject: "Nouvelle notification de Nguma",
      html: emailHtml,
    };
    console.log("Sending email with payload:", emailPayload);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    console.log(`Resend API response status: ${resendResponse.status}`);
    const resendData = await resendResponse.json();
    console.log("Resend API response data:", resendData);

    if (!resendResponse.ok) {
      console.error("Failed to send email. Resend API Error:", resendData);
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    // 7. Return a success response
    console.log("Email sent successfully. Resend ID:", resendData.id);
    return new Response(JSON.stringify({ message: "Email sent successfully", resendId: resendData.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("--- Unhandled Error in Edge Function ---");
    console.error(error.message);
    console.error("--------------------------------------");
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});