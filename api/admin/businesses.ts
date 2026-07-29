import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

type BusinessStatus = "active" | "inactive";

type CreateBusinessBody = {
  name?: unknown;
  slug?: unknown;
  timezone?: unknown;
  status?: unknown;
};

const ALLOWED_STATUSES = new Set<BusinessStatus>([
  "active",
  "inactive",
]);

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0370-\u03ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "no-store");

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, OPTIONS",
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (
    request.method !== "GET" &&
    request.method !== "POST" &&
    request.method !== "PATCH"
  ) {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;

  const supabaseAdminKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAdminKey) {
    return response.status(500).json({
      error: "Missing Supabase server configuration",
    });
  }

  const authorization =
    request.headers.authorization ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return response.status(401).json({
      error: "Authentication required",
    });
  }

  const accessToken = authorization
    .slice("Bearer ".length)
    .trim();

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseAdminKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  try {
    const {
      data: { user: requestingUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !requestingUser) {
      return response.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const {
      data: adminRecord,
      error: adminError,
    } = await supabaseAdmin
      .from("zisto_admins")
      .select("user_id")
      .eq("user_id", requestingUser.id)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification failed:",
        adminError,
      );

      return response.status(500).json({
        error: "Could not verify admin access",
      });
    }

    if (!adminRecord) {
      return response.status(403).json({
        error: "Zisto admin access required",
      });
    }

    if (request.method === "GET") {
      const {
        data: businesses,
        error: businessesError,
      } = await supabaseAdmin
        .from("businesses")
        .select(`
          id,
          name,
          slug,
          timezone,
          status,
          created_at,
          updated_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (businessesError) {
        console.error(
          "Businesses loading failed:",
          businessesError,
        );

        return response.status(500).json({
          error: "Could not load businesses",
        });
      }

      return response.status(200).json({
        businesses: businesses ?? [],
      });
    }

    if (request.method === "PATCH") {
      const body = (request.body ?? {}) as {
        id?: unknown;
        name?: unknown;
        slug?: unknown;
        timezone?: unknown;
        status?: unknown;
      };
    
      const id =
        typeof body.id === "string"
          ? body.id.trim()
          : "";
    
      const name =
        typeof body.name === "string"
          ? body.name.trim()
          : "";
    
      const requestedSlug =
        typeof body.slug === "string"
          ? body.slug.trim()
          : "";
    
      const timezone =
        typeof body.timezone === "string"
          ? body.timezone.trim()
          : "";
    
      const status =
        typeof body.status === "string"
          ? body.status.trim()
          : "";
    
      if (!id) {
        return response.status(400).json({
          error: "Business ID is required",
        });
      }
    
      if (!name) {
        return response.status(400).json({
          error: "Business name is required",
        });
      }
    
      if (name.length > 120) {
        return response.status(400).json({
          error:
            "Business name must be 120 characters or fewer",
        });
      }
    
      const slug = createSlug(requestedSlug || name);
    
      if (!slug) {
        return response.status(400).json({
          error: "A valid slug is required",
        });
      }
    
      if (slug.length > 100) {
        return response.status(400).json({
          error:
            "Slug must be 100 characters or fewer",
        });
      }
    
      if (!timezone) {
        return response.status(400).json({
          error: "Timezone is required",
        });
      }
    
      if (
        !ALLOWED_STATUSES.has(
          status as BusinessStatus,
        )
      ) {
        return response.status(400).json({
          error: "Invalid business status",
        });
      }
    
      const {
        data: existingBusiness,
        error: existingBusinessError,
      } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();
    
      if (existingBusinessError) {
        console.error(
          "Business slug verification failed:",
          existingBusinessError,
        );
    
        return response.status(500).json({
          error: "Could not verify business slug",
        });
      }
    
      if (existingBusiness) {
        return response.status(409).json({
          error:
            "A business with this slug already exists",
        });
      }
    
      const {
        data: business,
        error: updateError,
      } = await supabaseAdmin
        .from("businesses")
        .update({
          name,
          slug,
          timezone,
          status,
        })
        .eq("id", id)
        .select(`
          id,
          name,
          slug,
          timezone,
          status,
          created_at,
          updated_at
        `)
        .single();
    
      if (updateError) {
        console.error(
          "Business update failed:",
          updateError,
        );
    
        if (updateError.code === "23505") {
          return response.status(409).json({
            error:
              "A business with this slug already exists",
          });
        }
    
        return response.status(500).json({
          error: "Could not update business",
        });
      }
    
      return response.status(200).json({
        success: true,
        business,
      });
    }

    const body = (request.body ??
      {}) as CreateBusinessBody;

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const requestedSlug =
      typeof body.slug === "string"
        ? body.slug.trim()
        : "";

    const timezone =
      typeof body.timezone === "string"
        ? body.timezone.trim()
        : "Europe/Athens";

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "active";

    if (!name) {
      return response.status(400).json({
        error: "Business name is required",
      });
    }

    if (name.length > 120) {
      return response.status(400).json({
        error:
          "Business name must be 120 characters or fewer",
      });
    }

    const slug = createSlug(requestedSlug || name);

    if (!slug) {
      return response.status(400).json({
        error: "A valid slug is required",
      });
    }

    if (slug.length > 100) {
      return response.status(400).json({
        error:
          "Slug must be 100 characters or fewer",
      });
    }

    if (!timezone) {
      return response.status(400).json({
        error: "Timezone is required",
      });
    }

    if (
      !ALLOWED_STATUSES.has(
        status as BusinessStatus,
      )
    ) {
      return response.status(400).json({
        error: "Invalid business status",
      });
    }

    const {
      data: existingBusiness,
      error: existingBusinessError,
    } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingBusinessError) {
      console.error(
        "Slug verification failed:",
        existingBusinessError,
      );

      return response.status(500).json({
        error: "Could not verify business slug",
      });
    }

    if (existingBusiness) {
      return response.status(409).json({
        error:
          "A business with this slug already exists",
      });
    }

    const {
      data: business,
      error: createError,
    } = await supabaseAdmin
      .from("businesses")
      .insert({
        name,
        slug,
        timezone,
        status,
      })
      .select(`
        id,
        name,
        slug,
        timezone,
        status,
        created_at,
        updated_at
      `)
      .single();

    if (createError) {
      console.error(
        "Business creation failed:",
        createError,
      );

      if (createError.code === "23505") {
        return response.status(409).json({
          error:
            "A business with this slug already exists",
        });
      }

      return response.status(500).json({
        error: "Could not create business",
      });
    }

    return response.status(201).json({
      success: true,
      business,
    });
  } catch (error) {
    console.error(
      "Admin businesses API error:",
      error,
    );

    return response.status(500).json({
      error: "Unexpected businesses error",
    });
  }
}
