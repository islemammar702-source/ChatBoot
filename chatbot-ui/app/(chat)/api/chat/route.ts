import { geolocation, ipAddress } from "@vercel/functions";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { allowedModelIds, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

// ── URL du backend Python ─────────────────────────────────────────────────────
const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}
export { getStreamContext };

// ── Helpers UIMessage ─────────────────────────────────────────────────────────

function getMessageText(message: UIMessage): string {
  if (!message.parts) return "";
  for (const part of message.parts) {
    if (part && typeof part === "object" && "type" in part) {
      if ((part as { type: string }).type === "text") {
        const tp = part as { type: string; text?: string };
        if (typeof tp.text === "string") return tp.text;
      }
    }
  }
  return "";
}

function getLastUserMessage(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return getMessageText(messages[i]);
  }
  return "";
}

// ── Appel Python backend ──────────────────────────────────────────────────────

interface PythonResponse {
  response: string;
  type: string;
  images_b64?: string[];
}

function detectImageMediaType(base64Data: string): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
  if (base64Data.startsWith("iVBORw0KGgo")) {
    return "image/png";
  }
  if (base64Data.startsWith("/9j/")) {
    return "image/jpeg";
  }
  if (base64Data.startsWith("R0lGOD")) {
    return "image/gif";
  }
  if (base64Data.startsWith("UklGR")) {
    return "image/webp";
  }
  return "image/png";
}

function parseBase64Image(payload: string): { mediaType: string; base64Data: string } {
  const dataUrlMatch = payload.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mediaType: dataUrlMatch[1],
      base64Data: dataUrlMatch[2],
    };
  }

  return {
    mediaType: detectImageMediaType(payload),
    base64Data: payload,
  };
}

async function callPythonBackend(
  prompt: string,
  conversationId: string,
  history: { role: string; content: string }[],
  userEmail: string
): Promise<PythonResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  try {
    const res = await fetch(`${PYTHON_BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        conversation_id: conversationId,
        messages: history,
        user_email: userEmail,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[route] Python ${res.status}: ${errText}`);
      return {
        response:
          `❌ Erreur du service backend (${res.status}).\n` +
          `Vérifiez que le serveur Python tourne : \`uvicorn api:app --port 8000\``,
        type: "error",
      };
    }

    const data = await res.json();
    console.log(
      `[route] Python répondu — type=${data.type} — ${String(data.response).slice(0, 80)}` +
      (data.images_b64?.length ? ` (${data.images_b64.length} images)` : "")
    );
    return data as PythonResponse;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error(`[route] Python ${isAbort ? "TIMEOUT" : "ERREUR"}:`, err);
    return {
      response: isAbort
        ? "⏱️ Le service backend a mis trop de temps à répondre. Réessayez."
        : `❌ Backend Python inaccessible.\nVérifiez : \`uvicorn api:app --port 8000\`\net \`PYTHON_BACKEND_URL=${PYTHON_BACKEND_URL}\``,
      type: "error",
    };
  }
}

// ── Streaming de la réponse vers le client ────────────────────────────────────

// ── Streaming de la réponse vers le client ────────────────────────────────────

function streamResponse(
  writer: UIMessageStreamWriter<ChatMessage>,
  text: string,
  imagesB64?: string[]
): void {
  // ── 1. Texte en streaming ──────────────────────────────────────────────
  const textId = generateId();
  writer.write({ type: "text-start", id: textId });
  for (let i = 0; i < text.length; i += 8) {
    writer.write({ type: "text-delta", id: textId, delta: text.slice(i, i + 8) });
  }
  writer.write({ type: "text-end", id: textId });

  // ── 2. Images après le texte ───────────────────────────────────────────
  if (imagesB64 && imagesB64.length > 0) {
    for (const imgB64 of imagesB64) {
      const { mediaType, base64Data } = parseBase64Image(imgB64);
      writer.write({
        type: "file",
        url: `data:${mediaType};base64,${base64Data}`,
        mediaType,
      });
    }
  }

  writer.write({ type: "finish", finishReason: "stop" });
}

// ── POST /api/chat ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });
    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);
    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    // ── Construction uiMessages ───────────────────────────────────────────
    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" || p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [String(p.toolCallId ?? ""), p]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) =>
          "toolCallId" in part && approvalStates.has(String(part.toolCallId))
            ? { ...part, ...approvalStates.get(String(part.toolCallId)) }
            : part
        ),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    // ── Sauvegarde message utilisateur ────────────────────────────────────
    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    // ── Appel Python AVANT d'ouvrir le stream ─────────────────────────────
    const lastPrompt = getLastUserMessage(uiMessages as UIMessage[]);
    const history = (uiMessages as UIMessage[])
      .slice(0, -1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: getMessageText(m) }))
      .filter((m) => m.content.trim().length > 0);

    // TOUJOURS utiliser Python — pas de fallback Groq
    const userEmail = session.user.email ?? session.user.id;
    const pythonResult = await callPythonBackend(lastPrompt, id, history, userEmail);
    const answerText = pythonResult.response || "❌ Réponse vide du backend.";

    // ── Stream vers le client ─────────────────────────────────────────────
    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer }) => {
        try {
          // Passer les images au stream
          streamResponse(writer, answerText, pythonResult.images_b64);
        } catch (err) {
          console.error("[route] stream error:", err);
          streamResponse(
            writer,
            `❌ Erreur: ${err instanceof Error ? err.message : "inconnue"}`
          );
        }

        if (titlePromise) {
          try {
            const title = await titlePromise;
            writer.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (_) {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finished }) => {
        if (isToolApprovalFlow) {
          for (const msg of finished) {
            const exists = uiMessages.find((m) => m.id === msg.id);
            if (exists) {
              await updateMessage({ id: msg.id, parts: msg.parts });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: msg.id,
                    role: msg.role,
                    parts: msg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finished.length > 0) {
          await saveMessages({
            messages: finished.map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: (err) => {
        console.error("[route] onError:", err);
        return "Une erreur est survenue.";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) return;
        try {
          const ctx = getStreamContext();
          if (ctx) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await ctx.createNewResumableStream(streamId, () => sseStream);
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");
    if (error instanceof ChatbotError) return error.toResponse();
    console.error("[route] Unhandled:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

// ── DELETE /api/chat ──────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new ChatbotError("bad_request:api").toResponse();

  const session = await auth();
  if (!session?.user) return new ChatbotError("unauthorized:chat").toResponse();

  const chat = await getChatById({ id });
  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  return Response.json(await deleteChatById({ id }), { status: 200 });
}