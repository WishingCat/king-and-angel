"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveWishesAction } from "@/app/dashboard/actions";
import type { PreSealWish, SealStatus } from "@/lib/types";

type Props = {
  initialWishes: PreSealWish[];
  sealStatus: SealStatus;
};

const ORDINALS = ["其一", "其二", "其三"] as const;
const PLACEHOLDERS = [
  "希望有人在我忙到忘了吃饭的时候，提醒我去食堂看一下……",
  "希望能够每周读完一本书，哪怕只是散文、诗集都好。",
  "希望有人告诉我，我上学期做志愿者时让他感到温暖的一件事。",
] as const;

export function WishEditor({ initialWishes, sealStatus }: Props) {
  const locked = sealStatus === "published";
  const byIndex = new Map(initialWishes.map((wish) => [wish.wish_index, wish.content]));
  const [values, setValues] = useState<[string, string, string]>([
    byIndex.get(0) ?? "",
    byIndex.get(1) ?? "",
    byIndex.get(2) ?? "",
  ]);

  return (
    <form action={saveWishesAction} className="stack" style={{ gap: 22 }}>
      {[0, 1, 2].map((index) => (
        <div className="wish-field" key={index}>
          <div className="wish-field-label">
            <span className="wish-field-ordinal">{ORDINALS[index]}</span>
          </div>
          <textarea
            className="textarea"
            name={`wish_${index}`}
            value={values[index]}
            onChange={(event) => {
              const next = [...values] as [string, string, string];
              next[index] = event.target.value;
              setValues(next);
            }}
            placeholder={PLACEHOLDERS[index]}
            disabled={locked}
            maxLength={200}
            rows={3}
          />
          <span className="char-count">{values[index].length} / 200</span>
        </div>
      ))}

      {locked ? (
        <div className="alert alert-success">
          <strong>已封缄。</strong>这三条心愿今后只躺在天使的信里，你的名字他会知道。
        </div>
      ) : (
        <div className="row gap-md mt-1">
          <SubmitButton text="封进信里" pendingText="保存中……" />
          <span className="meta-cap">封缄前可随时修改</span>
        </div>
      )}
    </form>
  );
}
