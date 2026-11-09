import { ImagePicker } from "@/app/components/campaigns/CampaignForm";
import { IMAGE_MB } from "./constants";

/* Retrato e imagen del personaje. En la edición se pasan las imágenes actuales y las marcas de quitar. */
export default function ImageFields({
  errors, portraitUrl, imageUrl, onPortrait, onImage, onRemovePortrait, onRemoveImage,
}: {
  errors: Record<string, string>;
  portraitUrl?: string | null;
  imageUrl?: string | null;
  onPortrait: (f: File | null) => void;
  onImage: (f: File | null) => void;
  onRemovePortrait?: (remove: boolean) => void;
  onRemoveImage?: (remove: boolean) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ImagePicker
        id="portrait"
        label="Retrato"
        hint={`PNG, JPG o WebP. Máximo ${IMAGE_MB} MB.`}
        maxMB={IMAGE_MB}
        previewClass="h-24 w-24"
        cropSquare
        currentUrl={portraitUrl}
        onFile={onPortrait}
        onRemove={onRemovePortrait ?? (() => {})}
        error={errors.portrait}
      />
      <ImagePicker
        id="image"
        label="Imagen"
        hint={`PNG, JPG o WebP. Máximo ${IMAGE_MB} MB.`}
        maxMB={IMAGE_MB}
        previewClass="h-24 w-auto min-w-20 max-w-32"
        keepRatio
        currentUrl={imageUrl}
        onFile={onImage}
        onRemove={onRemoveImage ?? (() => {})}
        error={errors.image}
      />
    </div>
  );
}
