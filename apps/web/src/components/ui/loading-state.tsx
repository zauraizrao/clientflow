export function LoadingState({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="p-6 text-center">
      {message}
    </div>
  );
}
