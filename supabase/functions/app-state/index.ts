import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function cleanObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function loadState(req: Request) {
  const viewer = await requireUser(req);
  const viewerMetadata = viewer?.user_metadata as Record<string, unknown> | undefined;
  let viewerGroupId = viewerMetadata?.group_id ? String(viewerMetadata.group_id) : "";
  if (viewer) {
    const { data: viewerProfile } = await supabase
      .from("robot_profiles")
      .select("group_id")
      .eq("auth_user_id", viewer.id)
      .maybeSingle();
    if (!viewerGroupId && viewerProfile?.group_id) {
      viewerGroupId = String(viewerProfile.group_id);
    }
  }
  const [groups, profiles, collections, instructions] = await Promise.all([
    supabase.from("robot_groups").select("*").order("created_at", { ascending: true }),
    viewer && viewerGroupId
      ? supabase.from("robot_profiles").select("*").eq("group_id", viewerGroupId).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    viewer && viewerGroupId
      ? supabase.from("robot_collections").select("*").eq("group_id", viewerGroupId).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    viewer && viewerGroupId
      ? supabase.from("robot_instructions").select("*").eq("group_id", viewerGroupId).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = groups.error || profiles.error || collections.error || instructions.error;
  if (error) throw error;

  const users = (profiles.data || []).map((row) => ({
    ...(row.payload || {}),
    id: row.id,
    supabaseAuthId: row.auth_user_id || row.payload?.supabaseAuthId || "",
    name: row.name,
    login: row.login,
    role: row.role,
    groupId: row.group_id || row.payload?.groupId || "group-1",
    exp: row.exp || 0,
    completedInstructions: [],
    instructionResults: {},
    teacherConfirmCode: row.teacher_confirm_code || "",
    active: row.active !== false,
    activeUntil: row.active_until,
    lastCompletedAt: row.last_completed_at,
    createdAt: row.payload?.createdAt || row.created_at,
  }));
  const userById = new Map(users.map((user) => [user.id, user]));
  const userIds = users.map((user) => user.id).filter(Boolean);
  const results = userIds.length
    ? await supabase.from("robot_instruction_results").select("*").in("user_id", userIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (results.error) throw results.error;

  for (const result of results.data || []) {
    const user = userById.get(result.user_id);
    if (!user) continue;
    user.instructionResults[result.instruction_id] = {
      ...(result.payload || {}),
      earnedExp: result.earned_exp || 0,
      completedAt: result.completed_at || result.payload?.completedAt || null,
    };
    if (!user.completedInstructions.includes(result.instruction_id)) {
      user.completedInstructions.push(result.instruction_id);
    }
  }

  return {
    groups: (groups.data || []).map((row) => ({
      ...(row.payload || {}),
      id: row.id,
      code: row.code,
      name: row.name,
      teacherName: row.teacher_name || "",
    })),
    users,
    collections: (collections.data || []).map((row) => ({
      ...(row.payload || {}),
      id: row.id,
      name: row.name,
      groupId: row.group_id || row.payload?.groupId || "group-1",
    })),
    instructions: (instructions.data || []).map((row) => ({
      ...(row.payload || {}),
      id: row.id,
      title: row.title,
      groupId: row.group_id || row.payload?.groupId || "group-1",
      collectionId: row.collection_id || row.payload?.collectionId || "",
      difficulty: row.difficulty || row.payload?.difficulty || "easy",
    })),
  };
}

async function saveState(state: Record<string, unknown>) {
  const groups = Array.isArray(state.groups) ? state.groups as Array<Record<string, unknown>> : [];
  const users = Array.isArray(state.users) ? state.users as Array<Record<string, unknown>> : [];
  const collections = Array.isArray(state.collections) ? state.collections as Array<Record<string, unknown>> : [];
  const instructions = Array.isArray(state.instructions) ? state.instructions as Array<Record<string, unknown>> : [];

  if (groups.length) {
    const rows = groups.filter((group) => group.id).map((group) => cleanObject({
      id: String(group.id),
      code: String(group.code || ""),
      name: String(group.name || ""),
      teacher_name: group.teacherName ? String(group.teacherName) : null,
      payload: group,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("robot_groups").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  if (collections.length) {
    const rows = collections.filter((collection) => collection.id).map((collection) => cleanObject({
      id: String(collection.id),
      group_id: collection.groupId ? String(collection.groupId) : "group-1",
      name: String(collection.name || ""),
      payload: collection,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("robot_collections").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  if (instructions.length) {
    const collectionIds = new Set(collections.map((collection) => String(collection.id)));
    const rows = instructions.filter((instruction) => instruction.id).map((instruction) => cleanObject({
      id: String(instruction.id),
      group_id: instruction.groupId ? String(instruction.groupId) : "group-1",
      collection_id: instruction.collectionId && collectionIds.has(String(instruction.collectionId)) ? String(instruction.collectionId) : null,
      title: String(instruction.title || ""),
      category: Array.isArray(instruction.categories) ? instruction.categories.join(", ") : null,
      difficulty: instruction.difficulty ? String(instruction.difficulty) : "easy",
      payload: instruction,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("robot_instructions").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  if (users.length) {
    const rows = users.filter((user) => user.id && user.login).map((user) => {
      const { password: _password, ...safePayload } = user;
      const completed = Array.isArray(user.completedInstructions) ? user.completedInstructions : [];
      return cleanObject({
        id: String(user.id),
        auth_user_id: isUuid(user.supabaseAuthId) ? user.supabaseAuthId : (isUuid(user.id) ? user.id : null),
        login: String(user.login),
        name: String(user.name || user.login),
        role: String(user.role || "user"),
        group_id: user.groupId ? String(user.groupId) : "group-1",
        exp: Number(user.exp || 0),
        completed_count: completed.length,
        teacher_confirm_code: user.teacherConfirmCode ? String(user.teacherConfirmCode) : null,
        active: user.active !== false,
        active_until: user.activeUntil || null,
        last_completed_at: user.lastCompletedAt || null,
        payload: safePayload,
        updated_at: new Date().toISOString(),
      });
    });
    const { error } = await supabase.from("robot_profiles").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  const instructionIds = new Set(instructions.map((instruction) => String(instruction.id)));
  const resultRows: Array<Record<string, unknown>> = [];
  for (const user of users) {
    if (!user.id) continue;
    const completed = new Set(Array.isArray(user.completedInstructions) ? user.completedInstructions.map(String) : []);
    const resultMap = user.instructionResults && typeof user.instructionResults === "object"
      ? user.instructionResults as Record<string, Record<string, unknown>>
      : {};
    Object.keys(resultMap).forEach((instructionId) => completed.add(instructionId));
    for (const instructionId of completed) {
      if (!instructionIds.has(instructionId)) continue;
      const result = resultMap[instructionId] || {};
      resultRows.push(cleanObject({
        user_id: String(user.id),
        instruction_id: instructionId,
        earned_exp: Number(result.earnedExp || 0),
        completed_at: result.completedAt || user.lastCompletedAt || null,
        payload: result,
        updated_at: new Date().toISOString(),
      }));
    }
  }

  if (users.length) {
    const userIds = users.filter((user) => user.id).map((user) => String(user.id));
    await supabase.from("robot_instruction_results").delete().in("user_id", userIds);
  }
  if (resultRows.length) {
    const { error } = await supabase.from("robot_instruction_results").upsert(resultRows, { onConflict: "user_id,instruction_id" });
    if (error) throw error;
  }

  const managedGroupIds = new Set<string>();
  for (const user of users) {
    if (user.groupId) managedGroupIds.add(String(user.groupId));
  }
  for (const collection of collections) {
    if (collection.groupId) managedGroupIds.add(String(collection.groupId));
  }
  for (const instruction of instructions) {
    if (instruction.groupId) managedGroupIds.add(String(instruction.groupId));
  }

  for (const groupId of managedGroupIds) {
    const instructionIds = new Set(instructions
      .filter((instruction) => String(instruction.groupId || "group-1") === groupId && instruction.id)
      .map((instruction) => String(instruction.id)));
    const collectionIds = new Set(collections
      .filter((collection) => String(collection.groupId || "group-1") === groupId && collection.id)
      .map((collection) => String(collection.id)));

    const { data: existingInstructions, error: existingInstructionsError } = await supabase
      .from("robot_instructions")
      .select("id")
      .eq("group_id", groupId);
    if (existingInstructionsError) throw existingInstructionsError;
    const staleInstructionIds = (existingInstructions || [])
      .map((row) => String(row.id))
      .filter((id) => !instructionIds.has(id));
    if (staleInstructionIds.length) {
      const { error: instructionDeleteError } = await supabase
        .from("robot_instructions")
        .delete()
        .in("id", staleInstructionIds);
      if (instructionDeleteError) throw instructionDeleteError;
    }

    const { data: existingCollections, error: existingCollectionsError } = await supabase
      .from("robot_collections")
      .select("id")
      .eq("group_id", groupId);
    if (existingCollectionsError) throw existingCollectionsError;
    const staleCollectionIds = (existingCollections || [])
      .map((row) => String(row.id))
      .filter((id) => !collectionIds.has(id));
    if (staleCollectionIds.length) {
      const { error: collectionDeleteError } = await supabase
        .from("robot_collections")
        .delete()
        .in("id", staleCollectionIds);
      if (collectionDeleteError) throw collectionDeleteError;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      return json(await loadState(req));
    }

    if (req.method === "POST") {
      const user = await requireUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);
      await saveState(await req.json());
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected backend error" }, 500);
  }
});
