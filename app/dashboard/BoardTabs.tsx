"use client";

import { useState } from "react";
import { MessageBoard } from "@/app/dashboard/MessageBoard";
import { TaskBoard } from "@/app/dashboard/TaskBoard";
import type { PublicMessage, TaskWithClaimer } from "@/lib/types";

type Tab = "wall" | "board";

type Props = {
  messages: PublicMessage[];
  tasks: TaskWithClaimer[];
  currentUserId: string;
};

export function BoardTabs({ messages, tasks, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("wall");

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="stamp-tabs" role="tablist" aria-label="留言墙与任务板切换">
        <button
          type="button"
          role="tab"
          aria-pressed={tab === "wall"}
          className={`stamp-tab ${tab === "wall" ? "is-active" : ""}`}
          onClick={() => setTab("wall")}
        >
          其三 · 留言墙
        </button>
        <button
          type="button"
          role="tab"
          aria-pressed={tab === "board"}
          className={`stamp-tab ${tab === "board" ? "is-active" : ""}`}
          onClick={() => setTab("board")}
        >
          其四 · 任务板
        </button>
      </div>

      {tab === "wall" ? (
        <div className="sheet sheet-xl">
          <span className="chapter-no">
            <span className="chapter-label">其三</span>
            <span>留言墙</span>
          </span>
          <h2 className="section-title">不署名的一面墙</h2>
          <p className="section-subtitle mb-3">
            所有人都能看，所有人都能写。这面墙不记录是谁贴上去的。
          </p>
          <MessageBoard messages={messages} />
        </div>
      ) : (
        <div className="sheet sheet-xl">
          <span className="chapter-no">
            <span className="chapter-label">其四</span>
            <span>任务板</span>
          </span>
          <h2 className="section-title">公共任务板</h2>
          <p className="section-subtitle mb-3">
            匿名贴上任务条；任何人都可以接取。完成由接取者本人勾选。
          </p>
          <TaskBoard tasks={tasks} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  );
}
