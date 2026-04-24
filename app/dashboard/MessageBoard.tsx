"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { sendMessageAction } from "@/app/dashboard/actions";
import type { PublicMessage } from "@/lib/types";

type Props = {
  messages: PublicMessage[];
};

export function MessageBoard({ messages }: Props) {
  const [draft, setDraft] = useState("");

  return (
    <div className="stack">
      <form action={sendMessageAction} className="stack">
        <div>
          <label className="label">新留言（匿名）</label>
          <textarea
            className="textarea"
            name="content"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="写下一句鼓励、一点提醒，或一个温柔的发现。"
            maxLength={500}
            rows={3}
          />
          <div className="footer-note" style={{ textAlign: "right" }}>
            {draft.length}/500
          </div>
        </div>
        <SubmitButton text="发送匿名留言" pendingText="发送中..." />
      </form>

      <div className="separator" />

      <div className="list">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div className="list-item" key={message.id}>
              <div className="small">
                {new Date(message.created_at).toLocaleString("zh-CN")}
              </div>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{message.content}</div>
            </div>
          ))
        ) : (
          <div className="list-item">还没有任何留言，来写第一条吧。</div>
        )}
      </div>

      <div className="footer-note">
        留言采用匿名方式保存，平台不记录发送者身份。
      </div>
    </div>
  );
}
