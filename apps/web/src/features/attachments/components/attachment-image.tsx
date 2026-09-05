import { Image } from "@unpic/react/base";

type AttachmentImageProps = {
  alt: string;
  className?: string;
  height: number;
  objectFit: "contain" | "cover";
  src: string;
  width: number;
};

const preserveSignedUrl = (source: string | URL) => source.toString();

export function AttachmentImage(props: AttachmentImageProps) {
  return <Image {...props} breakpoints={[]} layout="constrained" transformer={preserveSignedUrl} />;
}
