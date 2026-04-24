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
    <div className="stack">
      <form action={uploadTaskAction} className="stack">
        <div>
          <label className="label">匿名上传任务</label>
          <input
            className="input"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="任务标题（例如：帮我带一杯温水）"
            maxLength={80}
          />
          <div className="footer-note" style={{ textAlign: "right" }}>
            {title.length}/80
          </div>
        </div>
        <div>
          <textarea
            className="textarea"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="任务说明（要做什么、什么时候、什么标准算完成）"
            maxLength={500}
            rows={3}
          />
          <div className="footer-note" style={{ textAlign: "right" }}>
            {description.length}/500
          </div>
        </div>
        <SubmitButton text="匿名上传任务" pendingText="上传中..." />
        <div className="footer-note">
          任务是匿名上传的，平台不记录上传者身份。接取任务的人会实名显示。
        </div>
      </form>

      <div className="separator" />

      <div className="button-row" style={{ gap: 8 }}>
        <button
          type="button"
          className={tab === "available" ? "button" : "button-secondary"}
          onClick={() => setTab("available")}
        >
          可接取（{buckets.available.length}）
        </button>
        <button
          type="button"
          className={tab === "mine" ? "button" : "button-secondary"}
          onClick={() => setTab("mine")}
        >
          我接取的（{buckets.mine.length}）
        </button>
        <button
          type="button"
          className={tab === "completed" ? "button" : "button-secondary"}
          onClick={() => setTab("completed")}
        >
          已完成（{buckets.completed.length}）
        </button>
      </div>

      <div className="list">
        {list.length === 0 ? (
          <div className="list-item">
            {tab === "available"
              ? "当前没有可接取的任务。"
              : tab === "mine"
                ? "你还没有接取中的任务。"
                : "还没有已完成的任务。"}
          </div>
        ) : (
          list.map((task) => (
            <div className="list-item" key={task.id}>
              <div className="task-title-emphasis">{task.title}</div>
              <div className="footer-note" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                {task.description}
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                发布时间：{new Date(task.created_at).toLocaleString("zh-CN")}
                {task.claimer_display_name ? (
                  <> · 接取人：{task.claimer_display_name}</>
                ) : null}
                {task.completed_at ? (
                  <> · 完成于 {new Date(task.completed_at).toLocaleString("zh-CN")}</>
                ) : null}
              </div>

              {tab === "available" ? (
                <form action={claimTaskAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <SubmitButton text="接取任务" pendingText="接取中..." />
                </form>
              ) : null}

              {tab === "mine" ? (
                <form action={completeTaskAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <SubmitButton text="标记为已完成" pendingText="处理中..." />
                </form>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
