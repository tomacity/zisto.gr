type GlobalLoaderProps = {
  fullScreen?: boolean;
  message?: string;
};

export function GlobalLoader({
  fullScreen = false,
  message,
}: GlobalLoaderProps) {
  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-5 bg-[#F6F6F4]"
          : "flex min-h-[240px] flex-col items-center justify-center gap-5"
      }
    >
      <video
        src="/videos/loading.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="h-28 w-28 object-contain md:h-36 md:w-36"
      />

      {message && (
        <p className="text-[12px] font-semibold text-[#222]/55">
          {message}
        </p>
      )}
    </div>
  );
}
