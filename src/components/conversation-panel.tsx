"use client";
import { useState, useCallback } from "react";
import { Transcript } from "./transcript";
import { Composer, type ReplyTarget } from "./composer";
import { MessageReportForm } from "./message-report-form";
import type { TranscriptMessage } from "@/lib/rooms";
import type { PublicTranscriptMessage } from "@/lib/public-room";
import type { MessageState } from "@/app/actions/messages";

export function ConversationPanel({
  initialMessages,
  initialHasOlder,
  initialHasNewer,
  initialFocusId,
  messagesUrl,
  conversationKey,
  currentSenderId,
  publicRoom,
  canPost,
  initialKey,
  roomId,
  action,
  children,
}: {
  initialMessages: (TranscriptMessage | PublicTranscriptMessage)[];
  initialHasOlder: boolean;
  initialHasNewer: boolean;
  initialFocusId?: number;
  messagesUrl: string;
  conversationKey: string;
  currentSenderId?: string;
  publicRoom?: boolean;
  canPost: boolean;
  initialKey: string;
  roomId?: string;
  action?: (state: MessageState, form: FormData) => Promise<MessageState>;
  children?: React.ReactNode;
}) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<ReplyTarget | null>(null);
  const clearReply = useCallback(() => setReplyTarget(null), []);
  return (
    <>
      <Transcript
        messagesUrl={messagesUrl}
        conversationKey={conversationKey}
        initialMessages={initialMessages}
        initialHasOlder={initialHasOlder}
        initialHasNewer={initialHasNewer}
        initialFocusId={initialFocusId}
        currentSenderId={currentSenderId}
        publicRoom={publicRoom}
        onReply={canPost ? setReplyTarget : undefined}
        onReport={setReportTarget}
      />
      {reportTarget && (
        <MessageReportForm
          key={reportTarget.id}
          conversationKey={conversationKey}
          target={reportTarget}
          onCancel={() => setReportTarget(null)}
        />
      )}
      {canPost ? (
        <Composer
          roomId={roomId}
          initialKey={initialKey}
          action={action}
          replyTarget={replyTarget}
          onCancelReply={clearReply}
        />
      ) : (
        children
      )}
    </>
  );
}
