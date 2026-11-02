import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { issuePendingFiscalDocuments } from "./_einvoicing-provider";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const authorization =
    request.headers.authorization ?? "";

  const cronSecret =
    process.env.CRON_SECRET;

  if (
    !cronSecret ||
    authorization !==
      `Bearer ${cronSecret}`
  ) {
    return response.status(401).json({
      error: "Unauthorized",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseAdminKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseAdminKey
  ) {
    return response.status(500).json({
      error:
        "Missing Supabase server configuration",
    });
  }

  const supabaseAdmin =
    createClient(
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
    const result =
      await issuePendingFiscalDocuments({
        supabaseAdmin,
        limit: 10,
      });

    return response
      .status(200)
      .json(result);
  } catch (error) {
    console.error(
      "Fiscal queue failed:",
      error,
    );

    return response
      .status(500)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Fiscal queue failed",
      });
  }
}
