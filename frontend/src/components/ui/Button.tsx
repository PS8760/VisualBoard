import type { ReactNode } from "react";

interface ButtonProps {
    children: ReactNode;
    variant?: "primary" | "secondary";
}

export default function Button({
    children,
    variant = "primary",
}: ButtonProps) {
    const variants = {
        primary:
            "bg-violet-600 hover:bg-violet-500 text-white",
        secondary:
            "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white",
    };
    return (
        <button
        className= {`
            px-6 py-3 rounded-xl
            font-medium
            transition-all duration-200
            hover:scale-[0.2]
            ${variants[variant]}
            `}
        >
            {children}
        </button>
    )
}