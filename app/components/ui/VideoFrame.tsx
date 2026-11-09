"use client";

import { useSyncExternalStore } from "react";
import { embedForHost } from "@/lib/utils/bbcode";

const subscribe = () => () => {};

/* Vídeo incrustado. Espera a conocer el dominio de la página, que Twitch exige en la dirección. */
export default function VideoFrame({ src }: { src: string }) {
  const hostname = useSyncExternalStore(subscribe, () => window.location.hostname, () => null);
  return (
    <div className="my-2 max-w-2xl">
      {hostname ? (
        <iframe
          src={embedForHost(src, hostname)}
          title="Vídeo"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          className="aspect-video w-full rounded-md"
        />
      ) : (
        <div className="aspect-video w-full rounded-md bg-black/30" />
      )}
    </div>
  );
}
