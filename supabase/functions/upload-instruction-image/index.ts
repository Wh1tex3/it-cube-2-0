import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bucketName = "instruction-images";
const maxFileSize = 15 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function sanitizeStorageSegment(value: unknown) {
  return String(value || "file")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

function getFileExtension(file: File) {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  if (/^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const fromType = file.type.split("/").pop() || "jpg";
  return sanitizeStorageSegment(fromType);
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function canManageUploads(profile: { role?: string; group_id?: string; active?: boolean } | null, groupId: string) {
  if (!profile || profile.active === false) return false;
  if (profile.group_id !== groupId) return false;
  return profile.role === "admin" || profile.role === "moderator";
}

async function canUploadForGroup(user: { id: string; user_metadata?: Record<string, unknown> }, groupId: string) {
  const { data, error } = await supabase
    .from("robot_profiles")
    .select("id, role, group_id, active, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!error && canManageUploads(data, groupId)) {
    return true;
  }

  const login = typeof user.user_metadata?.login === "string" ? user.user_metadata.login.trim() : "";
  if (!login) return false;

  const { data: profileByLogin, error: loginError } = await supabase
    .from("robot_profiles")
    .select("id, role, group_id, active, auth_user_id")
    .eq("login", login)
    .eq("group_id", groupId)
    .maybeSingle();

  if (loginError || !canManageUploads(profileByLogin, groupId)) {
    return false;
  }

  if (!profileByLogin.auth_user_id) {
    await supabase
      .from("robot_profiles")
      .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
      .eq("id", profileByLogin.id);
  }

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const form = await req.formData();
    const file = form.get("file");
    const groupId = sanitizeStorageSegment(form.get("groupId"));
    const instructionId = sanitizeStorageSegment(form.get("instructionId"));
    const order = Math.max(1, Number(form.get("order") || 1));

    if (!(file instanceof File)) {
      return json({ error: "Image file is required." }, 400);
    }
    if (!allowedTypes.has(file.type)) {
      return json({ error: "Only JPEG, PNG, WebP and GIF images are allowed." }, 400);
    }
    if (file.size > maxFileSize) {
      return json({ error: "Image file is too large." }, 413);
    }
    if (!groupId || !instructionId) {
      return json({ error: "Group and instruction are required." }, 400);
    }
    if (!(await canUploadForGroup(user, groupId))) {
      return json({ error: "Forbidden" }, 403);
    }

    const extension = getFileExtension(file);
    const baseName = sanitizeStorageSegment(file.name.replace(/\.[^.]+$/, ""));
    const path = `${groupId}/${instructionId}/${String(order).padStart(3, "0")}-${Date.now()}-${baseName}.${extension}`;
    const { error } = await supabase.storage.from(bucketName).upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return json({
      path,
      publicUrl: data.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected upload error" }, 500);
  }
});
