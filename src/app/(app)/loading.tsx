export default function Loading() {
  return (
    <div className="py-4 space-y-4">
      {/* Category tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-9 w-20 rounded-full bg-[#1A1D26] animate-pulse"
          />
        ))}
      </div>

      {/* Signal cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 space-y-3 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#2A2D36]" />
              <div className="h-4 w-24 bg-[#2A2D36] rounded" />
              <div className="h-5 w-14 bg-[#2A2D36] rounded-full" />
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="w-3 h-3 bg-[#2A2D36] rounded" />
              ))}
            </div>
          </div>
          <div className="h-3 w-48 bg-[#2A2D36] rounded" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-12 bg-[#2A2D36] rounded" />
              <div className="h-3 w-24 bg-[#2A2D36] rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 w-8 bg-[#2A2D36] rounded" />
              <div className="h-3 w-20 bg-[#2A2D36] rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-[#2A2D36] rounded" />
              <div className="h-3 w-20 bg-[#2A2D36] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
