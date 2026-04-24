"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { sendMessageAction } from "@/app/dashboard/actions";
import type { PublicMessage } from "@/lib/types";

type Props = {
  messages: PublicMessage[];
};

function formatStamp(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleString("zh-CN", { month: "long" });
  const day = date.getDate();
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${month}${day}日 · ${hh}:${mm}`;
}

export function MessageBoard({ messages }: Props) {
  const [draft, setDraft] = useState("");

  return (
    <div className="stack" style={{ gap: 22 }}>
      <form action={sendMessageAction} className="stack" style={{ gap: 10 }}>
        <label className="label">写一张留言，贴到墙上</label>
        <textarea
          className="textarea"
          name="content"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="一句不必署名的话，可以是轻声的问好，也可以是某一天你对谁的感谢。"
          maxLength={500}
          rows={3}
        />
        <div className="row-between">
          <span className="char-count" style={{ marginTop: 0 }}>
            {draft.length} / 500
          </span>
          <SubmitButton text="贴上留言墙" pendingText="贴上中……" />
        </div>
      </form>

      <div className="rule-dashed" />

      <div className="list">
        {messages.length > 0 ? (
          messages.map((message) => (
            <article className="entry" key={message.id}>
              <div className="entry-meta">
                <span className="entry-timestamp">{formatStamp(message.created_at)}</span>
                <span className="meta-cap">anon.</span>
              </div>
              <p className="entry-body">{message.content}</p>
            </article>
          ))
        ) : (
          <div className="empty-note">— 墙上还空着。可以来贴第一张。 —</div>
        )}
      </div>

      <p className="footer-note" style={{ marginTop: 0 }}>
        留言不记录发送者。运营者能看到墙上的内容，但看不到是谁写的。
      </p>
    </div>
  );
}
