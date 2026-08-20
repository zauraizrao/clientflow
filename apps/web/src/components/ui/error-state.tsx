export function ErrorState({
  message = "Something went wrong.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-xl border p-6 text-center">
      {message}
    </div>
  );
}
