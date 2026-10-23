import { errorClass } from "@/app/components/formStyles";

export default function FieldError({ errors, keys }: { errors: Record<string, string>; keys: string[] }) {
  const k = keys.find((x) => errors[x]);
  if (!k) return null;
  return <p className={errorClass} role="alert" data-field-error>{errors[k]}</p>;
}
