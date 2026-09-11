export default function ProductDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-12">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>

      {/* Main product grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Gallery skeleton */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-square sm:aspect-4/3 w-full rounded-3xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-300 dark:bg-slate-700/60" />
          </div>
          {/* Thumbnails skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
          {/* Description skeleton placeholder */}
          <div className="mt-8 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
            <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-800/60 rounded" />
            <div className="h-3 w-4/6 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        </div>

        {/* Right: Info & CTA skeleton */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <div className="h-3 w-32 bg-blue-100 dark:bg-blue-950/60 rounded" />
            <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>

          {/* Pricing box skeleton */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>

          {/* Action buttons skeleton */}
          <div className="space-y-3 pt-2">
            <div className="h-12 w-full bg-blue-600/30 rounded-2xl" />
            <div className="h-12 w-full bg-emerald-600/30 rounded-2xl" />
          </div>

          {/* Guarantees skeleton */}
          <div className="p-5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 space-y-2">
            <div className="h-3 w-full bg-slate-200 dark:bg-slate-700/60 rounded" />
            <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-700/60 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
