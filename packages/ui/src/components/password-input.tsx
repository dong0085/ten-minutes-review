"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "cn"
import { Input } from "./input"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  showLabel: string
  hideLabel: string
}

function PasswordInput({
  className,
  showLabel,
  hideLabel,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/25"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export { PasswordInput }
