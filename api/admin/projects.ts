import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import { createClient } from "@supabase/supabase-js";

type ProjectStatus = "active" | "inactive";

type CreateProjectBody = {
  business_id?: unknown;
  name?: unknown;
  live_url?: unknown;
  github_url?: unknown;
  status?: unknown;
};

const ALLOWED_STATUSES = new Set<ProjectStatus>([
  "active",
  "inactive",
]);

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "no-store");

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS",
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
    request.method !== "POST"
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
        data: projects,
        error: projectsError,
      } = await supabaseAdmin
        .from("connected_projects")
        .select(`
          id,
          business_id,
          name,
          live_url,
          github_url,
          project_key,
          status,
          created_at,
          updated_at
        `)
        .order("created_at", {
          ascending: false,
        });
    
      if (projectsError) {
        console.error(
          "Projects loading failed:",
          projectsError,
        );
      
        return response.status(500).json({
          error: projectsError.message,
          code: projectsError.code,
          details: projectsError.details,
          hint: projectsError.hint,
        });
      }
    
      const businessIds = [
        ...new Set(
          (projects ?? []).map(
            (project) => project.business_id,
          ),
        ),
      ];
    
      let businessesById = new Map<
        string,
        {
          id: string;
          name: string;
          slug: string;
        }
      >();
    
      if (businessIds.length > 0) {
        const {
          data: businesses,
          error: businessesError,
        } = await supabaseAdmin
          .from("businesses")
          .select("id, name, slug")
          .in("id", businessIds);
    
        if (businessesError) {
          console.error(
            "Project businesses loading failed:",
            businessesError,
          );
    
          return response.status(500).json({
            error: businessesError.message,
            code: businessesError.code,
            details: businessesError.details,
          });
        }
    
        businessesById = new Map(
          (businesses ?? []).map((business) => [
            business.id,
            business,
          ]),
        );
      }
    
      const projectsWithBusinesses =
        (projects ?? []).map((project) => ({
          ...project,
          businesses:
            businessesById.get(project.business_id) ??
            null,
        }));
    
      return response.status(200).json({
        projects: projectsWithBusinesses,
      });
    }

    const body = (request.body ??
      {}) as CreateProjectBody;

    const businessId =
      typeof body.business_id === "string"
        ? body.business_id.trim()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const liveUrl =
      typeof body.live_url === "string"
        ? body.live_url.trim()
        : "";

    const githubUrl =
      typeof body.github_url === "string"
        ? body.github_url.trim()
        : "";

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "active";

    if (!businessId) {
      return response.status(400).json({
        error: "Business ID is required",
      });
    }

    if (!name) {
      return response.status(400).json({
        error: "Project name is required",
      });
    }

    if (name.length > 120) {
      return response.status(400).json({
        error:
          "Project name must be 120 characters or fewer",
      });
    }

    if (!liveUrl) {
      return response.status(400).json({
        error: "Live URL is required",
      });
    }

    if (!isValidHttpUrl(liveUrl)) {
      return response.status(400).json({
        error: "Live URL must be a valid HTTP or HTTPS URL",
      });
    }

    if (
      githubUrl &&
      !isValidHttpUrl(githubUrl)
    ) {
      return response.status(400).json({
        error:
          "GitHub URL must be a valid HTTP or HTTPS URL",
      });
    }

    if (
      !ALLOWED_STATUSES.has(
        status as ProjectStatus,
      )
    ) {
      return response.status(400).json({
        error: "Invalid project status",
      });
    }

    const {
      data: business,
      error: businessError,
    } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, status")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "Business verification failed:",
        businessError,
      );

      return response.status(500).json({
        error: "Could not verify business",
      });
    }

    if (!business) {
      return response.status(404).json({
        error: "Business not found",
      });
    }

    const {
      data: existingProject,
      error: existingProjectError,
    } = await supabaseAdmin
      .from("connected_projects")
      .select("id")
      .eq("business_id", businessId)
      .eq("live_url", liveUrl)
      .maybeSingle();

    if (existingProjectError) {
      console.error(
        "Project duplication check failed:",
        existingProjectError,
      );

      return response.status(500).json({
        error: "Could not verify connected project",
      });
    }

    if (existingProject) {
      return response.status(409).json({
        error:
          "This live URL is already connected to the selected business",
      });
    }

    const {
      data: createdProject,
      error: createError,
    } = await supabaseAdmin
      .from("connected_projects")
      .insert({
        business_id: businessId,
        name,
        live_url: liveUrl,
        github_url: githubUrl || null,
        status,
      })
      .select(`
        id,
        business_id,
        name,
        live_url,
        github_url,
        project_key,
        status,
        created_at,
        updated_at
      `)
      .single();

    if (createError) {
      console.error(
        "Project creation failed:",
        createError,
      );

      if (createError.code === "23503") {
        return response.status(400).json({
          error: "The selected business does not exist",
        });
      }

      if (createError.code === "23505") {
        return response.status(409).json({
          error:
            "A connected project with these details already exists",
        });
      }

      return response.status(500).json({
        error: "Could not create connected project",
      });
    }

    const project = {
      ...createdProject,
      businesses: {
        id: business.id,
        name: business.name,
        slug: business.slug,
      },
    };
    
    return response.status(201).json({
      success: true,
      project,
    });
    
  } catch (error) {
    console.error(
      "Admin projects API error:",
      error,
    );

    return response.status(500).json({
      error: "Unexpected connected projects error",
    });
  }
}
