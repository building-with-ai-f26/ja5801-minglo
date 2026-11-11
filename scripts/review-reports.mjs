import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && existsSync(".env"))
  process.loadEnvFile(".env");
const db = new PrismaClient();
try {
  const args = process.argv.slice(2);
  if (args[0] === "--resolve") {
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
      "Usage: reports:review [--list | --resolve REPORT_ID --note 'Review result']",
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
