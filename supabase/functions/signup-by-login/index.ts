import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hashLogin(value: string) {
  let hash = 0x811c9dc5;
  const text = value.trim().toLowerCase();
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function technicalEmailForLogin(login: string) {
  const raw = login.trim().toLowerCase();
  const slug = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "user";
  return `${slug}-${hashLogin(raw)}@pethjltfxanjmkbhziwt.supabase.co`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const { login, password, metadata = {} } = await req.json();
    const cleanLogin = String(login || "").trim();
    const cleanPassword = String(password || "");

    if (!cleanLogin) {
      return Response.json({ error: "Укажите логин." }, { status: 400, headers: corsHeaders });
    }
    if (cleanPassword.length < 6) {
      return Response.json({ error: "Пароль должен быть не короче 6 символов." }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Supabase Edge Function is missing service credentials." }, { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = technicalEmailForLogin(cleanLogin);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        ...metadata,
        login: cleanLogin,
        technical_email: email,
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "Пользователь с таким логином уже существует."
        : error.message;
      return Response.json({ error: message }, { status: 400, headers: corsHeaders });
    }

    return Response.json({
      user: {
        id: data.user?.id,
        email,
      },
    }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Не удалось создать пользователя." }, { status: 500, headers: corsHeaders });
  }
});
