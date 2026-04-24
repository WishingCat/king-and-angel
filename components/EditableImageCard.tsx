import Image from "next/image";

type EditableImageCardProps = {
  src?: string;
  alt: string;
  title?: string;
  hint?: string;
  className?: string;
  priority?: boolean;
};

export function EditableImageCard({
  src,
  alt,
  title,
  hint,
  className,
  priority = false,
}: EditableImageCardProps) {
  const hasImage = Boolean(src);

  return (
    <div className={`editable-image-card ${className ?? ""}`}>
      <div className="editable-image-shell">
        {hasImage ? (
          <Image
            src={src!}
            alt={alt}
            fill
            priority={priority}
            className="editable-image"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="editable-image-placeholder">
            <div className="editable-image-placeholder-title">
              {title ?? "可替换图片区域"}
            </div>
            <div className="editable-image-placeholder-hint">
              {hint ?? "你可以把图片放到 public/images/，再到 lib/site-assets.ts 修改路径。"}
            </div>
          </div>
        )}

        {(title || hint) && (
          <div className="editable-image-overlay">
            {title ? <div className="editable-image-overlay-title">{title}</div> : null}
            {hint ? <div className="editable-image-overlay-hint">{hint}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
