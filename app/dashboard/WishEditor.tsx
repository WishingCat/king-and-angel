"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveWishesAction } from "@/app/dashboard/actions";
import type { PreSealWish, SealStatus } from "@/lib/types";

type Props = {
  initialWishes: PreSealWish[];
  sealStatus: SealStatus;
};

export function WishEditor({ initialWishes, sealStatus }: Props) {
  const locked = sealStatus === "published";
  const byIndex = new Map(initialWishes.map((wish) => [wish.wish_index, wish.content]));
  const [values, setValues] = useState<[string, string, string]>([
    byIndex.get(0) ?? "",
    byIndex.get(1) ?? "",
    byIndex.get(2) ?? "",
  ]);

  return (
    <form action={saveWishesAction} className="stack">
      {[0, 1, 2].map((index) => (
        <div key={index}>
          <label className="label">心愿 {index + 1}</label>
          <textarea
            className="textarea"
            name={`wish_${index}`}
            value={values[index]}
            onChange={(event) => {
              const next = [...values] as [string, string, string];
              next[index] = event.target.value;
              setValues(next);
            }}
            placeholder={
              index === 0
                ? "例如：希望有人能在忙碌的时候提醒我按时吃饭、早点休息。"
                : "再写一条具体、温和、可执行的心愿。"
            }
            disabled={locked}
            maxLength={200}
            rows={3}
          />
          <div className="footer-note" style={{ textAlign: "right" }}>
            {values[index].length}/200
          </div>
        </div>
      ))}

      {locked ? (
        <div className="alert alert-success">
          配对已封印，心愿不能再修改。
        </div>
      ) : (
        <SubmitButton text="保存 3 条心愿" pendingText="保存中..." />
      )}
    </form>
  );
}
