const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
  "https://zisto.app",
  "https://www.zisto.app",
]);

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin,
    );
  }

  res.setHeader("Vary", "Origin");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  res.setHeader(
    "Cache-Control",
    "no-store",
  );
}

async function supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path,
  method = "GET",
  headers = {},
  body,
}: {
  supabaseUrl: string;
  supabaseSecretKey: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  return fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body:
      body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });
}

export default async function handler(
  req: any,
  res: any,
) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (
    req.method !== "GET" &&
    req.method !== "POST" &&
    req.method !== "PATCH" &&
    req.method !== "DELETE"
  ) {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({
      error: "Server configuration error",
    });
  }

  const authorization =
    req.headers.authorization ?? "";

  const accessToken =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  const requestedBusinessId =
    typeof req.query.business_id ===
    "string"
      ? req.query.business_id
      : null;

  if (!accessToken) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    /*
     * Επιβεβαίωση χρήστη.
     */
    const userResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path: "/auth/v1/user",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      });

    if (!userResponse.ok) {
      return res.status(401).json({
        error:
          "Invalid or expired session",
      });
    }

    const user = await userResponse.json();

    /*
     * Έλεγχος admin.
     */
    const adminQuery =
      new URLSearchParams({
        user_id: `eq.${user.id}`,
        select: "user_id",
        limit: "1",
      });

    const adminResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/zisto_admins?${adminQuery.toString()}`,
      });

    if (!adminResponse.ok) {
      const errorText =
        await adminResponse.text();

      console.error(
        "Admin query failed:",
        errorText,
      );

      return res.status(500).json({
        error: "Failed to verify admin",
      });
    }

    const admins =
      await adminResponse.json();

    const isAdmin = admins.length > 0;

    /*
     * Φόρτωση membership.
     */
    const membershipQuery =
      new URLSearchParams({
        user_id: `eq.${user.id}`,
        select: "business_id,role",
        limit: "1",
      });

    const membershipResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/business_members?${membershipQuery.toString()}`,
      });

    if (!membershipResponse.ok) {
      const errorText =
        await membershipResponse.text();

      console.error(
        "Membership query failed:",
        errorText,
      );

      return res.status(500).json({
        error:
          "Failed to load membership",
      });
    }

    const memberships =
      await membershipResponse.json();

    const membership =
      memberships[0] ?? null;

    let businessId: string;

    if (
      isAdmin &&
      requestedBusinessId
    ) {
      businessId =
        requestedBusinessId;
    } else {
      if (!membership) {
        return res.status(403).json({
          error:
            "This user is not assigned to a business",
        });
      }

      businessId =
        membership.business_id;
    }

    /*
     * Locations της επιχείρησης.
     */
    const locationsQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,
        select: "id,name",
      });

    const locationsResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/locations?${locationsQuery.toString()}`,
      });

    if (!locationsResponse.ok) {
      const errorText =
        await locationsResponse.text();

      console.error(
        "Locations query failed:",
        errorText,
      );

      return res.status(500).json({
        error:
          "Failed to load locations",
      });
    }

    const locations =
      await locationsResponse.json();

    const locationIds = locations.map(
      (location: { id: string }) =>
        location.id,
    );

    if (locationIds.length === 0) {
      return res.status(200).json({
        cards: [],
      });
    }

    /*
     * Landing pages των locations.
     */
    const landingPagesQuery =
      new URLSearchParams({
        location_id:
          `in.(${locationIds.join(",")})`,
        select:
          "id,name,slug,location_id",
      });

    const landingPagesResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/landing_pages?${landingPagesQuery.toString()}`,
      });

    if (!landingPagesResponse.ok) {
      const errorText =
        await landingPagesResponse.text();

      console.error(
        "Landing pages query failed:",
        errorText,
      );

      return res.status(500).json({
        error:
          "Failed to load landing pages",
      });
    }

    const landingPages =
      await landingPagesResponse.json();

    if (req.method === "PATCH") {
      const cardId =
        typeof req.query.card_id === "string"
          ? req.query.card_id
          : null;
    
        const name =
          typeof req.body?.name === "string"
            ? req.body.name.trim()
            : null;
        
        const isActive =
          typeof req.body?.is_active === "boolean"
            ? req.body.is_active
            : null;

      const sortOrder =
        typeof req.body?.sort_order === "number"
          ? req.body.sort_order
          : null;
        
        if (!cardId) {
          return res.status(400).json({
            error: "Λείπει το card_id",
          });
        }
        
        if (
          name === null &&
          isActive === null &&
          sortOrder === null
        ) {
          return res.status(400).json({
            error: "Δεν δόθηκαν δεδομένα",
          });
        }
    
      const allowedLandingPageIds =
        landingPages.map(
          (page: { id: string }) => page.id,
        );
    
      const cardCheckQuery =
        new URLSearchParams({
          id: `eq.${cardId}`,
          landing_page_id:
            `in.(${allowedLandingPageIds.join(",")})`,
          select: "id",
          limit: "1",
        });
    
      const cardCheckResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/cards?${cardCheckQuery.toString()}`,
        });
    
      if (!cardCheckResponse.ok) {
        return res.status(500).json({
          error:
            "Απέτυχε ο έλεγχος της κάρτας",
        });
      }
    
      const matchingCards =
        await cardCheckResponse.json();
    
      if (matchingCards.length === 0) {
        return res.status(404).json({
          error:
            "Η κάρτα δεν βρέθηκε ή δεν ανήκει σε αυτή την επιχείρηση",
        });
      }
    
      const updateResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path: `/rest/v1/cards?id=eq.${encodeURIComponent(
            cardId,
          )}`,
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: {
            ...(name !== null && { name }),
          
            ...(isActive !== null && {
              is_active: isActive,
            }),
          
            ...(sortOrder !== null && {
              sort_order: sortOrder,
            }),
          
            updated_at: new Date().toISOString(),
          },
        });
    
      if (!updateResponse.ok) {
        const errorText =
          await updateResponse.text();
    
        console.error(
          "Card update failed:",
          errorText,
        );
    
        return res.status(500).json({
          error:
            "Απέτυχε η αλλαγή ονόματος",
        });
      }
    
      const updatedCards =
        await updateResponse.json();
    
      return res.status(200).json({
        card: updatedCards[0],
      });
    }

    if (req.method === "DELETE") {
      const cardId =
        typeof req.query.card_id === "string"
          ? req.query.card_id
          : null;
    
      if (!cardId) {
        return res.status(400).json({
          error: "Λείπει το card_id",
        });
      }
    
      const deleteResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path: `/rest/v1/cards?id=eq.${cardId}`,
          method: "DELETE",
        });
    
      if (!deleteResponse.ok) {
        const errorText =
          await deleteResponse.text();
    
        console.error(errorText);
    
        return res.status(500).json({
          error:
            "Απέτυχε η διαγραφή",
        });
      }
    
      return res.status(200).json({
        success: true,
      });
    }

    if (req.method === "POST") {
      const name =
        typeof req.body?.name === "string"
          ? req.body.name.trim()
          : "";
    
      if (!name) {
        return res.status(400).json({
          error: "Δώσε όνομα τραπεζιού",
        });
      }
    
      const publicToken = crypto.randomUUID();
    
      const createResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path: "/rest/v1/cards",
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: {
            landing_page_id: landingPages[0].id,
            name,
            card_type: "nfc",
            public_token: publicToken,
            is_active: true,
            sort_order: 0,
          },
        });
    
      if (!createResponse.ok) {
        const errorText =
          await createResponse.text();
    
        console.error(errorText);
    
        return res.status(500).json({
          error:
            "Απέτυχε η δημιουργία τραπεζιού",
        });
      }
    
      const created =
        await createResponse.json();
    
      return res.status(201).json({
        card: created[0],
      });
    }

    const landingPageIds =
      landingPages.map(
        (page: { id: string }) =>
          page.id,
      );

    if (
      landingPageIds.length === 0
    ) {
      return res.status(200).json({
        cards: [],
      });
    }

    /*
     * Cards που ανήκουν στα landing pages.
     */
   const cardsQuery =
    new URLSearchParams({
      landing_page_id:
        `in.(${landingPageIds.join(",")})`,
  
      select: [
        "id",
        "landing_page_id",
        "name",
        "card_type",
        "public_token",
        "placement",
        "is_active",
        "sort_order",
        "created_at",
        "updated_at",
      ].join(","),
  
      order: "sort_order.asc",
    });

    const cardsResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/cards?${cardsQuery.toString()}`,
      });

    if (!cardsResponse.ok) {
      const errorText =
        await cardsResponse.text();

      console.error(
        "Cards query failed:",
        errorText,
      );

      return res.status(500).json({
        error: "Failed to load cards",
      });
    }

    const cards =
      await cardsResponse.json();
    
    const eventsResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/analytics_events?${eventsQuery.toString()}`,
      });
    
    if (!eventsResponse.ok) {
      const errorText =
        await eventsResponse.text();
    
      console.error(
        "Card analytics query failed:",
        errorText,
      );
    
      return res.status(500).json({
        error:
          "Failed to load card analytics",
      });
    }
    
    const analyticsEvents =
      await eventsResponse.json();

   const enrichedCards = cards.map(
    (card: any) => {
      const landingPage =
        landingPages.find(
          (page: any) =>
            page.id ===
            card.landing_page_id,
        );

      const location =
        locations.find(
          (item: any) =>
            item.id ===
            landingPage?.location_id,
        );
      
      const source =
        card.card_type === "qr"
          ? "qr"
          : "nfc";

      const cardEvents =
        analyticsEvents.filter(
          (event: any) =>
            event.card_id === card.id ||
            event.metadata?.card_token ===
              card.public_token,
        );
      
      const tapEvents =
        cardEvents.filter(
          (event: any) =>
            event.event_type === "page_view",
        );
      
      const menuEvents =
        cardEvents.filter(
          (event: any) =>
            event.event_type === "menu_open" ||
            event.event_type === "menu_click",
        );
      
      const reviewEvents =
        cardEvents.filter(
          (event: any) =>
            event.event_type === "review_open" ||
            event.event_type === "review_click",
        );
        
      const uniqueVisitors =
        new Set(
          tapEvents
            .map(
              (event: any) =>
                event.visitor_id ||
                event.session_id,
            )
            .filter(Boolean),
        ).size;
  
      return {
        ...card,
  
        landing_page_name:
          landingPage?.name ?? null,
  
        location_name:
          location?.name ?? null,
  
        tracking_url:
          `https://tomacity.github.io/tsipouradiko-smart-link-/?source=${source}&card=${card.public_token}`,
  
        analytics: {
          total_taps:
            tapEvents.length,
  
          menu_opens:
            menuEvents.length,
  
          review_clicks:
            reviewEvents.length,
  
          unique_visitors:
            uniqueVisitors,
  
          last_used_at:
            cardEvents[0]?.created_at ??
            null,
        },
      };
    },
  );
    return res.status(200).json({
      business_id: businessId,
      cards: enrichedCards,
    });
  } catch (error) {
    console.error(
      "Cards API error:",
      error,
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}
