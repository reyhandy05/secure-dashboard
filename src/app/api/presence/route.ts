import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      let previous = "";
      const publish = async () => {
        try {
          const users = await prisma.user.findMany({ select: { id: true, lastSeenAt: true } });
          const now = Date.now();
          const payload = users.map((user) => ({
            id: user.id,
            status: user.lastSeenAt && now - user.lastSeenAt.getTime() < 90_000 ? "Online" : "Offline",
          }));
          const json = JSON.stringify(payload);
          if (json !== previous) {
            controller.enqueue(encoder.encode(`event: presence\ndata: ${json}\n\n`));
            previous = json;
          }
        } catch {
          controller.enqueue(encoder.encode("event: error\ndata: {}\n\n"));
        }
      };
      await publish();
      timer = setInterval(() => void publish(), 5000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });
  request.signal.addEventListener("abort", () => { if (timer) clearInterval(timer); });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
