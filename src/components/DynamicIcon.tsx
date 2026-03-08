import { icons, LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  // Convert kebab-case to PascalCase: "arrow-up-right" -> "ArrowUpRight"
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

  const Icon = icons[pascalName as keyof typeof icons];
  if (!Icon) return <span className="inline-block" style={{ width: props.size || 20, height: props.size || 20 }} />;
  return <Icon {...props} />;
}
