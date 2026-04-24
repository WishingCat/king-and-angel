type Props = {
  searchParams?: { [key: string]: string | string[] | undefined };
  successKey?: string;
  errorKey?: string;
};

export function FormMessage({
  searchParams,
  successKey = "success",
  errorKey = "error",
}: Props) {
  const success = searchParams?.[successKey];
  const error = searchParams?.[errorKey];

  const successText = Array.isArray(success) ? success[0] : success;
  const errorText = Array.isArray(error) ? error[0] : error;

  if (!successText && !errorText) return null;

  return (
    <div className={errorText ? "alert alert-error" : "alert alert-success"}>
      {errorText ?? successText}
    </div>
  );
}