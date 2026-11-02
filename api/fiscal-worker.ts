import { createClient } from "@supabase/supabase-js";
import { QueueClient } from "@vercel/queue";
import { issuePendingFiscalDocuments } from "./_einvoicing-provider";

type FiscalQueueMessage = {
  billingDocumentId: string;
};

const queue =
  new QueueClient();

export default queue.handleNodeCallback(
  async (
    message: FiscalQueueMessage,
    metadata,
  ) => {
    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseAdminKey =
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseAdminKey
    ) {
      throw new Error(
        "Missing Supabase server configuration",
      );
    }

    if (
      !message?.billingDocumentId
    ) {
      throw new Error(
        "Missing billingDocumentId",
      );
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

    const result =
      await issuePendingFiscalDocuments({
        supabaseAdmin,
        documentId:
          message.billingDocumentId,
        limit: 1,
      });

    if (
      result.failed > 0 ||
      result.unknown > 0
    ) {
      throw new Error(
        `Fiscal issuance did not complete for ${message.billingDocumentId}`,
      );
    }

    console.log(
      "Fiscal queue processed",
      {
        billingDocumentId:
          message.billingDocumentId,
        messageId:
          metadata.messageId,
        deliveryCount:
          metadata.deliveryCount,
        result,
      },
    );
  },
  {
    retry: (
      error,
      metadata,
    ) => {
      if (
        metadata.deliveryCount >= 5
      ) {
        console.error(
          "Fiscal queue exhausted retries",
          {
            messageId:
              metadata.messageId,
            deliveryCount:
              metadata.deliveryCount,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );

        return {
          acknowledge: true,
        };
      }

      return {
        afterSeconds:
          Math.min(
            300,
            Math.max(
              20,
              20 *
                2 **
                  Math.max(
                    0,
                    metadata.deliveryCount -
                      1,
                  ),
            ),
          ),
      };
    },
  },
);
