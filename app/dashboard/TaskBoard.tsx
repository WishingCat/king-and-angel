"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  claimTaskAction,
  completeTaskAction,
  uploadTaskAction,
} from "@/app/dashboard/actions";
import type { TaskWithClaimer } from "@/lib/types";

type Tab = "available" | "mine" | "completed";

type Props = {
  tasks: TaskWithClaimer[];
  currentUserId: string;
};

const TAB_LABEL: Record<Tab, string> = {
  available: "可接取",
  mine: "我接的",
  completed: "已完成",
};

function formatStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()} · ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function TaskBoard({ tasks, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("available");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const buckets = useMemo(() => {
    const available: TaskWithClaimer[] = [];
    const mine: TaskWithClaimer[] = [];
    const completed: TaskWithClaimer[] = [];

    tasks.forEach((task) => {
      if (task.completed_at) {
        completed.push(task);
      } else if (task.claimed_by === null) {
        available.push(task);
      } else if (task.claimed_by === currentUserId) {
        mine.push(task);
      }
    });

    return { available, mine, completed };
  }, [tasks, currentUserId]);

  const list =
    tab === "available" ? buckets.available : tab === "mine" ? buckets.mine : buckets.completed;

  return (
    <div className="stack" style={{ gap: 26 }}>
      <form action={uploadTaskAction} className="stack" style={{ gap: 12 }}>
        <label className="label">匿名贴一张任务条</label>
        <input
          className="input"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="任务条题目（如：替我去未名湖看一眼今天的鸭子）"
          maxLength={80}
        />
        <span className="char-count" style={{ marginTop: -4 }}>{title.length} / 80</span>
        <textarea
          className="textarea"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="说一下做这件事的细节、时间和算完成的标准。"
          maxLength={500}
          rows={3}
        />
        <div className="row-between">
          <span className="char-count" style={{ marginTop: 0 }}>{description.length} / 500</span>
          <SubmitButton text="贴上任务板" pendingText="贴上中……" />
        </div>
        <p className="meta-cap">任务匿名上传 · 接取者实名 · 完成由接取者本人勾选</p>
      </form>

      <div className="rule-dashed" />

      <div className="stamp-tabs" role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => {
          const count =
            key === "available"
              ? buckets.available.length
              : key === "mine"
                ? buckets.mine.length
                : buckets.completed.length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-pressed={tab === key}
              className="stamp-tab"
              onClick={() => setTab(key)}
            >
              {TAB_LABEL[key]} · {count}
            </button>
          );
        })}
      </div>

      <div className="list">
        {list.length === 0 ? (
          <div className="empty-note">
            {tab === "available"
              ? "— 任务板上没有空闲任务。 —"
              : tab === "mine"
                ? "— 你目前没有进行中的任务。 —"
                : "— 还没有已完成的任务。 —"}
          </div>
        ) : (
          list.map((task) => (
            <article className="entry" key={task.id}>
              <div className="entry-meta">
                <span className="entry-timestamp">{formatStamp(task.created_at)}</span>
                {task.claimer_display_name ? (
                  <span className="entry-claim">已被 {task.claimer_display_name} 接取</span>
                ) : (
                  <span className="meta-cap">未接取</span>
                )}
                {task.completed_at ? (
                  <span className="entry-status">完成于 {formatStamp(task.completed_at)}</span>
                ) : null}
              </div>
              <h3 className="entry-title">{task.title}</h3>
              <p className="entry-body">{task.description}</p>

              {tab === "available" ? (
                <form action={claimTaskAction} style={{ marginTop: 14 }}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <SubmitButton text="我来接" pendingText="接取中……" />
                </form>
              ) : null}

              {tab === "mine" ? (
                <form action={completeTaskAction} style={{ marginTop: 14 }}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <SubmitButton text="我已经做完了" pendingText="标记中……" />
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
