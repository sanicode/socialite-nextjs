import * as Sentry from "@sentry/nextjs";
import { ApiError, requireApiEnabled } from '@/app/lib/api-auth'
export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring
export async function GET() {
  try {
    await requireApiEnabled()
    Sentry.logger.info("Sentry example API called");
    throw new SentryExampleAPIError(
      "This error is raised on the backend called by the example page.",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
