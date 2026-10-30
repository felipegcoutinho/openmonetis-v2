import { useEffect } from "react";
import { toast } from "sonner";
import { consumeFlashToast } from "@/lib/flash-toast";

export function FlashToast() {
  useEffect(() => {
    const message = consumeFlashToast();
    if (message) toast.success(message);
  }, []);

  return null;
}
