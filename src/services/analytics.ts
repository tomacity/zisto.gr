export interface AnalyticsEvent {
  event_name: string;
  source: string;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DailyActivity {
  date: string;
  page_views: number;
  menu_opens: number;
  review_clicks: number;
}

export interface AnalyticsResponse {
  business_id: string;

  totals: {
    page_views_today: number;
    page_views_week: number;
    page_views_month: number;

    unique_visitors_today: number;
    unique_visitors_week: number;
    unique_visitors_month: number;

    menu_opens_today: number;
    review_clicks_today: number;

    menu_conversion_rate: number;
    review_conversion_rate: number;
  };

  sources: {
    nfc: number;
    qr: number;
    direct: number;
    unknown: number;
  };

  daily_activity: DailyActivity[];
  recent_activity: AnalyticsEvent[];
}

const BUSINESS_ID =
  "021c48d4-fccc-4ccb-b37c-d42c2e341aa0";

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const response = await fetch(
    `/api/analytics?business_id=${BUSINESS_ID}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load analytics: ${response.status}`
    );
  }

  return response.json();
}
