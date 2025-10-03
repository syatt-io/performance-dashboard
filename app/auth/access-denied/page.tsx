export default function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Access Denied
          </h2>
          <p className="mt-4 text-base text-gray-600">
            Your account does not have access to this application.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Please contact an administrator to request access.
          </p>
        </div>
      </div>
    </div>
  )
}
