import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

function PasswordInput({ className, disabled, id, ...props }: PasswordInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const toggleLabel = isPasswordVisible ? "Ocultar senha" : "Mostrar senha";

  return (
    <div className="relative">
      <Input
        className={cn("pr-10", className)}
        disabled={disabled}
        id={id}
        type={isPasswordVisible ? "text" : "password"}
        {...props}
      />
      <Button
        aria-controls={id}
        aria-label={toggleLabel}
        aria-pressed={isPasswordVisible}
        className="absolute inset-y-0 right-0 h-full rounded-l-none px-2.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
        disabled={disabled}
        onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
        onMouseDown={(event) => event.preventDefault()}
        size="icon"
        title={toggleLabel}
        type="button"
        variant="ghost"
      >
        {isPasswordVisible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </Button>
    </div>
  );
}

export { PasswordInput };
