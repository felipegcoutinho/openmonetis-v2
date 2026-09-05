import { QRCodeSVG } from "qrcode.react";
import { formatDeviceTokenQrCodeValue } from "../device-tokens.presentation";

interface DeviceTokenQrCodeProps {
  token: string;
}

export function DeviceTokenQrCode({ token }: DeviceTokenQrCodeProps) {
  return (
    <div className="grid justify-items-center gap-2 text-center">
      <div
        aria-label="QR Code do token do Companion"
        className="overflow-hidden rounded-xl border bg-background p-2 shadow-sm"
        role="img"
      >
        <QRCodeSVG
          aria-hidden="true"
          className="size-52 max-w-full"
          level="M"
          marginSize={3}
          size={208}
          value={formatDeviceTokenQrCodeValue(token)}
        />
      </div>
      <p className="text-muted-foreground text-xs">Escaneie com o OpenMonetis Companion</p>
    </div>
  );
}
