export default function AuthError({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const error = searchParams?.error || "Unknown error"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-4 text-base text-red-600">
            {error === "AccessDenied" && "Access denied. Your email domain is not allowed."}
            {error === "Configuration" && "Server configuration error. Please contact support."}
            {error !== "AccessDenied" && error !== "Configuration" && "An error occurred during authentication."}
          </p>
          <a
            href="/auth/signin"
            className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try again
          </a>
        </div>
      </div>
    </div>
  )
}
