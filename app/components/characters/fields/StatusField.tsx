import FieldError from "./FieldError";
import { STATUSES, type Status } from "./constants";

/* Estado del personaje: en activo, retirado o fallecido. */
export default function StatusField({
  value, onChange, errors,
}: {
  value: Status;
  onChange: (status: Status) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <div role="radiogroup" aria-label="Estado" className="grid gap-3 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors ${value === s.id ? "border-brand bg-brand/10" : "border-line hover:border-brand"}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="status" value={s.id} checked={value === s.id} onChange={() => onChange(s.id)} className="accent-brand" />
              {s.label}
            </span>
            <span className="text-muted">{s.description}</span>
          </label>
        ))}
      </div>
      <FieldError errors={errors} keys={["status"]} />
    </>
  );
}
