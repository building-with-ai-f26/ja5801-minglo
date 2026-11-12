import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && existsSync(".env"))
  process.loadEnvFile(".env");
const db = new PrismaClient();
try {
  const args = process.argv.slice(2);
  if (args[0] === "--show" && args.length === 2) {
    // A report ID scopes disclosure to one reported message, never a transcript.
    const report = await db.messageReport.findUnique({
      where: { id: args[1] },
    });
    if (!report) throw new Error("Report unavailable.");
    const match = /^(private|direct):([a-z][a-z0-9]{24})$/.exec(
      report.conversationKey,
    );
    let message = null;
    if (report.conversationKey === "public")
      message = await db.publicMessage.findUnique({
        where: { id: report.messageId },
        select: { id: true, body: true, createdAt: true },
      });
    else if (match?.[1] === "private")
      message = await db.message.findFirst({
        where: { id: report.messageId, roomId: match[2] },
        select: { id: true, body: true, createdAt: true },
      });
    else if (match?.[1] === "direct")
      message = await db.directMessage.findFirst({
        where: { id: report.messageId, conversationId: match[2] },
        select: { id: true, body: true, createdAt: true },
      });
    console.log(
      JSON.stringify(
        {
          reportId: report.id,
          reason: report.reason,
          conversationKey: report.conversationKey,
          message,
        },
        null,
        2,
      ),
    );
  } else if (args[0] === "--resolve") {
    const id = args[1];
    const note = args[2] === "--note" ? args[3]?.trim() : "";
    if (!id || !note || note.length > 500)
      throw new Error(
        "Usage: --resolve REPORT_ID --note 'Review result (1–500 characters)'",
      );
    const result = await db.messageReport.updateMany({
      where: { id, resolvedAt: null },
      data: { resolvedAt: new Date(), resolutionNote: note },
    });
    console.log(JSON.stringify({ resolved: result.count, reportId: id }));
  } else if (!args.length || (args.length === 1 && args[0] === "--list")) {
    const reports = await db.messageReport.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        reason: true,
        conversationKey: true,
        messageId: true,
        createdAt: true,
        reporter: { select: { handle: true } },
      },
    });
    console.log(JSON.stringify(reports, null, 2));
  } else
    throw new Error(
      "Usage: reports:review [--list | --show REPORT_ID | --resolve REPORT_ID --note 'Review result']",
    );
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith("Usage:")
      ? error.message
      : "Report review failed. Check the selected database and migrations.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
